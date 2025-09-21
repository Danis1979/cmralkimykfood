import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function pickInt(v: any, def: number) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

@Controller('suppliers')
export class SuppliersController {
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

    // 1) cmr."Supplier"
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT id,
               COALESCE(name, nombre, '') AS nombre,
               COALESCE(cuit, tax_id, '') AS cuit,
               COALESCE(address, direccion, '') AS direccion,
               COALESCE(email, '') AS email,
               COALESCE(phone, telefono, '') AS telefono
        FROM cmr."Supplier"
        WHERE ($1='%%' OR COALESCE(name,nombre,'') ILIKE $1 OR COALESCE(cuit,tax_id,'') ILIKE $1)
        ORDER BY nombre ASC
        LIMIT $2 OFFSET $3
        `, term, l, off,
      );
      const total = Number((await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT COUNT(*)::int AS c
        FROM cmr."Supplier"
        WHERE ($1='%%' OR COALESCE(name,nombre,'') ILIKE $1 OR COALESCE(cuit,tax_id,'') ILIKE $1)
        `, term,
      ))[0]?.c ?? 0);
      return { total, items: rows };
    } catch (_) {}

    // 2) public.suppliers
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT id,
               COALESCE(name,'') AS nombre,
               COALESCE(tax_id,'') AS cuit,
               COALESCE(address,'') AS direccion,
               COALESCE(email,'') AS email,
               COALESCE(phone,'') AS telefono
        FROM public.suppliers
        WHERE ($1='%%' OR name ILIKE $1 OR COALESCE(tax_id,'') ILIKE $1)
        ORDER BY nombre ASC
        LIMIT $2 OFFSET $3
        `, term, l, off,
      );
      const total = Number((await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT COUNT(*)::int AS c
        FROM public.suppliers
        WHERE ($1='%%' OR name ILIKE $1 OR COALESCE(tax_id,'') ILIKE $1)
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
