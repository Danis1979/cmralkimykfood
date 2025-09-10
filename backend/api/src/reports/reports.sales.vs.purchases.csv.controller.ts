import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsSalesVsPurchasesCsvController {
  constructor(private prisma: PrismaService) {}

  @Get('sales-vs-purchases.csv')
  async salesVsPurchasesCsv(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    // Rango: por defecto año en curso
    let start = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    let end = new Date();

    // Permitir YYYY-MM o fecha completa
    const parseMonth = (s?: string) => {
      if (!s) return null;
      const d = new Date(s.length === 7 ? s + '-01' : s);
      return isNaN(d.getTime()) ? null : d;
    };
    const mf = parseMonth(from);
    const mt = parseMonth(to);
    if (mf) start = new Date(Date.UTC(mf.getUTCFullYear(), mf.getUTCMonth(), 1));
    if (mt) {
      end = mt;
      if (to && to.length === 7) {
        end = new Date(Date.UTC(mt.getUTCFullYear(), mt.getUTCMonth() + 1, 1));
      }
    }

    // Traer ventas (con items) y compras
    const [sales, purchases] = await Promise.all([
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: { items: true },
      }),
      this.prisma.purchase.findMany({
        where: { createdAt: { gte: start, lt: end } },
      }),
    ]);

    const key = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

    type Row = { month: string; sales: number; purchases: number; net: number };
    const map = new Map<string, Row>();

    // Ventas: sum(item.price * qty)
    for (const s of sales) {
      const k = key(new Date(s.createdAt as any));
      const amt =
        (s.items || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0);
      const r = map.get(k) || { month: k, sales: 0, purchases: 0, net: 0 };
      r.sales += amt;
      r.net = r.sales - r.purchases;
      map.set(k, r);
    }

    // Compras: sum(purchase.total)
    for (const p of purchases) {
      const k = key(new Date(p.createdAt as any));
      const amt = Number((p as any).total || 0);
      const r = map.get(k) || { month: k, sales: 0, purchases: 0, net: 0 };
      r.purchases += amt;
      r.net = r.sales - r.purchases;
      map.set(k, r);
    }

    const items = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));

    const header = 'Month,Sales,Purchases,Net';
    const lines = items.map(i => `${i.month},${fix(i.sales)},${fix(i.purchases)},${fix(i.net)}`);

    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', 'attachment; filename="sales-vs-purchases.csv"');
    res!.send([header, ...lines].join('\n'));
  }
}

function fix(n: number) { return Number.isFinite(n) ? n.toFixed(2) : '0.00'; }
