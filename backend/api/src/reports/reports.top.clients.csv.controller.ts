// @ts-nocheck
import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { ApiTags } from '@nestjs/swagger';

function rangeFromTo(from?: string, to?: string) {
  const start = from ? new Date(from + '-01T00:00:00Z') : new Date('1970-01-01T00:00:00Z');
  const end = to ? new Date(new Date(to + '-01T00:00:00Z').getTime() + 31 * 24 * 3600 * 1000) : new Date();
  return { start, end };
}

@ApiTags('Reports')
@Controller('reports')
export class ReportsTopClientsCsvController {
  constructor(private prisma: PrismaService) {}

  @Get('top-clients.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(@Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    res.setHeader('Content-Disposition', 'attachment; filename="top-clients.csv"');
    const { start, end } = rangeFromTo(from, to);

    const rows = await (this.prisma as any).sale.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { client: true, total: true },
    });

    const acc = new Map<string, { revenue: number; count: number }>();
    for (const r of rows) {
      const key = r.client || 'UNKNOWN';
      const a = acc.get(key) ?? { revenue: 0, count: 0 };
      a.revenue += r.total ?? 0;
      a.count += 1;
      acc.set(key, a);
    }

    const lines = ['ClientId,Client,Email,Revenue,SalesCount,AvgTicket'];
    [...acc.entries()]
      .map(([client, v]) => ({
        clientId: client,
        client,
        email: '',
        revenue: v.revenue,
        salesCount: v.count,
        avgTicket: v.count ? v.revenue / v.count : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .forEach(r => {
        lines.push(
          `${r.clientId},"${r.client}",${r.email},${r.revenue.toFixed(2)},${r.salesCount},${r.avgTicket.toFixed(2)}`
        );
      });

    res.send(lines.join('\n'));
  }
}