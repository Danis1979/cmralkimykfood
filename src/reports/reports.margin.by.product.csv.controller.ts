// @ts-nocheck
import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
  // backend/api/src/reports/reports.margin.by.product.csv.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

type Dir = 'asc' | 'desc';

/** Rango: acepta YYYY-MM o fecha completa; devuelve {start(gte), end(lt)} */
function parseRange(from?: string, to?: string) {
  const now = new Date();
  let start: Date | undefined;
  let end: Date | undefined;

  const parse = (s?: string) => {
    if (!s) return null;
    if (/^\d{4}-\d{2}$/.test(s)) {
      const y = Number(s.slice(0, 4));
      const m = Number(s.slice(5, 7)) - 1;
      return new Date(Date.UTC(y, m, 1, 0, 0, 0));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const mf = parse(from);
  const mt = parse(to);
  if (mf) start = mf;
  if (mt) {
    if (to && /^\d{4}-\d{2}$/.test(to)) {
      end = new Date(Date.UTC(mt.getUTCFullYear(), mt.getUTCMonth() + 1, 1, 0, 0, 0));
    } else {
      // día: lt = día siguiente 00:00Z
      end = new Date(Date.UTC(mt.getUTCFullYear(), mt.getUTCMonth(), mt.getUTCDate() + 1, 0, 0, 0));
    }
  }
  if (!start && !end) end = now;
  return { start, end };
}

/** order parser: "margin:desc,revenue:desc,qty:desc,sku:asc" -> [['margin','desc'],...] */
function parseOrderPairs(order?: string, def: Array<[keyof Item, Dir]> = []) {
  const pairs = (order || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok) => {
      const [fRaw, dRaw] = tok.split(':');
      const field = String(fRaw ?? '').trim() as keyof Item;
      const dir = (String(dRaw ?? 'asc').trim().toLowerCase() as Dir);
      return field ? ([field, dir === 'desc' ? 'desc' : 'asc'] as [keyof Item, Dir]) : null;
    })
    .filter(Boolean) as Array<[keyof Item, Dir]>;
  return pairs.length ? pairs : def;
}

/** Ordena in-memory por múltiples campos (numérico si aplica) */
function sortByPairs<T extends Record<string, any>>(items: T[], pairs: Array<[keyof T, Dir]>) {
  const cmp = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0);
  items.sort((a, b) => {
    for (const [field, dir] of pairs) {
      const av = a[field];
      const bv = b[field];
      const na = typeof av === 'number' ? av : Number(av);
      const nb = typeof bv === 'number' ? bv : Number(bv);
      const bothNum = Number.isFinite(na) && Number.isFinite(nb);
      const c = bothNum ? cmp(na, nb) : cmp(String(av ?? ''), String(bv ?? ''));
      if (c !== 0) return dir === 'desc' ? -c : c;
    }
    return 0;
  });
  return items;
}

function csv(s?: string) {
  return String(s ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ').trim();
}
function fix(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}
function fixPct(n: number) {
  return `${fix(n)}%`;
}

type Row = { sku: string; name: string; qty: number; price: number; costStd: number };
type Item = {
  sku: string;
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
};

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsMarginByProductCsvController {
  constructor(private prisma: PrismaService) {}

  @Get('margin-by-product.csv')
  async marginByProductCsv(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitStr?: string,
    @Query('order') order?: string, // e.g. margin:desc,revenue:desc,qty:desc,sku:asc
    @Res() res?: Response,
  ) {
    // Rango
    const { start, end } = parseRange(from, to);
    const limit = Math.max(1, Number(limitStr ?? '100') | 0);

    // Ventas + items + producto (para costStd)
    const sales = await (this.prisma as any).sale.findMany({
      where: {
        ...(start || end ? { createdAt: { ...(start && { gte: start }), ...(end && { lt: end }) } } : {}),
      },
      include: { items: { include: { product: true } } },
    });

    // Aplanar items
    const rows: Row[] = [];
    for (const s of sales) {
      for (const it of s.items || []) {
        rows.push({
          sku: it.product?.sku || 'UNKNOWN',
          name: it.product?.name || 'UNKNOWN',
          qty: Number(it.qty || 0),
          price: Number(it.price || 0),
          costStd: Number(it.product?.costStd || 0),
        });
      }
    }

    // Agregación por SKU
    const map = new Map<string, Item>();
    for (const r of rows) {
      const revenue = r.price * r.qty;
      const cost = r.costStd * r.qty;
      const acc =
        map.get(r.sku) ||
        ({ sku: r.sku, name: r.name, qty: 0, revenue: 0, cost: 0, margin: 0, marginPct: 0 } as Item);
      acc.qty += r.qty;
      acc.revenue += revenue;
      acc.cost += cost;
      acc.margin = acc.revenue - acc.cost;
      acc.marginPct = acc.revenue > 0 ? (acc.margin / acc.revenue) * 100 : 0;
      map.set(r.sku, acc);
    }

    const items = Array.from(map.values());

    // Orden por query (default: margin desc, revenue desc, qty desc, sku asc)
    const pairs = parseOrderPairs(order, [
      ['margin', 'desc'],
      ['revenue', 'desc'],
      ['qty', 'desc'],
      ['sku', 'asc'],
    ]);
    sortByPairs(items, pairs);

    const top = items.slice(0, limit);

    // CSV
    const header = 'Sku,Name,Qty,Revenue,Cost,Margin,MarginPct';
    const lines = top.map(
      (i) =>
        `${csv(i.sku)},"${csv(i.name)}",${i.qty},${fix(i.revenue)},${fix(i.cost)},${fix(i.margin)},${fixPct(
          i.marginPct,
        )}`,
    );

    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', 'attachment; filename="margin-by-product.csv"');
    res!.send([header, ...lines].join('\n'));
  }
}