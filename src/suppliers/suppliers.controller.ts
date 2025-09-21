import { Controller, Get, Post, Put, Delete, Query, Body, Param, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type TableRef = { schema: string; table: string; nameCol: string | null; columns: string[] };

async function detectTable(prisma: PrismaService, candidates: {schema:string; table:string; nameCols?:string[]}[]): Promise<TableRef|null> {
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
      const colNames = cols.map(x => x.column_name);
      const nameCol = (c.nameCols ?? ['name','nombre']).find(n => colNames.includes(n)) ?? null;
      return { schema: c.schema, table: c.table, nameCol, columns: colNames };
    }
  }
  return null;
}

function orderByFragment(sort: string|undefined, allowed: string[]): string {
  if (!sort) return '';
  const desc = sort.startsWith('-');
  const key = desc ? sort.slice(1) : sort;
  if (!allowed.includes(key)) return '';
  const dir = desc ? 'DESC' : 'ASC';
  return ` ORDER BY "${key}" ${dir} `;
}

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly prisma: PrismaService) {}

  private async tb(): Promise<TableRef> {
    const t = await detectTable(this.prisma, [
      { schema: 'cmr', table: 'Supplier', nameCols: ['name','nombre'] },
      { schema: 'public', table: 'suppliers', nameCols: ['name','nombre'] },
      { schema: 'public', table: 'Supplier', nameCols: ['name','nombre'] },
    ]);
    if (!t) throw new BadRequestException('No hay tabla de proveedores (cmr."Supplier" o public.suppliers)');
    return t;
  }

  @Get('search')
  async search(@Query('page') page='1', @Query('limit') limit='20', @Query('q') q='', @Query('sort') sort?: string) {
    const p = Math.max(1, parseInt(page,10)||1);
    const l = Math.min(100, Math.max(1, parseInt(limit,10)||20));
    const off = (p-1)*l;
    const t = await this.tb();

    const where: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (q) {
      if (t.nameCol) where.push(`("${t.nameCol}" ILIKE '%'||$${pi}||'%')`);
      else where.push(`CAST(id AS TEXT) ILIKE '%'||$${pi}||'%'`);
      params.push(q); pi++;
    }

    const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const ordSql = orderByFragment(sort, ['id', ...(t.nameCol? [t.nameCol]:[])]) || (t.nameCol ? ` ORDER BY "${t.nameCol}" ASC ` : ` ORDER BY id DESC `);

    const items = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${t.schema}"."${t.table}" ${whereSql} ${ordSql} LIMIT $${pi} OFFSET $${pi+1}`,
      ...params, l, off
    );
    const totalRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS c FROM "${t.schema}"."${t.table}" ${whereSql}`, ...params
    );
    return { total: totalRows[0]?.c ?? items.length, page: p, items };
  }

  @Get()
  async list() {
    const t = await this.tb();
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${t.schema}"."${t.table}" ORDER BY id DESC LIMIT 500`
    );
  }

  @Post()
  async create(@Body() body: any) {
    const t = await this.tb();
    const cols: string[] = [];
    const vals: any[] = [];

    const want: Record<string, any> = {
      name: body.nombre ?? body.name ?? null,
      nombre: body.nombre ?? null,
      cuit: body.cuit ?? body.taxId ?? null,
      address: body.direccion ?? body.address ?? null,
      direccion: body.direccion ?? null,
      email: body.email ?? null,
      phone: body.telefono ?? body.phone ?? null,
      telefono: body.telefono ?? null,
      activo: body.activo ?? body.active ?? true,
    };
    for (const [k,v] of Object.entries(want)) if (v !== null && t.columns.includes(k)) { cols.push(`"${k}"`); vals.push(v); }
    if (!cols.length) throw new BadRequestException('No hay columnas compatibles para insertar');

    const placeholders = cols.map((_c,i)=>`$${i+1}`).join(',');
    const inserted = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${t.schema}"."${t.table}" (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`, ...vals
    );
    return inserted[0] ?? {};
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const t = await this.tb();
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    const want: Record<string, any> = {
      name: body.nombre ?? body.name ?? null,
      nombre: body.nombre ?? null,
      cuit: body.cuit ?? body.taxId ?? null,
      address: body.direccion ?? body.address ?? null,
      direccion: body.direccion ?? null,
      email: body.email ?? null,
      phone: body.telefono ?? body.phone ?? null,
      telefono: body.telefono ?? null,
      activo: typeof body.activo==='boolean' ? body.activo : (typeof body.active==='boolean'? body.active : null),
    };
    for (const [k,v] of Object.entries(want)) if (v !== null && t.columns.includes(k)) { sets.push(`"${k}"=$${i++}`); vals.push(v); }
    if (!sets.length) throw new BadRequestException('Sin cambios');

    const updated = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${t.schema}"."${t.table}" SET ${sets.join(',')} WHERE id=$${i} RETURNING *`,
      ...vals, Number(id)
    );
    return updated[0] ?? {};
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const t = await this.tb();
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "${t.schema}"."${t.table}" WHERE id=$1`, Number(id)
    );
    return { ok: true };
  }
}
