import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller()
@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  private checkKey(k?: string) {
    const expected = process.env.API_KEY || 'supersecreta-123';
    if (expected && k !== expected) throw new UnauthorizedException();
  }

  @Get('reports/inventory-value')
  async inventoryValue(@Headers('x-api-key') key?: string) {
    this.checkKey(key);

    const [products, groups] = await Promise.all([
      (this.prisma as any).product.findMany({
        select: { id: true, sku: true, name: true, costStd: true },
      }),
      (this.prisma as any).inventoryMove.groupBy({
        by: ['productId', 'direction'],
        _sum: { qty: true },
      }),
    ]);

    const sums = new Map<string, { in: number; out: number }>();
    for (const g of groups) {
      const cur = sums.get(g.productId) || { in: 0, out: 0 };
      const q = Number(g._sum.qty || 0);
      if (g.direction === 'IN') cur.in += q;
      else cur.out += q;
      sums.set(g.productId, cur);
    }

    const items = products
      .map((p) => {
        const s = sums.get(p.id) || { in: 0, out: 0 };
        const onHand = (s.in || 0) - (s.out || 0);
        const cost = Number((p as any).costStd || 0);
        const value = onHand * cost;
        return { sku: p.sku, name: p.name, onHand, costStd: cost, value };
      })
      .filter((x) => x.onHand !== 0 || x.value !== 0)
      .sort((a, b) => b.value - a.value);

    const totals = items.reduce(
      (acc, x) => {
        acc.totalQty += x.onHand;
        acc.totalValue += x.value;
        return acc;
      },
      { totalQty: 0, totalValue: 0 },
    );

    return { total: items.length, totals, items };
  }
}
