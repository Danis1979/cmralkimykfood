import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsInventoryValueCsvController {
  constructor(private prisma: PrismaService) {}

  @Get('inventory-value.csv')
  async inventoryValueCsv(@Res() res: Response) {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, costStd: true },
    });

    let totalQty = 0;
    let totalValue = 0;
    const rows: { sku: string; name: string; onHand: number; cost: number; value: number }[] = [];

    for (const p of products) {
      const [ins, outs] = await Promise.all([
        this.prisma.inventoryMove.aggregate({
          where: { productId: p.id, direction: 'IN' },
          _sum: { qty: true },
        }),
        this.prisma.inventoryMove.aggregate({
          where: { productId: p.id, direction: 'OUT' },
          _sum: { qty: true },
        }),
      ]);

      const onHand = Number(ins._sum.qty || 0) - Number(outs._sum.qty || 0);
      const cost = Number(p.costStd || 0);
      const value = onHand * cost;

      totalQty += onHand;
      totalValue += value;

      rows.push({
        sku: p.sku,
        name: p.name,
        onHand,
        cost,
        value,
      });
    }

    // CSV
    const header = 'Sku,Name,OnHand,CostStd,Value';
    const lines = rows.map(r =>
      [
        csv(r.sku),
        csv(r.name),
        String(r.onHand),
        fix(r.cost),
        fix(r.value),
      ].join(','),
    );

    lines.push(['TOTALS', '', String(totalQty), '', fix(totalValue)].join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-value.csv"');
    res.send([header, ...lines].join('\n'));
  }
}

function fix(n: number) { return Number.isFinite(n) ? n.toFixed(2) : '0.00'; }
function csv(s: any) {
  const t = String(s ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
