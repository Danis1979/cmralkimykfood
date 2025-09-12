// @ts-nocheck
import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ApiTags } from '@nestjs/swagger';

function rangeFromTo(from?: string, to?: string) {
  const start = from ? new Date(from + '-01T00:00:00Z') : new Date('1970-01-01T00:00:00Z');
  const end = to ? new Date(new Date(to + '-01T00:00:00Z').getTime() + 31 * 24 * 3600 * 1000) : new Date();
  return { start, end };
}

@ApiTags('Reports')
@Controller('reports')
export class ReportsSalesVsPurchasesController {
  constructor(private prisma: PrismaService) {}

  @Get('sales-vs-purchases')
  async getSvp(@Query('from') from?: string, @Query('to') to?: string) {
    const { start, end } = rangeFromTo(from, to);

    // Ventas: tabla ventas -> modelo Sale (mapeado)
    const sales = await (this.prisma as any).sale.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    // Compras: estimamos monto = qty * último precio conocido del ingrediente
    const purchasesRows = await (this.prisma as any).purchase.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: { ingredient: true, qty: true },
    });

    // Traemos precios por ingrediente (el último registro por ingrediente)
    const prices = await (this.prisma as any).ingredientPrice.findMany({
      select: { ingredient: true, unitPrice: true, id: true },
      orderBy: [{ ingredient: 'asc' }, { id: 'desc' }],
    });

    const lastPrice = new Map<string, number>();
    for (const p of prices) {
      if (!lastPrice.has(p.ingredient)) lastPrice.set(p.ingredient, p.unitPrice);
    }

    const purchasesTotal = purchasesRows.reduce((acc, r) => {
      const u = lastPrice.get(r.ingredient) ?? 0;
      return acc + r.qty * u;
    }, 0);

    const salesTotal = sales.reduce((acc, s) => acc + (s.total ?? 0), 0);

    return {
      range: { from: start, to: end },
      totals: {
        sales: Math.round(salesTotal * 100) / 100,
        purchases: Math.round(purchasesTotal * 100) / 100,
        net: Math.round((salesTotal - purchasesTotal) * 100) / 100,
      },
    };
  }
}