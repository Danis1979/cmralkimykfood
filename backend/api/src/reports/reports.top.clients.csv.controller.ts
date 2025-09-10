import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
// backend/api/src/reports/reports.top.clients.csv.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

type Dir = 'asc' | 'desc';

/** Acepta YYYY-MM o fecha completa, devuelve { start(gte), end(lt) } */
function parseRange(from?: string, to?: string) {
  const now = new Date();
  let start: Date | undefined;
  let end: Date | undefined;

  const parseMonthOrDay = (s?: string) => {
    if (!s) return null;
    if (/^\d{4}-\d{2}$/.test(s)) {
      const y = Number(s.slice(0, 4));
      const m = Number(s.slice(5, 7)) - 1;
      return new Date(Date.UTC(y, m, 1, 0, 0, 0));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const mf = parseMonthOrDay(from);
  const mt = parseMonthOrDay(to);

  if (mf) start = mf;
  if (mt) {
    // si vino mes (YYYY-MM), fin = primer día del mes siguiente 00:00Z
    if (to && /^\d{4}-\d{2}$/.test(to)) {
      end = new Date(Date.UTC(mt.getUTCFullYear(), mt.getUTCMonth() + 1, 1, 0, 0, 0));
    } else {
      // si vino día -> usamos lt = next day 00:00Z
      end = new Date(Date.UTC(mt.getUTCFullYear(), mt.getUTCMonth(), mt.getUTCDate() + 1, 0, 0, 0));
    }
  }

  if (!start && !end) end = now;
  return { start, end };
}

/** order parsing: "revenue:desc,client:asc" -> [['revenue','desc'], ...] */
function parseOrderPairs(order?: string, def: Array<[string, Dir]> = []) {
  const pairs = (order || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(tok => {
      const [fRaw, dRaw] = tok.split(':');
      const field = String(fRaw ?? '').trim();
      const dir = (String(dRaw ?? 'asc').trim().toLowerCase() as Dir);
      return field ? [field, (dir === 'desc' ? 'desc' : 'asc') as Dir] as [string, Dir] : null;
    })
    .filter(Boolean) as Array<[string, Dir]>;
  return pairs.length ? pairs : def;
}

/** Ordena un arreglo por múltiples campos (numérico si ambos son números) */
function sortByPairs<T extends Record<string, any>>(items: T[], pairs: Array<[string, Dir]>) {
  const cmp = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0);
  items.sort((a, b) => {
    for (const [field, dir] of pairs) {
      const av = a?.[field];
      const bv = b?.[field];
      const numA = typeof av === 'number' ? av : Number(av);
      const numB = typeof bv === 'number' ? bv : Number(bv);
      const bothNum = !Number.isNaN(numA) && !Number.isNaN(numB);
      const c = bothNum ? cmp(numA, numB) : cmp(String(av ?? ''), String(bv ?? ''));
      if (c !== 0) return dir === 'desc' ? -c : c;
    }
    return 0;
  });
  return items;
}

/** Escapa CSV básico (doble comillas) */
function csv(s?: string) {
  return (s ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ').trim();
}

@ApiTags('Reports')
@Controller('reports')
@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsTopClientsCsvController {
  constructor(private prisma: PrismaService) {}

  @ApiQuery({ name: 'from', required: false, example: '2025-09 ó 2025-09-01' })
  @ApiQuery({ name: 'to', required: false, example: '2025-09 ó 2025-09-30' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'order', required: false, example: 'revenue:desc,salesCount:desc,client:asc' })
  @Get('top-clients.csv')
  async topClientsCsv(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitStr?: string,
    @Query('order') order?: string,
    @Res() res?: Response,
  ) {
    const { start, end } = parseRange(from, to);
    const limit = Math.max(1, Number(limitStr ?? '20') | 0);

    // Traemos ventas con cliente e items, dentro del rango
    const sales = await this.prisma.sale.findMany({
      where: {
        ...(start || end ? { createdAt: { ...(start && { gte: start }), ...(end && { lt: end }) } } : {}),
      },
      include: { client: true, items: true },
    });

    // Agregación por cliente
    const map = new Map<
      string,
      { clientId: string; client: string; email: string; revenue: number; salesCount: number; avgTicket: number }
    >();

    for (const s of sales) {
      const revenue = (s.items || []).reduce(
        (acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0),
        0,
      );
      if (!s.clientId) continue;
      if (!map.has(s.clientId)) {
        map.set(s.clientId, {
          clientId: s.clientId,
          client: s.client?.name || 'UNKNOWN',
          email: s.client?.email || '',
          revenue: 0,
          salesCount: 0,
          avgTicket: 0,
        });
      }
      const a = map.get(s.clientId)!;
      a.revenue += revenue;
      a.salesCount += 1;
    }

    const items = Array.from(map.values()).map(i => ({
      ...i,
      avgTicket: i.salesCount ? i.revenue / i.salesCount : 0,
    }));

    // Orden: por defecto revenue desc, salesCount desc, avgTicket desc, client asc
    const pairs = parseOrderPairs(order, [
      ['revenue', 'desc'],
      ['salesCount', 'desc'],
      ['avgTicket', 'desc'],
      ['client', 'asc'],
    ]);
    sortByPairs(items, pairs);

    const top = items.slice(0, limit);

    // CSV
    const header = 'ClientId,Client,Email,Revenue,SalesCount,AvgTicket';
    const rows = top.map(
      (i) =>
        `${i.clientId},"${csv(i.client)}",${csv(i.email)},${i.revenue},${i.salesCount},${i.avgTicket.toFixed(2)}`,
    );

    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', 'attachment; filename="top-clients.csv"');
    res!.send([header, ...rows].join('\n'));
  }
}