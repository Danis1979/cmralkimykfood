import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private readonly prisma: PrismaService) {}

  private dateExpr(alias = 'o') {
    // Casteamos SIEMPRE a timestamptz (sirve si la columna es timestamp/date/texto ISO)
    return `
      COALESCE(
        (${alias}."date")::timestamptz,
        (${alias}."saleDate")::timestamptz,
        (${alias}."createdAt")::timestamptz,
        CASE 
          WHEN ${alias}."dateKey" ~ '^[0-9]{8}$' THEN to_date(${alias}."dateKey",'YYYYMMDD')::timestamptz
          WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (${alias}."dateKey")::date::timestamptz
          WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN (${alias}."dateKey")::timestamptz
          ELSE NULL
        END
      )
    `;
  }

  private amountExpr(alias = 'o') {
    // Casteamos a numeric por si vinieran como texto
    return `COALESCE(
      (${alias}."total")::numeric,
      (${alias}."net")::numeric,
      (${alias}."totalNet")::numeric,
      (${alias}."grandTotal")::numeric,
      (${alias}."amount")::numeric,
      (${alias}."totalAmount")::numeric,
      (${alias}."subtotal")::numeric,
      0
    )`;
  }

  private async queryMonthlyForTable(table: string, fromMonth?: string, toMonth?: string) {
    const d = this.dateExpr('o');
    const amt = this.amountExpr('o');

    const where: string[] = [`${d} IS NOT NULL`];
    if (fromMonth) where.push(`${d} >= to_date('${fromMonth}','YYYY-MM')`);
    if (toMonth)   where.push(`${d} < (to_date('${toMonth}','YYYY-MM') + interval '1 month')`);

    const sql = `
      SELECT 
        to_char(date_trunc('month', ${d}), 'YYYY-MM') AS month,
        SUM(${amt})::numeric AS net
      FROM ${table} o
      WHERE ${where.join(' AND ')}
      GROUP BY 1
      ORDER BY 1
    `;

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(sql);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  @Get('sales.monthly')
  async salesMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : undefined);
    const fromMonth = mm(from);
    const toMonth   = mm(to);

    const candidates = [
      '"Order"',
      'orders',
      '"Orders"',
      'orders_view',
      'v_orders',
    ];

    let rows: any[] = [];
    for (const table of candidates) {
      rows = await this.queryMonthlyForTable(table, fromMonth, toMonth);
      if (rows.length > 0) break;
    }

    return {
      range: { from: fromMonth ?? null, to: toMonth ?? null },
      series: rows.map(r => ({ month: r.month, net: Number(r.net) || 0 })),
    };
  }
}
