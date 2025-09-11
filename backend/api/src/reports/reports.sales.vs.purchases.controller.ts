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

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsSalesVsPurchasesController {
  constructor(private prisma: PrismaService) {}

  @Get('sales-vs-purchases')
  async salesVsPurchases(@Query('from') from?: string, @Query('to') to?: string) {
    const { start, end } = parseRange(from, to);

    const sales = await (this.prisma as any).sale.findMany({
      where: { status: { not: 'ANULADA' as any }, createdAt: { gte: start, lt: end } },
      select: { createdAt: true, items: { select: { qty: true, price: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const purchases = await (this.prisma as any).purchase.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, items: { select: { qty: true, price: true } } },
      orderBy: { createdAt: 'asc' },
    });

    type Row = { month: string; sales: number; purchases: number; net: number };
    const bucket = new Map<string, Row>();

    const add = (d: Date, amount: number, key: 'sales' | 'purchases') => {
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!bucket.has(ym)) bucket.set(ym, { month: ym, sales: 0, purchases: 0, net: 0 });
      const r = bucket.get(ym)!;
      r[key] += amount;
      r.net = r.sales - r.purchases;
    };

    for (const s of sales) {
      const total = (s.items || []).reduce((acc, it) => acc + Number(it.price) * Number(it.qty), 0);
      add(new Date(s.createdAt), total, 'sales');
    }
    for (const p of purchases) {
      const total = (p.items || []).reduce((acc, it) => acc + Number(it.price) * Number(it.qty), 0);
      add(new Date(p.createdAt), total, 'purchases');
    }

    const items = Array.from(bucket.values()).sort((a, b) => a.month.localeCompare(b.month));
    const totals = items.reduce(
      (acc, r) => ({ sales: acc.sales + r.sales, purchases: acc.purchases + r.purchases, net: acc.net + r.net }),
      { sales: 0, purchases: 0, net: 0 },
    );

    return { range: { from: start.toISOString(), to: end.toISOString() }, totalMonths: items.length, totals, items };
  }
}
