import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private prisma: PrismaService) {}

  private monthStartUTC(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  private addMonthsUTC(d: Date, n: number) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  }
  private parseYYYYMM(s?: string | null): Date | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = Number(m[1]), mm = Number(m[2]);
    if (mm < 1 || mm > 12) return null;
    return new Date(Date.UTC(y, mm - 1, 1));
  }

  @Get('sales.monthly')
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM (inclusive)' })
  @ApiQuery({ name: 'to',   required: false, description: 'YYYY-MM (inclusive, se toma fin de mes)' })
  async salesMonthly(@Query() qs: Record<string, any>) {
    // Rango por defecto: últimos 6 meses (incluye el mes actual)
    const now = new Date();
    const base = this.monthStartUTC(now);
    const fromQs = this.parseYYYYMM(qs.from as string);
    const toQs   = this.parseYYYYMM(qs.to   as string);

    const start = fromQs ?? this.addMonthsUTC(base, -5);
    const endEx = toQs ? this.addMonthsUTC(toQs, 1) : this.addMonthsUTC(base, 1);

    // Construyo SIEMPRE el arreglo de meses YYYY-MM del rango
    const months: string[] = [];
    for (let d = new Date(start); d < endEx; d = this.addMonthsUTC(d, 1)) {
      months.push(d.toISOString().slice(0, 7));
    }

    // Detecto delegado sale/sales
    const prismaAny: any = this.prisma as any;
    const sale = prismaAny.sale ?? prismaAny.sales ?? null;

    // Si no hay delegado, devuelvo los meses con 0
    if (!sale) {
      return {
        range: { from: start.toISOString(), to: endEx.toISOString() },
        series: months.map(m => ({ month: m, net: 0 })),
        meta: { rows: 0, dateKey: null, error: 'delegate_sale_missing' },
      };
    }

    try {
      // Detecto el campo de fecha real en runtime
      const probe = await sale.findFirst({}); // 1 fila o null
      const dateKeyCandidates = ['issuedAt', 'date', 'created_at', 'createdAt', 'fecha'];
      const dateKey = dateKeyCandidates.find(k => probe && typeof probe[k] !== 'undefined') ?? 'date';

      // Traigo filas del rango (sin select, para evitar errores de tipos dinámicos)
      const rows = await sale.findMany({
        where: { [dateKey]: { gte: start, lt: endEx } } as any,
      });

      // Acumulo por YYYY-MM
      const acc: Record<string, number> = {};
      for (const r of rows) {
        const dt = r?.[dateKey];
        if (!dt) continue;
        const iso = (dt instanceof Date ? dt : new Date(dt)).toISOString();
        const ym = iso.slice(0, 7);
        const val = Number(r?.net ?? r?.total ?? r?.totalAmount ?? r?.amount ?? 0);
        if (Number.isFinite(val)) acc[ym] = (acc[ym] ?? 0) + val;
      }

      const series = months.map(m => ({ month: m, net: acc[m] || 0 }));
      return {
        range: { from: start.toISOString(), to: endEx.toISOString() },
        series,
        meta: { rows: rows.length, dateKey },
      };
    } catch (e: any) {
      // Fallback seguro (no 500)
      return {
        range: { from: start.toISOString(), to: endEx.toISOString() },
        series: months.map(m => ({ month: m, net: 0 })),
        meta: { error: 'exception', message: String(e?.message || e) },
      };
    }
  }
}