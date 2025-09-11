// @ts-nocheck
import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
// backend/api/src/reports/reports.productions.csv.controller.ts
import { Controller, Get, Query, Res, Req } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

function parseRange(from?: string, to?: string) {
  const now = new Date();
  let start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  let end = now;
  if (from) {
    const mf = /^(\d{4})-(\d{2})$/.exec(from);
    start = mf ? new Date(Date.UTC(+mf[1], +mf[2] - 1, 1)) : new Date(from);
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
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsProductionsCsvController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('productions.csv')
  async productionsCsv(
    @Req() req: Request,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { start, end } = parseRange(from, to);

    // Filtro base + opcional por SKU
    const where: any = {
      reason: 'PRODUCCION' as any,
      date: { gte: start, lte: end },
    };
    const sku = String((req.query as any).sku || '').trim();
    if (sku) (where as any).product = { is: { sku } };

    const moves = await (this.prisma as any).inventoryMove.findMany({
      where,
      include: { product: true },
      orderBy: { date: 'asc' },
    });

    const headers = ['BatchId', 'Date', 'Direction', 'Sku', 'Name', 'Qty'];
    const rows = moves.map((m: any) =>
      [
        esc(m.batchId ?? ''),
        esc(m.date instanceof Date ? m.date.toISOString() : new Date(m.date).toISOString()),
        esc(m.direction),
        esc(m.product?.sku ?? ''),
        esc(m.product?.name ?? ''),
        esc(m.qty),
      ].join(','),
    );

    const csv = headers.join(',') + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productions.csv"');
    return csv;
  }
}