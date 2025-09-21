import { Controller, Get, Post, Put, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { DbService } from '../db.service';

function normSupplier(row: any) {
  return {
    id: row.id,
    nombre: row.nombre ?? row.name ?? '',
    cuit: row.cuit ?? row.taxId ?? '',
    direccion: row.direccion ?? row.address ?? '',
    email: row.email ?? '',
    telefono: row.telefono ?? row.phone ?? '',
  };
}

@Controller('suppliers')
export class SuppliersCompatController {
  constructor(private readonly db: DbService) {}

  private async target(): Promise<'cmr'|'public'|null> {
    const q = await this.db.$queryRawUnsafe<any[]>(
      `select
         (to_regclass('cmr."Supplier"') is not null) as cmr_ok,
         (to_regclass('public.suppliers') is not null) as pub_ok`
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
        `select id, name, "taxId", address, email, phone
         from cmr."Supplier"
         order by id desc
         offset $1 limit $2`, off, l);
      return { items: rows.map(r => normSupplier({
        id: r.id, name: r.name, taxId: r.taxId, address: r.address,
        email: r.email, phone: r.phone
      })) };
    } else if (t === 'public') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `select id, nombre, cuit, direccion, email, telefono
         from public.suppliers
         order by id desc
         offset $1 limit $2`, off, l);
      return { items: rows.map(normSupplier) };
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
        `select id, name, "taxId", address, email, phone
         from cmr."Supplier"
         where $1 = '%%' or (name ilike $1 or coalesce("taxId",'') ilike $1)
         order by name asc
         limit $2`, term, l);
      return { items: rows.map(r => normSupplier({
        id: r.id, name: r.name, taxId: r.taxId, address: r.address,
        email: r.email, phone: r.phone
      })) };
    } else if (t === 'public') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `select id, nombre, cuit, direccion, email, telefono
         from public.suppliers
         where $1 = '%%' or (nombre ilike $1 or coalesce(cuit,'') ilike $1)
         order by nombre asc
         limit $2`, term, l);
      return { items: rows.map(normSupplier) };
    }
    return { items: [] };
  }

  @Post('')
  async create(@Body() body: any) {
    const t = await this.target();
    const nombre = (body.nombre ?? body.name ?? '').trim();
    if (!nombre) throw new BadRequestException('nombre requerido');

    if (t === 'cmr') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `insert into cmr."Supplier"(name, "taxId", address, email, phone)
         values ($1, $2, $3, $4, $5)
         returning id, name, "taxId", address, email, phone`,
        nombre, body.cuit ?? body.taxId ?? null,
        body.direccion ?? body.address ?? null,
        body.email ?? null,
        body.telefono ?? body.phone ?? null);
      const r = rows?.[0];
      return normSupplier({ id: r.id, name: r.name, taxId: r.taxId, address: r.address,
        email: r.email, phone: r.phone });
    } else if (t === 'public') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `insert into public.suppliers(nombre, cuit, direccion, email, telefono)
         values ($1, $2, $3, $4, $5)
         returning id, nombre, cuit, direccion, email, telefono`,
        nombre, body.cuit ?? null, body.direccion ?? null,
        body.email ?? null, body.telefono ?? null);
      return normSupplier(rows?.[0]);
    }
    throw new BadRequestException('No hay tabla de proveedores');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const t = await this.target();
    const oid = Number(id);
    if (!Number.isFinite(oid)) throw new BadRequestException('id inválido');

    if (t === 'cmr') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `update cmr."Supplier"
           set name=$2, "taxId"=$3, address=$4, email=$5, phone=$6
         where id=$1
         returning id, name, "taxId", address, email, phone`,
        oid,
        (body.nombre ?? body.name ?? null),
        (body.cuit ?? body.taxId ?? null),
        (body.direccion ?? body.address ?? null),
        (body.email ?? null),
        (body.telefono ?? body.phone ?? null)
      );
      const r = rows?.[0];
      return normSupplier({ id: r.id, name: r.name, taxId: r.taxId, address: r.address,
        email: r.email, phone: r.phone });
    } else if (t === 'public') {
      const rows = await this.db.$queryRawUnsafe<any[]>(
        `update public.suppliers
           set nombre=$2, cuit=$3, direccion=$4, email=$5, telefono=$6
         where id=$1
         returning id, nombre, cuit, direccion, email, telefono`,
        oid,
        (body.nombre ?? null),
        (body.cuit ?? null),
        (body.direccion ?? null),
        (body.email ?? null),
        (body.telefono ?? null)
      );
      return normSupplier(rows?.[0]);
    }
    throw new BadRequestException('No hay tabla de proveedores');
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const t = await this.target();
    const oid = Number(id);
    if (!Number.isFinite(oid)) throw new BadRequestException('id inválido');

    if (t === 'cmr') {
      await this.db.$executeRawUnsafe(`delete from cmr."Supplier" where id=$1`, oid);
      return { ok: true };
    } else if (t === 'public') {
      await this.db.$executeRawUnsafe(`delete from public.suppliers where id=$1`, oid);
      return { ok: true };
    }
    throw new BadRequestException('No hay tabla de proveedores');
  }
}
