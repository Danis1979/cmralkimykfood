import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private readonly prisma: PrismaService) {}

  private monthStr(d: Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  @Get('sales.monthly')
  async salesMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : undefined);
    let fromMonth = mm(from);
    let toMonth   = mm(to);

    // Default: últimos 6 meses (incluyendo el mes corriente)
    if (!fromMonth && !toMonth) {
      const now = new Date(); // UTC
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); // 1° del mes actual
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1)); // 5 meses atrás
      fromMonth = this.monthStr(start);
      toMonth   = this.monthStr(end);
    }

    // Construcción de expresiones con cast seguro
    const d = `
      COALESCE(
        s."date"::timestamptz,
        s."createdAt"::timestamptz
      )
    `;
    const a = `
      COALESCE(
        s."total"::numeric,
        s."subtotal"::numeric,
        0
      )
    `;

    const where: string[] = [`${d} IS NOT NULL`];
    if (fromMonth) where.push(`${d} >= to_date('${fromMonth}','YYYY-MM')`);
    if (toMonth)   where.push(`${d} < (to_date('${toMonth}','YYYY-MM') + interval '1 month')`);

    const sql = `
      SELECT to_char(date_trunc('month', ${d}), 'YYYY-MM') AS month,
             SUM(${a})::numeric AS net
      FROM cmr."Sale" s
      WHERE ${where.join(' AND ')}
      GROUP BY 1
      ORDER BY 1
    `;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return {
      range: { from: fromMonth ?? null, to: toMonth ?? null },
      series: (rows ?? []).map(r => ({ month: r.month, net: Number(r.net) || 0 })),
    };
  }
}
