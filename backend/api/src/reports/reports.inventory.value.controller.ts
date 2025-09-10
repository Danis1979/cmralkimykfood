import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsInventoryValueController {
  constructor(private prisma: PrismaService) {}

  @Get('inventory-value')
  async inventoryValue() {
    const products = await this.prisma.product.findMany({
      select: { id: true, sku: true, name: true, costStd: true },
      where: { active: true },
    });

    const [inGroups, outGroups] = await Promise.all([
      this.prisma.inventoryMove.groupBy({
        by: ['productId'],
        where: { direction: 'IN' },
        _sum: { qty: true },
      }),
      this.prisma.inventoryMove.groupBy({
        by: ['productId'],
        where: { direction: 'OUT' },
        _sum: { qty: true },
      }),
    ]);

    const inMap = new Map(inGroups.map(g => [g.productId, Number(g._sum.qty || 0)]));
    const outMap = new Map(outGroups.map(g => [g.productId, Number(g._sum.qty || 0)]));

    const items = products.map(p => {
      const onHand = (inMap.get(p.id) || 0) - (outMap.get(p.id) || 0);
      const costStd = Number(p.costStd || 0);
      const value = onHand * costStd;
      return { sku: p.sku, name: p.name, onHand, costStd, value };
    });

    const totals = items.reduce(
      (acc, it) => ({ totalQty: acc.totalQty + it.onHand, totalValue: acc.totalValue + it.value }),
      { totalQty: 0, totalValue: 0 },
    );

    return { total: items.length, totals, items };
  }
}
