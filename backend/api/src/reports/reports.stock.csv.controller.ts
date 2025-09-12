import { ApiTags } from '@nestjs/swagger';

// backend/api/src/reports/reports.stock.csv.controller.ts
import { Controller, Get, Query, Res, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

function csv(s?: string) { return String(s ?? '').replace(/"/g, '""'); }
function fix(n: number) { return Number.isFinite(n) ? n.toFixed(2) : '0.00'; }

@UseInterceptors(CacheInterceptor)
@Controller('reports')
@ApiTags('Reports')

export class ReportsStockCsvController {
  constructor(private prisma: PrismaService) {}

  @CacheTTL(60)
  @Get('stock.csv')
  async stockCsv(
    @Res() res: Response,
    @Query('sku') skuQ?: string,          // filtro opcional
    @Query('low') lowStr?: string,        // "true" -> sólo onHand <= reorderPoint (si existiera) o <= 0
  ) {
    // Productos (tomamos sku, name, costStd)
    const prods = await (this.prisma as any).product.findMany({
      where: skuQ?.trim() ? { sku: { contains: skuQ.trim(), mode: 'insensitive' } } : undefined,
      select: { id: true, sku: true, name: true, costStd: true, reorderPoint: true },
    });

    if (!prods.length) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="stock.csv"');
      return res.send('Sku,Name,OnHand,CostStd,Value\n');
    }

    const ids = prods.map(p => p.id);

    // Sumas IN/OUT por producto
    const [ins, outs] = await Promise.all([
      (this.prisma as any).inventoryMove.groupBy({
        by: ['productId'],
        where: { productId: { in: ids }, direction: 'IN' as any },
        _sum: { qty: true },
      }),
      (this.prisma as any).inventoryMove.groupBy({
        by: ['productId'],
        where: { productId: { in: ids }, direction: 'OUT' as any },
        _sum: { qty: true },
      }),
    ]);

    const inMap  = new Map<string, number>(ins.map(r => [r.productId, Number(r._sum.qty ?? 0)]));
    const outMap = new Map<string, number>(outs.map(r => [r.productId, Number(r._sum.qty ?? 0)]));

    let rows = prods.map(p => {
      const onHand = (inMap.get(p.id) ?? 0) - (outMap.get(p.id) ?? 0);
      const cost   = Number(p.costStd ?? 0);
      const value  = onHand * cost;
      return {
        sku: p.sku, name: p.name, onHand,
        costStd: cost, value,
        reorderPoint: (p as any).reorderPoint ?? undefined,
      };
    });

    if (String(lowStr).toLowerCase() === 'true') {
      rows = rows.filter(r =>
        (Number.isFinite(r.reorderPoint) ? r.onHand <= Number(r.reorderPoint) : r.onHand <= 0)
      );
    }

    // ordenar por valor descendente
    rows.sort((a, b) => b.value - a.value);

    const header = 'Sku,Name,OnHand,CostStd,Value';
    const lines = rows.map(r =>
      `${csv(r.sku)},"${csv(r.name)}",${r.onHand},${fix(r.costStd)},${fix(r.value)}`
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="stock.csv"');
    res.send([header, ...lines].join('\n'));
  }
}