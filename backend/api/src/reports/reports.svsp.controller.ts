import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function checkKey(k?: string) {
  const expected = process.env.API_KEY || 'supersecreta-123';
  if (expected && k !== expected) throw new UnauthorizedException();
}

function parseRange(from?: string, to?: string) {
  const now = new Date();
  const y = now.getFullYear();
  const startDefault = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
  const endDefault = now;

  const start = from
    ? (from.match(/^\d{4}-\d{2}$/)
        ? new Date(Date.UTC(Number(from.slice(0,4)), Number(from.slice(5,7))-1, 1, 0,0,0))
        : new Date(from))
    : startDefault;

  const end = to
    ? (to.match(/^\d{4}-\d{2}$/)
        ? new Date(Date.UTC(Number(to.slice(0,4)), Number(to.slice(5,7))-1 + 1, 1, 0,0,0)) // mes siguiente
        : new Date(to))
    : endDefault;

  return { start, end };
}

function monthKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth()+1).toString().padStart(2,'0');
  return `${y}-${m}`;
}

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsSalesVsPurchasesController {
  constructor(private prisma: PrismaService) {}

  @Get('sales-vs-purchases')
  async svsp(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Headers('x-api-key') key?: string,
  ) {
    checkKey(key);
    const { start, end } = parseRange(from, to);

    const [sales, purchases] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          // si quisieras filtrar status: { in: ['EMITIDA','CERRADA'] as any }
        },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.purchase.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const map = new Map<string, { month: string; sales: number; purchases: number; net: number }>();

    for (const s of sales) {
      const k = monthKey(s.createdAt);
      const row = map.get(k) || { month: k, sales: 0, purchases: 0, net: 0 };
      row.sales += Number(s.total || 0);
      map.set(k, row);
    }
    for (const p of purchases) {
      const k = monthKey(p.createdAt);
      const row = map.get(k) || { month: k, sales: 0, purchases: 0, net: 0 };
      row.purchases += Number(p.total || 0);
      map.set(k, row);
    }
    const items = Array.from(map.values())
      .map(r => ({ ...r, net: r.sales - r.purchases }))
      .sort((a,b) => a.month.localeCompare(b.month));

    const totals = items.reduce((acc, r) => {
      acc.sales += r.sales;
      acc.purchases += r.purchases;
      acc.net += r.net;
      return acc;
    }, { sales: 0, purchases: 0, net: 0 });

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totalMonths: items.length,
      totals,
      items,
    };
  }
}
