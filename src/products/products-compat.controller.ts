import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type TableRef = { schema: string; table: string; nameCol: string|null; columns: string[] };

async function detect(prisma: PrismaService): Promise<TableRef|null> {
  const candidates = [
    { schema: 'cmr', table: 'Product' },
    { schema: 'public', table: 'products' },
    { schema: 'public', table: 'Product' },
  ];
  for (const c of candidates) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2 LIMIT 1`,
      c.schema, c.table
    );
    if (rows.length) {
      const cols = await prisma.$queryRawUnsafe<any[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
        c.schema, c.table
      );
      const names = cols.map(r => r.column_name);
      const nameCol = names.includes('name') ? 'name' : (names.includes('nombre') ? 'nombre' : null);
      return { schema: c.schema, table: c.table, nameCol, columns: names };
    }
  }
  return null;
}

@Controller('products')
export class ProductsCompatController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const t = await detect(this.prisma);
    if (!t) throw new BadRequestException('No hay tabla de productos');
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${t.schema}"."${t.table}" ORDER BY id DESC LIMIT 500`
    );
  }

  @Get('search')
  async search(@Query('page') page='1', @Query('limit') limit='20', @Query('q') q='', @Query('sort') sort?: string) {
    const p = Math.max(1, parseInt(page,10)||1);
    const l = Math.min(100, Math.max(1, parseInt(limit,10)||20));
    const off = (p-1)*l;
    const t = await detect(this.prisma);
    if (!t) throw new BadRequestException('No hay tabla de productos');

    const where: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (q) {
      if (t.nameCol) where.push(`("${t.nameCol}" ILIKE '%'||$${pi}||'%' OR CAST(id AS TEXT) ILIKE '%'||$${pi}||'%')`);
      else where.push(`CAST(id AS TEXT) ILIKE '%'||$${pi}||'%'`);
      params.push(q); pi++;
    }

    const ordKey = (sort && (sort.startsWith('-')? sort.slice(1): sort)) || (t.nameCol ?? 'id');
    const ordDir = (sort && sort.startsWith('-')) ? 'DESC' : 'ASC';
    const ord = t.columns.includes(ordKey) ? `"${ordKey}" ${ordDir}` : (t.nameCol ? `"${t.nameCol}" ASC` : 'id DESC');

    const items = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${t.schema}"."${t.table}" ${where.length? 'WHERE '+where.join(' AND '):''}
       ORDER BY ${ord}
       LIMIT $${pi} OFFSET $${pi+1}`,
      ...params, l, off
    );
    const totalRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS c FROM "${t.schema}"."${t.table}" ${where.length? 'WHERE '+where.join(' AND '):''}`, ...params
    );
    return { total: totalRows[0]?.c ?? items.length, page: p, items };
  }
}
