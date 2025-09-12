import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
// backend/api/src/reports/reports.orders.csv.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { Response } from 'express';

function parseRange(from?: string, to?: string) {
  const now = new Date();
  let start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  let end = now;
  if (from) {
    const mf = /^(\d{4})-(\d{2})$/.exec(from);
    start = mf ? new Date(Date.UTC(+mf[1], +mf[2]-1, 1)) : new Date(from);
  }
  if (to) {
    const mt = /^(\d{4})-(\d{2})$/.exec(to);
    end = mt ? new Date(Date.UTC(+mt[1], +mt[2], 1)) : new Date(to);
  }
  return { start, end };
}

function esc(s: any) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g,'""')}"` : str;
}

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsOrdersCsvController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('orders.csv')
  async ordersCsv(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('status') status: string | undefined,
    @Query('clientEmail') clientEmail: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { start, end } = parseRange(from, to);
    const where: any = { createdAt: { gte: start, lte: end } };
    if (status) where.status = status as any;
    if (clientEmail) where.client = { email: clientEmail };

    const orders = await (this.prisma as any).order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { client: true, items: { include: { product: true } } },
    });

    const headers = ['OrderId','Date','Status','Client','Email','Sku','Name','Qty','Price','Subtotal','Notes'];
    let total = 0; const rows: string[] = [];

    for (const o of orders) {
      const date = (o as any).createdAt?.toISOString?.() ?? new Date((o as any).createdAt).toISOString();
      const clientName = (o as any).client?.name ?? (o as any).client?.nombre ?? 'N/A';
      const email = (o as any).client?.email ?? '';
      const notes = (o as any).notes ?? '';
      const items = (o as any).items || [];

      if (!items.length) {
        rows.push([o.id,date,o.status,clientName,email,'','',0,'0.00','0.00',notes].map(esc).join(','));
        continue;
      }

      for (const it of items) {
        const sku = it.product?.sku ?? it.sku ?? '';
        const name = it.product?.name ?? '';
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const sub = qty * price;
        total += sub;
        rows.push([o.id,date,o.status,clientName,email,sku,name,qty,price.toFixed(2),sub.toFixed(2),notes].map(esc).join(','));
      }
    }

    const csv = headers.join(',') + '\n' + rows.join('\n') + (rows.length ? `\nTOTALS,,,,,,,,,${total.toFixed(2)},` : '');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="orders.csv"');
    return csv;
  }
}
