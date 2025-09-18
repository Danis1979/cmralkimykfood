import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sales.monthly')
  async salesMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    // Validamos YYYY-MM para evitar inyección
    const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : undefined);
    const fromMonth = mm(from);
    const toMonth   = mm(to);

    // ⚠️ si tu tabla real es `"Order"` (con comillas), cambiala acá:
    const TABLE = '"Order"';

    // fecha: date ISO, createdAt o dateKey en distintos formatos
    const d = `
      COALESCE(
        o."date",
        o."createdAt",
        CASE 
          WHEN o."dateKey" ~ '^[0-9]{8}$' THEN to_date(o."dateKey",'YYYYMMDD')
          WHEN o."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN o."dateKey"::date
          WHEN o."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN (o."dateKey")::timestamptz
          ELSE NULL
        END
      )
    `;

    // monto: priorizamos "total" que ya vemos en /orders/search
    const net = `COALESCE(o."total", o."net", o."totalNet", o."grandTotal", o."amount", o."totalAmount", o."subtotal", 0)`;

    const where: string[] = [`${d} IS NOT NULL`];
    if (fromMonth) where.push(`${d} >= to_date('${fromMonth}','YYYY-MM')`);
    if (toMonth)   where.push(`${d} < (to_date('${toMonth}','YYYY-MM') + interval '1 month')`);

    const sql = `
      SELECT 
        to_char(date_trunc('month', ${d}), 'YYYY-MM') AS month,
        SUM(${net})::numeric AS net
      FROM ${TABLE} o
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
