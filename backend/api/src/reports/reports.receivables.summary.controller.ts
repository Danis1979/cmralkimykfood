// backend/api/src/reports/reports.receivables.summary.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type Pick = {
  table: string;
  dateCols: string[];    // fecha o vencimiento
  amountCols: string[];  // saldo / importe
  statusCols: string[];  // estado (opcional)
};

const CANDIDATES: Pick[] = [
  { table: 'cmr."Receivable"', dateCols: ['due','vence','date','createdAt','createdat'], amountCols: ['balance','saldo','amount','importe','total'], statusCols: ['status','estado'] },
  { table: 'crm."Receivable"', dateCols: ['due','vence','date','createdAt','createdat'], amountCols: ['balance','saldo','amount','importe','total'], statusCols: ['status','estado'] },
  { table: 'public.receivables', dateCols: ['due','vence','date','createdAt','createdat'], amountCols: ['balance','saldo','amount','importe','total'], statusCols: ['status','estado'] },
];

function monthStart(ym?: string|null) {
  if (!ym) return null;
  // ym = "YYYY-MM"
  const [y,m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m-1, 1));
}
function monthEndInclusive(ym?: string|null) {
  if (!ym) return null;
  const [y,m] = ym.split('-').map(Number);
  // último día del mes
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

@Controller('reports')
export class ReportsReceivablesSummaryController {
  constructor(private prisma: PrismaService) {}

  @Get('receivables.summary')
  async summary(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDt = monthStart(from || null);
    const toDt   = monthEndInclusive(to || null);

    // Armamos filtros por rango si los pasaron
    const dateFilter = (col: string) => {
      if (fromDt && toDt)   return `AND ${col} BETWEEN $1 AND $2`;
      if (fromDt && !toDt)  return `AND ${col} >= $1`;
      if (!fromDt && toDt)  return `AND ${col} <= $1`;
      return '';
    };
    const argsFor = () => {
      if (fromDt && toDt) return [fromDt, toDt];
      if (fromDt && !toDt) return [fromDt];
      if (!fromDt && toDt) return [toDt];
      return [];
    };

    // Probar candidatos hasta que uno devuelva filas
    for (const cand of CANDIDATES) {
      for (const dcol of cand.dateCols) {
        for (const acol of cand.amountCols) {
          // 1) Si hay status, sumamos por status
          for (const scol of cand.statusCols) {
            const sql = `
              SELECT
                COALESCE(SUM(CASE WHEN LOWER(${scol}) IN ('cobrado','paid','cobrada') THEN ${acol} ELSE 0 END),0)::bigint AS paid,
                COALESCE(SUM(CASE WHEN LOWER(${scol}) IN ('pendiente','pending') THEN ${acol} ELSE 0 END),0)::bigint AS pending,
                COALESCE(SUM(CASE WHEN LOWER(${scol}) IN ('vencido','overdue') THEN ${acol} ELSE 0 END),0)::bigint AS overdue
              FROM ${cand.table}
              WHERE ${dcol} IS NOT NULL
              ${dateFilter(dcol)}
            `;
            try {
              const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...argsFor());
              const r = rows?.[0];
              if (r && (Number(r.paid)+Number(r.pending)+Number(r.overdue)) >= 0) {
                return {
                  range: { from: from || null, to: to || null },
                  paid: Number(r.paid)||0,
                  pending: Number(r.pending)||0,
                  overdue: Number(r.overdue)||0,
                  _picked: { table: cand.table, dateCol: dcol, amountCol: acol, statusCol: scol }
                };
              }
            } catch { /* intentar siguiente combinación */ }
          }

          // 2) Sin status: inferir por vencimiento vs hoy (balance/importe > 0)
          const sql2 = `
            SELECT
              COALESCE(SUM(CASE WHEN ${acol} <= 0 THEN ${acol} ELSE 0 END),0)::bigint AS paid_like,
              COALESCE(SUM(CASE WHEN ${acol} > 0 AND ${dcol} >= CURRENT_DATE THEN ${acol} ELSE 0 END),0)::bigint AS pending_like,
              COALESCE(SUM(CASE WHEN ${acol} > 0 AND ${dcol} <  CURRENT_DATE THEN ${acol} ELSE 0 END),0)::bigint AS overdue_like
            FROM ${cand.table}
            WHERE ${dcol} IS NOT NULL
            ${dateFilter(dcol)}
          `;
          try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(sql2, ...argsFor());
            const r = rows?.[0];
            if (r && (Number(r.pending_like)+Number(r.overdue_like) >= 0)) {
              return {
                range: { from: from || null, to: to || null },
                paid: Math.abs(Number(r.paid_like)||0),      // si el saldo es 0/negativo lo consideramos cobrado
                pending: Number(r.pending_like)||0,
                overdue: Number(r.overdue_like)||0,
                _picked: { table: cand.table, dateCol: dcol, amountCol: acol, statusCol: null }
              };
            }
          } catch { /* siguiente */ }
        }
      }
    }

    // Fallback (sin datos)
    return { range: { from: from || null, to: to || null }, paid: 0, pending: 0, overdue: 0, _picked: null };
  }
}