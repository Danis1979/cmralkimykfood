import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

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
          WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN (${alias}."dateKey")::timestamp
          ELSE NULL
        END
      )
    `;
  }

  private buildAmountExpr(alias = 'o') {
    return `COALESCE(
      ${alias}."net",
      ${alias}."totalNet",
      ${alias}."total",
      ${alias}."grandTotal",
      ${alias}."amount",
      ${alias}."totalAmount",
      ${alias}."subtotal",
      0
    )`;
  }

  @Get('sales.monthly')
  async salesMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : undefined);
    const fromMonth = mm(from);
    const toMonth   = mm(to);

    const d = this.buildDateExpr('o');
    const amt = this.buildAmountExpr('o');

    const where: string[] = [`${d} IS NOT NULL`];
    if (fromMonth) where.push(`${d} >= to_date('${fromMonth}','YYYY-MM')`);
    if (toMonth)   where.push(`${d} < (to_date('${toMonth}','YYYY-MM') + interval '1 month')`);

    const sql = `
      SELECT 
        to_char(date_trunc('month', ${d}), 'YYYY-MM') AS month,
        SUM(${amt})::numeric AS net
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
