import { ApiOperation, ApiProduces, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";

import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

function toCSVCell(v: any) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsReceivablesAgingCsvController {
  constructor(private prisma: PrismaService) {}

  @Get('receivables-aging.csv')
  async receivablesAgingCsv(
    @Query('as_of') asOfStr: string | undefined,
    @Res() res: Response,
  ) {
    const asOf = asOfStr ? new Date(asOfStr.length === 7 ? asOfStr + '-01' : asOfStr) : new Date();

    const recs = await this.prisma.receivable.findMany({
      where: { balance: { gt: 0 } },
      select: {
        balance: true,
        dueDate: true,
        client: { select: { id: true, name: true, email: true } },
      },
    });

    type Buckets = { current: number, b1_30: number, b31_60: number, b61_90: number, b90p: number, total: number };
    const byClient = new Map<string, { id: string; name: string; email: string; buckets: Buckets }>();
    const totals: Buckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90p: 0, total: 0 };

    const dayMs = 86400000;

    for (const r of recs) {
      const c = r.client || { id: 'UNKNOWN', name: 'UNKNOWN', email: '' };
      if (!byClient.has(c.id)) {
        byClient.set(c.id, {
          id: c.id,
          name: c.name || 'UNKNOWN',
          email: c.email || '',
          buckets: { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90p: 0, total: 0 },
        });
      }
      const entry = byClient.get(c.id)!;

      const due = r.dueDate ? new Date(r.dueDate) : null;
      let bucket: keyof Buckets = 'current';
      if (due && asOf > due) {
        const days = Math.floor((asOf.getTime() - due.getTime()) / dayMs);
        if (days <= 30) bucket = 'b1_30';
        else if (days <= 60) bucket = 'b31_60';
        else if (days <= 90) bucket = 'b61_90';
        else bucket = 'b90p';
      }
      entry.buckets[bucket] += Number(r.balance || 0);
      entry.buckets.total += Number(r.balance || 0);

      (totals as any)[bucket] += Number(r.balance || 0);
      totals.total += Number(r.balance || 0);
    }

    const header = ['ClientId','Client','Email','Current','1-30','31-60','61-90','90+','Total'];
    const rows: string[] = [];
    rows.push(header.map(toCSVCell).join(','));

    for (const [,v] of byClient) {
      rows.push([
        v.id, v.name, v.email,
        v.buckets.current, v.buckets.b1_30, v.buckets.b31_60, v.buckets.b61_90, v.buckets.b90p, v.buckets.total
      ].map(toCSVCell).join(','));
    }

    // Totales al final
    rows.push([
      'TOTALS','','',
      totals.current, totals.b1_30, totals.b31_60, totals.b61_90, totals.b90p, totals.total
    ].map(toCSVCell).join(','));

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="receivables-aging.csv"');
    res.send(csv);
  }
}
