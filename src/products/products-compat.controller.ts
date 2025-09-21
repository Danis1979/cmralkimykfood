import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('products')
export class ProductsCompatController {
  constructor(private readonly prisma: PrismaService) {}

  private async q<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    try { return await this.prisma.$queryRawUnsafe<T[]>(sql, ...params); }
    catch { return []; }
  }

  @Get('search')
  async search(
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sort') sort = 'name'
  ) {
    const p = Math.max(parseInt(page as string, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
    const like = `%${String(q || '').replace(/[%_]/g, s => '\\' + s)}%`;

    const order = ['name','-name','sku','-sku','id','-id'].includes(String(sort))
      ? String(sort) : 'name';
    const orderSql = order.startsWith('-') ? `${order.slice(1)} DESC` : `${order} ASC`;

    let rows = await this.q(
      `SELECT p.id, p.name, p.sku, p.uom,
              COALESCE(p."tipo",'simple') AS tipo,
              COALESCE(p."costoStd",0) AS "costoStd",
              COALESCE(p."precioLista",0) AS "precioLista",
              COALESCE(p."activo",true) AS activo
         FROM cmr."Product" p
        WHERE ($1='' OR p.name ILIKE $2 OR p.sku ILIKE $2)
        ORDER BY ${orderSql}
        LIMIT $3 OFFSET $4`,
      q, like, l, (p - 1) * l
    );

    if (!rows.length) {
      rows = await this.q(
        `SELECT id, name, sku, uom,
                COALESCE(tipo,'simple') AS tipo,
                COALESCE("costoStd",0) AS "costoStd",
                COALESCE("precioLista",0) AS "precioLista",
                COALESCE(activo,true) AS activo
           FROM public.products
          WHERE ($1='' OR name ILIKE $2 OR sku ILIKE $2)
          ORDER BY ${orderSql}
          LIMIT $3 OFFSET $4`,
        q, like, l, (p - 1) * l
      );
    }

    return { page: p, items: rows };
  }
}
