import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private readonly prisma: PrismaService) {}

  // arma la expresión de fecha (soporta ISO en dateKey)
  private dateExpr(alias = 'o') {
    return `
      COALESCE(
        ${alias}."date",
        ${alias}."createdAt",
        CASE 
          WHEN ${alias}."dateKey" ~ '^[0-9]{8}$' THEN to_date(${alias}."dateKey",'YYYYMMDD')
          WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN ${alias}."dateKey"::date
          WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN (${alias}."dateKey")::timestamptz
          ELSE NULL
        END
      )
    `;
  }

  // arma la expresión de importe (prioriza total, como /orders/search)
  private amountExpr(alias = 'o') {
    return `COALESCE(
      ${alias}."total",
      ${alias}."net",
      ${alias}."totalNet",
      ${alias}."grandTotal",
      ${alias}."amount",
      ${alias}."totalAmount",
      ${alias}."subtotal",
      0
    )`;
  }

  // intenta consultar una tabla dada; si falla o no hay filas, devuelve []
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
    } catch (_) {
      return [];
    }
  }

  @Get('sales.monthly')
  async salesMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : undefined);
    const fromMonth = mm(from);
    const toMonth   = mm(to);

    const candidates = [
      '"Order"',   // Prisma por defecto con comillas
      'orders',    // minúscula
      '"Orders"',  // plural con comillas
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
