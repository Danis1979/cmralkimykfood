import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('clients')
export class ClientsController {
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

    const order = ['name','-name','id','-id'].includes(String(sort))
      ? String(sort) : 'name';
    const orderSql = order.startsWith('-') ? `${order.slice(1)} DESC` : `${order} ASC`;

    let rows = await this.q(
      `SELECT c.id, c.name AS nombre, c.cuit, c.address AS direccion, c.email, c.phone AS telefono
       FROM cmr."Client" c
       WHERE ($1='' OR c.name ILIKE $2 OR c.cuit ILIKE $2)
       ORDER BY ${orderSql}
       LIMIT $3 OFFSET $4`,
      q, like, l, (p - 1) * l
    );

    if (!rows.length) {
      rows = await this.q(
        `SELECT id, nombre, cuit, direccion, email, telefono
         FROM public.clients
         WHERE ($1='' OR nombre ILIKE $2 OR cuit ILIKE $2)
         ORDER BY ${orderSql.replace('name','nombre')}
         LIMIT $3 OFFSET $4`,
        q, like, l, (p - 1) * l
      );
    }

    return { page: p, items: rows };
  }

  @Post()
  async create(@Body() body: any) {
    const r1 = await this.q(
      `INSERT INTO cmr."Client"(name, cuit, address, email, phone)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name AS nombre, cuit, address AS direccion, email, phone AS telefono`,
      body.nombre || body.name || '',
      body.cuit || '',
      body.direccion || body.address || '',
      body.email || '',
      body.telefono || body.phone || ''
    );
    if (r1.length) return r1[0];

    const r2 = await this.q(
      `INSERT INTO public.clients(nombre, cuit, direccion, email, telefono)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, nombre, cuit, direccion, email, telefono`,
      body.nombre || body.name || '',
      body.cuit || '',
      body.direccion || body.address || '',
      body.email || '',
      body.telefono || body.phone || ''
    );
    if (r2.length) return r2[0];

    return { ok: false };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const oid = Number(id);
    const r1 = await this.q(
      `UPDATE cmr."Client"
         SET name=$2, cuit=$3, address=$4, email=$5, phone=$6
       WHERE id=$1
       RETURNING id, name AS nombre, cuit, address AS direccion, email, phone AS telefono`,
      oid,
      body.nombre || body.name || '',
      body.cuit || '',
      body.direccion || body.address || '',
      body.email || '',
      body.telefono || body.phone || ''
    );
    if (r1.length) return r1[0];

    const r2 = await this.q(
      `UPDATE public.clients
         SET nombre=$2, cuit=$3, direccion=$4, email=$5, telefono=$6
       WHERE id=$1
       RETURNING id, nombre, cuit, direccion, email, telefono`,
      oid,
      body.nombre || body.name || '',
      body.cuit || '',
      body.direccion || body.address || '',
      body.email || '',
      body.telefono || body.phone || ''
    );
    if (r2.length) return r2[0];

    return { ok: false };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const oid = Number(id);
    const r1 = await this.q(`DELETE FROM cmr."Client" WHERE id=$1 RETURNING id`, oid);
    if (r1.length) return { id: r1[0].id, ok: true };
    const r2 = await this.q(`DELETE FROM public.clients WHERE id=$1 RETURNING id`, oid);
    if (r2.length) return { id: r2[0].id, ok: true };
    return { id: oid, ok: false };
  }
}
