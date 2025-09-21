import { Controller, Get, Query } from '@nestjs/common';
import { DbService } from '../db.service';

function normProduct(row: any) {
  return {
    id: row.id,
    name: row.name ?? row.nombre ?? '',
    sku: row.sku ?? '',
    uom: row.uom ?? row.unidad ?? '',
    tipo: row.tipo ?? row.type ?? 'simple',
    costoStd: Number(row.costoStd ?? row.costo_std ?? row.cost ?? 0),
    precioLista: Number(row.precioLista ?? row.precio_lista ?? row.price ?? 0),
    activo: !!(row.activo ?? row.active ?? true),
  };
}

@Controller('products')
export class ProductsCompatController {
  constructor(private readonly db: DbService) {}

  private async target(): Promise<'cmr'|'public'|null> {
    const q = await this.db.$queryRawUnsafe<any[]>(
      `select
         (to_regclass('cmr."Product"') is not null) as cmr_ok,
         (to_regclass('public.products') is not null) as pub_ok`
    );
    const r = q?.[0];
    if (r?.cmr_ok) return 'cmr';
    if (r?.pub_ok) return 'public';
    return null;
  }

  @Get('')
  async list(@Query('page') page = '1', @Query('limit') limit = '50') {
    const t = await this.target();
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const off = (p - 1) * l;

    if (t === 'cmr') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `select id, name, sku, uom, tipo, "costoStd", "precioLista", coalesce(activo,true) as activo
         from cmr."Product"
         order by id desc
         offset $1 limit $2`, off, l);
      return { items: rows.map(normProduct) };
    } else if (t === 'public') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `select id, nombre, sku, unidad as uom, tipo, costo_std as "costoStd", precio_lista as "precioLista", coalesce(activo,true) as activo
         from public.products
         order by id desc
         offset $1 limit $2`, off, l);
      return { items: rows.map(normProduct) };
    }
    return { items: [] };
  }

  @Get('search')
  async search(@Query('q') q = '', @Query('limit') limit = '20') {
    const t = await this.target();
    const l = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const term = `%${(q || '').trim()}%`;

    if (t === 'cmr') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `select id, name, sku, uom, tipo, "costoStd", "precioLista", coalesce(activo,true) as activo
         from cmr."Product"
         where $1='%%' or (name ilike $1 or sku ilike $1)
         order by name asc
         limit $2`, term, l);
      return { items: rows.map(normProduct) };
    } else if (t === 'public') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `select id, nombre, sku, unidad as uom, tipo, costo_std as "costoStd", precio_lista as "precioLista", coalesce(activo,true) as activo
         from public.products
         where $1='%%' or (nombre ilike $1 or sku ilike $1)
         order by nombre asc
         limit $2`, term, l);
      return { items: rows.map(normProduct) };
    }
    return { items: [] };
  }
}
