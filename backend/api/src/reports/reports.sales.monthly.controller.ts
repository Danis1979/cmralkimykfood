import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type MonthRange = { fromMonth?: string; toMonth?: string };

@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private readonly prisma: PrismaService) {}

  private buildDateExpr(alias = 'o') {
    return `
      COALESCE(
        ${alias}."saleDate",
        ${alias}."date",
        ${alias}."createdAt",
        CASE 
          WHEN ${alias}."dateKey" ~ '^[0-9]{8}$' THEN to_date(${alias}."dateKey",'YYYYMMDD')
          WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN ${alias}."dateKey"::date
          ELSE NULL
        END
      )
    `;
  }

  private buildNetExpr(alias = 'o') {
    return `COALESCE(${alias}."net", ${alias}."totalNet", ${alias}."total", 0)`;
  }

  @Get('sales.monthly')
  async salesMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : undefined);
    const fromMonth = mm(from);
    const toMonth   = mm(to);

    const d = this.buildDateExpr('o');
    const net = this.buildNetExpr('o');

    const where: string[] = [
      `(o."type" = 'sale' OR o."module" = 'sales' OR o."kind" = 'sale')`,
      `${d} IS NOT NULL`,
    ];
    if (fromMonth) where.push(`${d} >= to_date('${fromMonth}','YYYY-MM')`);
    if (toMonth)   where.push(`${d} < (to_date('${toMonth}','YYYY-MM') + interval '1 month')`);

    const sql = `
      SELECT 
        to_char(date_trunc('month', ${d}), 'YYYY-MM') AS month,
        SUM(${net})::numeric AS net
      FROM "Order" o
      WHERE ${where.join(' AND ')}
      GROUP BY 1
      ORDER BY 1
    `;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return {
      range: { from: fromMonth ?? null, to: toMonth ?? null },
      series: rows.map(r => ({ month: r.month, net: Number(r.net) || 0 })),
    };
  }
}
