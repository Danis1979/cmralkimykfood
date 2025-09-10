import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
// backend/api/src/reports/reports.inventory.moves.csv.controller.ts
import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

type Dir = 'asc' | 'desc';

function buildOrderBy(order?: string) {
  // ?order=field:dir,field2:dir2
  const pairs = (order || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(tok => {
      const [fRaw, dRaw] = tok.split(':');
      const field = String(fRaw ?? '').trim().toLowerCase();
      const dir = (String(dRaw ?? 'asc').trim().toLowerCase() as Dir);
      return field ? { field, dir: dir === 'desc' ? 'desc' : 'asc' as Dir } : null;
    })
    .filter(Boolean) as Array<{ field: string; dir: Dir }>;

  const map = (f: string, dir: Dir) => {
    switch (f) {
      case 'date':
      case 'createdat': return { createdAt: dir };
      case 'qty':       return { qty: dir };
      case 'sku':       return { product: { sku: dir } };
      case 'name':      return { product: { name: dir } };
      case 'direction': return { direction: dir };
      case 'reason':    return { reason: dir };
      default:          return { [f]: dir } as any;
    }
  };

  const orderBy = pairs.map(p => map(p.field, p.dir));
  return orderBy.length ? orderBy : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
}

function parseMonth(s: string) {
  const m = /^\d{4}-\d{2}$/.exec(s);
  if (!m) return null;
  const [y, mm] = s.split('-').map(Number);
  return new Date(Date.UTC(y, mm - 1, 1, 0, 0, 0));
}
function parseDay(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsInventoryMovesCsvController {
  constructor(private prisma: PrismaService) {}

  @Get('inventory-moves.csv')
  async inventoryMovesCsv(
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sku') sku?: string,
    @Query('direction') direction?: 'IN' | 'OUT',
    @Query('order') order?: string,
  ) {
    try {
      // Rango -> createdAt gte / lt
      let gte: Date | undefined;
      let lt: Date | undefined;

      if (from) {
        if (/^\d{4}-\d{2}$/.test(from)) gte = parseMonth(from)!;
        else gte = parseDay(from) || undefined;
      }
      if (to) {
        if (/^\d{4}-\d{2}$/.test(to)) {
          const start = parseMonth(to)!;
          lt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0));
        } else {
          const d = parseDay(to);
          if (d) lt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
        }
      }

      const where: Prisma.InventoryMoveWhereInput = {};
      if (gte || lt) {
        (where as any).createdAt = {};
        if (gte) (where as any).createdAt.gte = gte;
        if (lt) (where as any).createdAt.lt = lt;
      }
      if (sku && sku.trim()) (where as any).product = { is: { sku: sku.trim() } };
      if (direction && /^(IN|OUT)$/i.test(direction)) where.direction = direction.toUpperCase() as any;

      const orderBy = buildOrderBy(order);

      const rows = await this.prisma.inventoryMove.findMany({
        where,
        include: { product: true },
        orderBy,
        take: 10_000,
      });

      const header = ['BatchId','Date','Direction','Sku','Name','Qty','Reason'].join(',');
      const lines = rows.map(r => {
        const batchId = (r as any).refId ?? (r as any).batchId ?? '';
        const dateIso = (r as any).createdAt?.toISOString?.() || (r as any).date?.toISOString?.() || '';
        const skuVal  = (r as any).product?.sku ?? '';
        const nameVal = ((r as any).product?.name ?? '').replace(/"/g,'""').replace(/[\r\n]+/g,' ').trim();
        const reason  = (r.reason ?? '').replace(/"/g,'""').replace(/[\r\n]+/g,' ').trim();

        const cols = [
          batchId,
          dateIso,
          r.direction,
          skuVal,
          nameVal,
          r.qty,
          reason,
        ].map(v => (typeof v === 'string' && (v.includes(',') || v.includes('"'))) ? `"${v}"` : String(v));

        return cols.join(',');
      });

      const csv = [header, ...lines].join('\n');

      const fname = (() => {
        const f = from ? from.replace(/:/g, '') : '';
        const t = to ? to.replace(/:/g, '') : '';
        const suffix = f && t ? `${f}_${t}` : (f || t || 'all');
        return `inventory-moves_${suffix}.csv`;
      })();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition','attachment; filename="inventory-moves.csv"');
      return csv;
    } catch (e: any) {
      throw new HttpException(
        { message: 'inventory-moves.csv failed', detail: e?.message || String(e) },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}