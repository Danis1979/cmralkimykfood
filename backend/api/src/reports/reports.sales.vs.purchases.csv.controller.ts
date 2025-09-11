// @ts-nocheck
import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { ApiTags } from '@nestjs/swagger';

function ym(d: Date) { return new Date(d.getUTCFullYear(), d.getUTCMonth(), 1).toISOString().slice(0,7); }
function rangeFromTo(from?: string, to?: string) {
  const start = from ? new Date(from + '-01T00:00:00Z') : new Date('1970-01-01T00:00:00Z');
  const end = to ? new Date(new Date(to + '-01T00:00:00Z').getTime() + 31 * 24 * 3600 * 1000) : new Date();
  return { start, end };
}

@ApiTags('Reports')
@Controller('reports')
export class ReportsSalesVsPurchasesCsvController {
  constructor(private prisma: PrismaService) {}

  @Get('sales-vs-purchases.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(@Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    res.setHeader('Content-Disposition', 'attachment; filename="sales-vs-purchases.csv"');

    const { start, end } = rangeFromTo(from, to);

    const sales = await (this.prisma as any).sale.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, total: true },
    });

    const purchasesRows = await (this.prisma as any).purchase.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: { ingredient: true, qty: true },
    });

    const prices = await (this.prisma as any).ingredientPrice.findMany({
      select: { ingredient: true, unitPrice: true, id: true },
      orderBy: [{ ingredient: 'asc' }, { id: 'desc' }],
    });

    const lastPrice = new Map<string, number>();
    for (const p of prices) if (!lastPrice.has(p.ingredient)) lastPrice.set(p.ingredient, p.unitPrice);

    const byMonth = new Map<string, { sales: number; purchases: number }>();

    for (const s of sales) {
      const k = ym(s.createdAt);
      const row = byMonth.get(k) ?? { sales: 0, purchases: 0 };
      row.sales += s.total ?? 0;
      byMonth.set(k, row);
    }

    for (const r of purchasesRows) {
      const k = to ? to : (sales[0]?.createdAt ? ym(sales[0].createdAt) : from);
      const row = byMonth.get(k) ?? { sales: 0, purchases: 0 };
      const u = lastPrice.get(r.ingredient) ?? 0;
      row.purchases += r.qty * u;
      byMonth.set(k, row);
    }

    const lines = ['Month,Sales,Purchases,Net'];
    [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => {
      const net = v.sales - v.purchases;
      lines.push(`${k},${v.sales.toFixed(2)},${v.purchases.toFixed(2)},${net.toFixed(2)}`);
    });

    res.send(lines.join('\n'));
  }
}