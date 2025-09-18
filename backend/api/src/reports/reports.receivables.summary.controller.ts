import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function mm(dt?: Date | string | null) {
  if (!dt) return null;
  const d = new Date(dt as any);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}`;
}
function monthRange(from?: string | null, to?: string | null) {
  // start = primer día del mes "from" o 6 meses atrás
  // end = primer día del mes siguiente a "to" o mes siguiente al actual (rango half-open [start, end))
  const now = new Date();
  const start = from
    ? new Date(`${from}-01T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const end = to
    ? new Date(Date.UTC(
        Number(to.slice(0,4)), Number(to.slice(5,7)) - 1 + 1, 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, from: mm(start), to: mm(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1))) };
}

@Controller('reports')
export class ReportsReceivablesSummaryController {
  constructor(private prisma: PrismaService) {}

  @Get('receivables.summary')
  async summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('debug') debug?: string,
  ) {
    const { start, end } = monthRange(from ?? null, to ?? null);

    const tried: any[] = [];
    const candidates = [
      { table: 'cmr."Receivable"', date: 'fecha',  due: 'vence',     amount: 'saldo', status: 'estado' },
      { table: 'crm."Receivable"', date: 'fecha',  due: 'vence',     amount: 'saldo', status: 'estado' },
      { table: 'public.receivables', date:'fecha', due: 'vence',     amount: 'saldo', status: 'estado' },
    ];

    for (const c of candidates) {
      const sql = `
        SELECT
          COALESCE(SUM(CASE WHEN ${c.status} IN ('Cobrado','PAID','paid') THEN ${c.amount} ELSE 0 END),0)::bigint AS paid,
          COALESCE(SUM(CASE
            WHEN ${c.status} IN ('Pendiente','pending','PENDING') AND ${c.due} >= NOW() THEN ${c.amount}
            ELSE 0 END),0)::bigint AS pending,
          COALESCE(SUM(CASE
            WHEN (${c.status} IN ('Vencido','overdue','OVERDUE'))
              OR (${c.status} IN ('Pendiente','pending','PENDING') AND ${c.due} < NOW())
            THEN ${c.amount} ELSE 0 END),0)::bigint AS overdue
        FROM ${c.table}
        WHERE ${c.date} >= $1 AND ${c.date} < $2
      `;
      try {
        const rows: any[] = await this.prisma.$queryRawUnsafe(sql, start, end);
        const r = rows?.[0];
        if (r) {
          const out = {
            range: { from, to },
            paid: Number(r.paid) || 0,
            pending: Number(r.pending) || 0,
            overdue: Number(r.overdue) || 0,
          };
          return debug ? { ...out, _debug: { picked: c.table, tried } } : out;
        }
        tried.push({ table: c.table, error: null });
      } catch (e) {
        tried.push({ table: c.table, error: 'query_failed' });
      }
    }

    const out = { range: { from, to }, paid: 0, pending: 0, overdue: 0 };
    return debug ? { ...out, _debug: { picked: null, tried } } : out;
  }
}