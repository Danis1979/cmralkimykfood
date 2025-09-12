// @ts-nocheck
import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function parseRange(from?: string, to?: string) {
  const now = new Date();
  let start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  let end = new Date(now.toISOString());

  const parseMonth = (s: string): Date | null => {
    const [yStr, mStr] = s.split('-');
    const y = Number(yStr), m = Number(mStr);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
    return new Date(Date.UTC(y, m - 1, 1));
  };

  if (from) {
    if (from.length === 7) {
      const mf = parseMonth(from);
      if (mf) start = mf;
    } else {
      const df = new Date(from);
      if (!isNaN(df.getTime())) start = df;
    }
  }

  if (to) {
    if (to.length === 7) {
      const mt = parseMonth(to);
      if (mt) end = new Date(Date.UTC(mt.getUTCFullYear(), mt.getUTCMonth() + 1, 1));
    } else {
      const dt = new Date(to);
      if (!isNaN(dt.getTime())) end = dt;
    }
  }
  return { start, end };
}

type Row = { sku: string; name: string; qty: number; revenue: number; cost: number; margin: number; marginPct: number };

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsMarginByProductController {
  constructor(private prisma: PrismaService) {}

  @Get('margin-by-product')
  async marginByProduct(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limitStr?: string) {
    const { start, end } = parseRange(from, to);
    const lim = Math.max(0, Number(limitStr || 0));

    const sales = await (this.prisma as any).sale.findMany({
      where: { status: { not: 'ANULADA' as any }, createdAt: { gte: start, lt: end } },
      select: {
        items: {
          select: { qty: true, price: true, product: { select: { sku: true, name: true, costStd: true } } },
        },
      },
    });

    const map = new Map<string, Row>();
    for (const s of sales) {
      for (const it of s.items || []) {
        const sku = it.product?.sku || 'UNKNOWN';
        const name = it.product?.name || 'UNKNOWN';
        const qty = Number(it.qty);
        const price = Number(it.price);
        const costStd = Number(it.product?.costStd || 0);

        const revenue = price * qty;
        const cost = costStd * qty;

        const acc = map.get(sku) || { sku, name, qty: 0, revenue: 0, cost: 0, margin: 0, marginPct: 0 };
        acc.qty += qty;
        acc.revenue += revenue;
        acc.cost += cost;
        acc.margin = acc.revenue - acc.cost;
        acc.marginPct = acc.revenue > 0 ? Math.round((acc.margin / acc.revenue) * 10000) / 100 : 0;
        map.set(sku, acc);
      }
    }

    let items = Array.from(map.values()).sort((a, b) => b.margin - a.margin);
    if (lim > 0) items = items.slice(0, lim);

    const totals = items.reduce(
      (acc, r) => ({
        qty: acc.qty + r.qty,
        revenue: acc.revenue + r.revenue,
        cost: acc.cost + r.cost,
        margin: acc.margin + r.margin,
        marginPct: 0,
      }),
      { qty: 0, revenue: 0, cost: 0, margin: 0, marginPct: 0 },
    );
    totals.marginPct = totals.revenue > 0 ? Math.round((totals.margin / totals.revenue) * 10000) / 100 : 0;

    return { range: { from: start.toISOString(), to: end.toISOString() }, totalProducts: items.length, totals, items };
  }
}
