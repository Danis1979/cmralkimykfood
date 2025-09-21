import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MonthRange = { fromMonth?: string; toMonth?: string };

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

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

  private monthBoundaries({ fromMonth, toMonth }: MonthRange) {
    const wherePieces: string[] = [];
    const d = this.buildDateExpr('o');
    if (fromMonth) wherePieces.push(`${d} >= to_date($1,'YYYY-MM')`);
    if (toMonth)   wherePieces.push(`${d} < (to_date($2,'YYYY-MM') + interval '1 month')`);
    return { wherePieces, d };
  }

  async getSalesMonthly(params: MonthRange) {
    const { fromMonth, toMonth } = params;
    const dateExpr = this.buildDateExpr('o');
    const net = this.buildNetExpr('o');
    const { wherePieces, d } = this.monthBoundaries({ fromMonth, toMonth });

    const whereCore = [
      `(o."type" = 'sale' OR o."module" = 'sales' OR o."kind" = 'sale')`,
      `${dateExpr} IS NOT NULL`,
      ...wherePieces,
    ].filter(Boolean);

    const whereSql = whereCore.length ? `WHERE ${whereCore.join(' AND ')}` : '';
    const sql = `
      SELECT 
        to_char(date_trunc('month', ${d}), 'YYYY-MM') AS month,
        SUM(${net})::numeric AS net
      FROM "Order" o
      ${whereSql}
      GROUP BY 1
      ORDER BY 1
    `;

    const args: any[] = [];
    if (fromMonth) args.push(fromMonth);
    if (toMonth)   args.push(toMonth);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...args);
    return {
      range: { from: fromMonth ?? null, to: toMonth ?? null },
      series: rows.map(r => ({ month: r.month, net: Number(r.net) || 0 })),
    };
  }
}
