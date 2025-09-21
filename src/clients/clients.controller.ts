import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function pickInt(v: any, def: number) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

@Controller('clients')
export class ClientsController {
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

    // 1) cmr."Client"
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT id,
               COALESCE(name, nombre, client, '')        AS nombre,
               COALESCE(cuit, "taxId", '')               AS cuit,
               COALESCE(direccion, address, '')          AS direccion,
               COALESCE("paymentTerms", condicionesPago, '') AS "condicionesPago",
               COALESCE(email, '')                       AS email,
               COALESCE(telefono, phone, '')             AS telefono
        FROM cmr."Client"
        WHERE
          ($1 = '%%' OR
           COALESCE(name, nombre, client, '') ILIKE $1 OR
           COALESCE(cuit, "taxId", '') ILIKE $1)
        ORDER BY nombre ASC
        LIMIT $2 OFFSET $3
        `,
        term, l, off,
      );
      const total = Number((await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT COUNT(*)::int AS c
        FROM cmr."Client"
        WHERE
          ($1 = '%%' OR
           COALESCE(name, nombre, client, '') ILIKE $1 OR
           COALESCE(cuit, "taxId", '') ILIKE $1)
        `,
        term,
      ))[0]?.c ?? 0);
      return { total, items: rows };
    } catch (_) {}

    // 2) public.clients
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT id,
               COALESCE(name, '')        AS nombre,
               COALESCE(tax_id, cuit, '') AS cuit,
               COALESCE(address, '')     AS direccion,
               ''                         AS "condicionesPago",
               COALESCE(email, '')       AS email,
               COALESCE(phone, '')       AS telefono
        FROM public.clients
        WHERE ($1 = '%%' OR name ILIKE $1 OR COALESCE(tax_id,'') ILIKE $1)
        ORDER BY nombre ASC
        LIMIT $2 OFFSET $3
        `,
        term, l, off,
      );
      const total = Number((await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS c
         FROM public.clients
         WHERE ($1 = '%%' OR name ILIKE $1 OR COALESCE(tax_id,'') ILIKE $1)`,
        term,
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
