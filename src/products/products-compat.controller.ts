import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function pickInt(v: any, def: number) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

@Controller('products')
export class ProductsCompatController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  async search(
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = pickInt(page, 1);
    const l = Math.min(100, pickInt(limit, 20));
    const off = (p - 1) * l;
    const term = `%${(q || '').trim().replace(/\s+/g, '%')}%`;

    // 1) cmr."Product"
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT id,
               COALESCE(name, nombre, '') AS name,
               COALESCE(sku, '')         AS sku,
               COALESCE(uom, 'un')       AS uom,
               COALESCE(tipo, 'simple')  AS tipo,
               COALESCE("costoStd", 0)   AS "costoStd",
               COALESCE("precioLista",0) AS "precioLista",
               COALESCE(activo, true)    AS activo
        FROM cmr."Product"
        WHERE ($1='%%' OR COALESCE(name,nombre,'') ILIKE $1 OR COALESCE(sku,'') ILIKE $1)
        ORDER BY name ASC
        LIMIT $2 OFFSET $3
        `, term, l, off,
      );
      const total = Number((await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT COUNT(*)::int AS c
        FROM cmr."Product"
        WHERE ($1='%%' OR COALESCE(name,nombre,'') ILIKE $1 OR COALESCE(sku,'') ILIKE $1)
        `, term,
      ))[0]?.c ?? 0);
      return { total, items: rows };
    } catch (_) {}

    // 2) public.products
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT id,
               COALESCE(name,'') AS name,
               COALESCE(sku,'')  AS sku,
               COALESCE(uom,'un') AS uom,
               'simple'::text     AS tipo,
               COALESCE(cost,0)   AS "costoStd",
               COALESCE(price,0)  AS "precioLista",
               true               AS activo
        FROM public.products
        WHERE ($1='%%' OR name ILIKE $1 OR COALESCE(sku,'') ILIKE $1)
        ORDER BY name ASC
        LIMIT $2 OFFSET $3
        `, term, l, off,
      );
      const total = Number((await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT COUNT(*)::int AS c
        FROM public.products
        WHERE ($1='%%' OR name ILIKE $1 OR COALESCE(sku,'') ILIKE $1)
        `, term,
      ))[0]?.c ?? 0);
      return { total, items: rows };
    } catch (_) {}

    return { total: 0, items: [] };
  }

  @Get()
  async list(@Query('limit') limit = '100') {
    return this.search('', '1', limit);
  }
}
