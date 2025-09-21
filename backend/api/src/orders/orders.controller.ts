import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  private aliases = {
    date:   ['issuedAt','createdAt','date','fecha','created_at','emision','created'],
    client: ['client','cliente','customer','clientName','nombre_cliente','cliente_nombre','nombre'],
    total:  ['total','monto','importe','amount','monto_total','total_neto','total_bruto'],
  };

  private pickKey(row: any, candidates: string[]): string | null {
    if (!row || typeof row !== 'object') return null;
    for (const k of candidates) if (k in row) return k;
    // también admite anidado: client.name
    if (candidates.includes('client') && row.client && typeof row.client === 'object') {
      if ('name' in row.client) return 'client.name';
    }
    return null;
  }

  private getVal(row: any, key: string | null): any {
    if (!key) return null;
    if (key.includes('.')) {
      const [a,b] = key.split('.');
      return row?.[a]?.[b] ?? null;
    }
    return row?.[key] ?? null;
  }

  private async chooseDelegate() {
    const delegates = ['sale', 'resumen_historico']; // orden de preferencia
    const tried: string[] = [];
    for (const d of delegates) {
      const model = (this.prisma as any)[d];
      if (!model) { tried.push(`${d}:absent`); continue; }
      try {
        const sample = await model.findFirst({ take: 1 });
        tried.push(`${d}:${sample ? 'ok' : 'empty'}`);
        if (sample) return { delegate: d, sample, tried };
      } catch (e: any) {
        tried.push(`${d}:err`);
      }
    }
    // si ninguno tiene filas, devolver el primero existente (para shape consistente)
    for (const d of delegates) {
      if ((this.prisma as any)[d]) return { delegate: d, sample: null, tried };
    }
    return { delegate: null as any, sample: null, tried };
  }

  private normalizeRow(row: any, meta: any) {
    const id = row?.id ?? null;
    const rawDate   = this.getVal(row, meta?.dateKey);
    const rawClient = this.getVal(row, meta?.clientKey);
    const rawTotal  = this.getVal(row, meta?.totalKey);

    let date: string | null = null;
    if (rawDate instanceof Date) date = rawDate.toISOString();
    else if (typeof rawDate === 'string' && !Number.isNaN(Date.parse(rawDate))) {
      date = new Date(rawDate).toISOString();
    } else if (typeof rawDate === 'number') {
      const d = new Date(rawDate);
      if (!Number.isNaN(+d)) date = d.toISOString();
    }

    const client = (rawClient && typeof rawClient === 'string') ? rawClient
                  : (typeof rawClient === 'object' && 'name' in rawClient ? rawClient.name : null);

    const total = typeof rawTotal === 'number' ? rawTotal
                : (rawTotal ? Number(rawTotal) : 0);

    return { id, date, client, total, _raw: row };
  }

  private async listBase(qs: any) {
    const limit = Math.max(1, Math.min(100, Number(qs.limit ?? 20)));
    const page  = Math.max(1, Number(qs.page ?? 1));
    const skip  = (page - 1) * limit;

    const chosen = await this.chooseDelegate();
    const delegate = chosen.delegate ? (this.prisma as any)[chosen.delegate] : null;

    if (!delegate) {
      return { total: 0, items: [], meta: null, debug: { tried: chosen.tried, delegate: null } };
    }

    // obtener una muestra confiable (si no vino de chooseDelegate)
    let sample = chosen.sample;
    if (!sample) {
      try { sample = await delegate.findFirst({ take: 1 }); } catch {}
    }

    // detectar claves
    let meta: { dateKey: string|null; clientKey: string|null; totalKey: string|null } | null = null;
    if (sample) {
      const dateKey   = this.pickKey(sample, this.aliases.date);
      const clientKey = this.pickKey(sample, this.aliases.client);
      const totalKey  = this.pickKey(sample, this.aliases.total);
      meta = { dateKey, clientKey, totalKey };
    }

    // construir select seguro
    const select: any = { id: true };
    if (meta?.dateKey && !meta.dateKey.includes('.'))   select[meta.dateKey] = true;
    if (meta?.clientKey && !meta.clientKey.includes('.')) select[meta.clientKey] = true;
    if (meta?.totalKey && !meta.totalKey.includes('.')) select[meta.totalKey] = true;
    // si clientKey es client.name, igual pedimos client { name }
    if (meta?.clientKey === 'client.name') select['client'] = { select: { name: true } };

    // ordenar: por fecha si hay, si no por id desc
    const orderBy = meta?.dateKey && !meta.dateKey.includes('.') ? { [meta.dateKey]: 'desc' } : { id: 'desc' };

    // ejecutar query
    let total = 0;
    try { total = await delegate.count(); } catch {}
    let rows: any[] = [];
    try {
      rows = await delegate.findMany({ skip, take: limit, select, orderBy });
    } catch (e: any) {
      // última defensa: sin select/orden (puede traer muchos campos)
      try { rows = await delegate.findMany({ skip, take: limit }); } catch { rows = []; }
    }

    const items = rows.map(r => this.normalizeRow(r, meta));
    return { total, items, meta, debug: { tried: chosen.tried, delegate: chosen.delegate } };
  }

  @Get()
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  async list(@Query() qs: Record<string, any>) {
    return this.listBase(qs);
  }

  @Get('search')
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'q', required: false, description: 'id numérico (opcional)' })
  async search(@Query() qs: Record<string, any>) {
    // si q es id exacto, devolvemos esa primero y completamos con el resto
    const q = (qs.q ?? '').toString().trim();
    if (/^\d+$/.test(q)) {
      const x = await this.byId(q);
      const rest = await this.listBase(qs);
      const items = x ? [x, ...rest.items.filter(i => i.id !== x.id)] : rest.items;
      return { ...rest, items };
    }
    return this.listBase(qs);
  }

  @Get('_debug')
  async debug() {
    const sale = (this.prisma as any).sale;
    const rh   = (this.prisma as any).resumen_historico;
    const chosen = await this.chooseDelegate();
    let keys = null as any;
    let sample = null as any;
    if (chosen.delegate) {
      try { sample = await (this.prisma as any)[chosen.delegate].findFirst({ take: 1 }); } catch {}
      if (sample) {
        keys = {
          dateKey:   this.pickKey(sample, this.aliases.date),
          clientKey: this.pickKey(sample, this.aliases.client),
          totalKey:  this.pickKey(sample, this.aliases.total),
        };
      }
    }
    return {
      exists: { sale: !!sale, resumen_historico: !!rh },
      tried: chosen.tried,
      delegate: chosen.delegate,
      keys,
      sample,
    };
  }

  @Get(':id')
  async byId(@Param('id') id: string) {
    const chosen = await this.chooseDelegate();
    const model = chosen.delegate ? (this.prisma as any)[chosen.delegate] : null;
    if (!model) return null;

    const numId = /^\d+$/.test(id) ? Number(id) : id;
    let row = null as any;
    try { row = await model.findUnique({ where: { id: numId } }); } catch {}
    if (!row && typeof numId === 'string') {
      try { row = await model.findUnique({ where: { id } }); } catch {}
    }
    if (!row) return null;

    // meta por fila
    const meta = {
      dateKey:   this.pickKey(row, this.aliases.date),
      clientKey: this.pickKey(row, this.aliases.client),
      totalKey:  this.pickKey(row, this.aliases.total),
    };
    return this.normalizeRow(row, meta);
  }
}
