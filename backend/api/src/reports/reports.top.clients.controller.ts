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

type Row = {
  clientId: string;
  client: string;
  email?: string | null;
  revenue: number;
  salesCount: number;
  avgTicket: number;
};

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsTopClientsController {
  constructor(private prisma: PrismaService) {}

  @Get('top-clients')
  async topClients(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitStr?: string,
  ) {
    const { start, end } = parseRange(from, to);
    const lim = Math.max(0, Number(limitStr || 0));

    const sales = await this.prisma.sale.findMany({
      where: { status: { not: 'ANULADA' as any }, createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        client: { select: { id: true, name: true, email: true } },
        items: { select: { qty: true, price: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const map = new Map<string, Row>();
    for (const s of sales) {
      const clientId = s.client?.id || 'UNKNOWN';
      const clientName = s.client?.name || 'UNKNOWN';
      const email = s.client?.email || null;

      const saleTotal = (s.items || []).reduce(
        (acc, it) => acc + Number(it.price) * Number(it.qty),
        0,
      );

      const acc =
        map.get(clientId) ||
        { clientId, client: clientName, email, revenue: 0, salesCount: 0, avgTicket: 0 };

      acc.revenue += saleTotal;
      acc.salesCount += 1;
      map.set(clientId, acc);
    }

    let items = Array.from(map.values())
      .map(r => ({
        ...r,
        avgTicket: r.salesCount > 0 ? Math.round((r.revenue / r.salesCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    if (lim > 0) items = items.slice(0, lim);

    const totals = items.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        salesCount: acc.salesCount + r.salesCount,
        avgTicket: 0,
      }),
      { revenue: 0, salesCount: 0, avgTicket: 0 },
    );
    totals.avgTicket = totals.salesCount > 0 ? Math.round((totals.revenue / totals.salesCount) * 100) / 100 : 0;

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totalClients: items.length,
      totals,
      items,
    };
  }
}
