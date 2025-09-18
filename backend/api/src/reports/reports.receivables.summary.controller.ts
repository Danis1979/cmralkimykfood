import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type TryResult = { table:string, dcol:string|null, acol:string|null, scol:string|null, count:number, error:string|null };

@Controller('reports')
export class ReportsReceivablesSummaryController {
  constructor(private readonly prisma: PrismaService) {}

  private candidates() {
    const tables = [`cmr."Receivable"`, `crm."Receivable"`, `public.receivables`];
    const dateCols = ['dueDate','vence','date','fecha','createdAt','createdat'];
    const amountCols = ['saldo','amount','total','importe'];
    const statusCols = ['estado','status'];
    return { tables, dateCols, amountCols, statusCols };
  }

  private async tryPick(table:string, dcol:string|null, acol:string|null, scol:string|null): Promise<TryResult> {
    const q = `SELECT COUNT(*)::int AS c FROM ${table} LIMIT 1`;
    try {
      const r:any[] = await this.prisma.$queryRawUnsafe(q);
      return { table, dcol, acol, scol, count: Number(r?.[0]?.c ?? 0), error: null };
    } catch {
      return { table, dcol, acol, scol, count: 0, error: 'query_failed' };
    }
  }

  private buildSummarySQL(table:string, dcol:string|null, acol:string|null, scol:string|null){
    if (!acol || !scol) return null;
    if (dcol) {
      return `
        SELECT
          COALESCE(SUM(CASE WHEN ${scol} IN ('Vencido') OR (${scol} IN ('Pendiente') AND ${dcol}::date < CURRENT_DATE) THEN ${acol} ELSE 0 END),0)::numeric AS overdue_total,
          COALESCE(SUM(CASE WHEN ${scol} IN ('Pendiente') AND ${dcol}::date >= CURRENT_DATE THEN ${acol} ELSE 0 END),0)::numeric AS pending_total,
          COALESCE(SUM(CASE WHEN ${scol} IN ('Cobrado','Pagado') THEN ${acol} ELSE 0 END),0)::numeric AS collected_total,
          COUNT(*)::int AS rows
        FROM ${table}
      `;
    }
    return `
      SELECT
        COALESCE(SUM(CASE WHEN ${scol} IN ('Vencido') THEN ${acol} ELSE 0 END),0)::numeric AS overdue_total,
        COALESCE(SUM(CASE WHEN ${scol} IN ('Pendiente') THEN ${acol} ELSE 0 END),0)::numeric AS pending_total,
        COALESCE(SUM(CASE WHEN ${scol} IN ('Cobrado','Pagado') THEN ${acol} ELSE 0 END),0)::numeric AS collected_total,
        COUNT(*)::int AS rows
      FROM ${table}
    `;
  }

  @Get('receivables.summary')
  async receivablesSummary(@Query('debug') debug?: string){
    const { tables, dateCols, amountCols, statusCols } = this.candidates();
    const tried: TryResult[] = [];
    for (const t of tables){
      for (const d of [null, ...dateCols]){
        for (const a of amountCols){
          for (const s of statusCols){
            const tr = await this.tryPick(t,d,a,s);
            tried.push(tr);
            if (tr.error===null && tr.count>0){
              const sql = this.buildSummarySQL(t,d,a,s);
              if (!sql) continue;
              try{
                const rows:any[] = await this.prisma.$queryRawUnsafe(sql);
                const one = rows?.[0] || {};
                const res = {
                  pending:   Number(one.pending_total   ?? 0),
                  overdue:   Number(one.overdue_total   ?? 0),
                  collected: Number(one.collected_total ?? 0),
                  rows:      Number(one.rows ?? 0),
                };
                return debug ? { ...res, _debug:{ picked:{table:t,dcol:d,acol:a,scol:s}, tried } } : res;
              }catch{ /* sigue probando */ }
            }
          }
        }
      }
    }
    const empty = { pending:0, overdue:0, collected:0, rows:0 };
    return debug ? { ...empty, _debug:{ picked:null, tried } } : empty;
  }
}
