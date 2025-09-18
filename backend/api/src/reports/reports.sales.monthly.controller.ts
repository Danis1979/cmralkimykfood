import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type Tbl = { schema: string; name: string; ref: string };

@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private readonly prisma: PrismaService) {}

  private quoteIdent(id: string) {
    return /^[a-z_][a-z0-9_]*$/.test(id) ? id : `"${id.replaceAll('"','""')}"`;
  }

  private async candidateTables(): Promise<Tbl[]> {
    const q = `
      SELECT table_schema AS schema, table_name AS name
      FROM information_schema.tables
      WHERE table_type IN ('BASE TABLE','VIEW')
        AND table_schema NOT IN ('pg_catalog','information_schema')
        AND (table_name ILIKE '%order%' OR table_name ILIKE '%sale%')
      ORDER BY table_schema, table_name
    `;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(q);
    const boost = (t:string) => (['Order','orders','Sale','sales'].includes(t) ? 0 : 1);
    const list = (rows ?? []).map(r => {
      const ref = `${this.quoteIdent(r.schema)}.${this.quoteIdent(r.name)}`;
      return { schema: r.schema, name: r.name, ref };
    }).sort((a,b)=> boost(a.name)-boost(b.name) || a.schema.localeCompare(b.schema) || a.name.localeCompare(b.name));
    // extras por si acaso
    const extras: Tbl[] = [
      { schema:'public', name:'Order',  ref: `public."Order"` },
      { schema:'public', name:'orders', ref: `public.orders`  },
    ];
    const seen = new Set(list.map(x=>x.ref));
    for (const e of extras) if (!seen.has(e.ref)) list.unshift(e);
    return list;
  }

  // Devuelve nombres de columnas **reales** (con su casing) que matcheen candidatos (case-insensitive)
  private async pickCols(tbl: Tbl, candidates: string[]): Promise<string[]> {
    const q = `
      SELECT column_name, lower(column_name) AS lc
      FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
    `;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(q, tbl.schema, tbl.name);
    const byLc = new Map<string,string>();
    for (const r of rows ?? []) byLc.set(String(r.lc), String(r.column_name));
    const out: string[] = [];
    for (const c of candidates) {
      const orig = byLc.get(c.toLowerCase());
      if (orig) out.push(orig);
    }
    return out;
  }

  private buildDateExpr(alias: string, colsReal: string[]) {
    const parts: string[] = [];
    for (const orig of colsReal) {
      const lc = orig.toLowerCase();
      if (lc === 'datekey' || lc === 'date_key') {
        parts.push(`
          CASE 
            WHEN ${alias}."${orig}" ~ '^[0-9]{8}$' THEN to_date(${alias}."${orig}",'YYYYMMDD')::timestamptz
            WHEN ${alias}."${orig}" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (${alias}."${orig}")::date::timestamptz
            WHEN ${alias}."${orig}" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN (${alias}."${orig}")::timestamptz
            ELSE NULL
          END
        `);
      } else {
        parts.push(`(${alias}."${orig}")::timestamptz`);
      }
    }
    return parts.length ? `COALESCE(${parts.join(',')})` : 'NULL';
  }

  private buildAmountExpr(alias: string, colsReal: string[]) {
    const casts = colsReal.map(orig => `(${alias}."${orig}")::numeric`);
    return casts.length ? `COALESCE(${casts.join(',')},0)` : '0';
  }

  private async tryMonthly(tbl: Tbl, fromMonth?: string, toMonth?: string) {
    const dcols = await this.pickCols(tbl, ['date','saleDate','createdAt','dateKey','fecha']);
    const acols = await this.pickCols(tbl, ['total','net','totalNet','grandTotal','amount','totalAmount','subtotal']);
    if (!dcols.length || !acols.length) return { rows: [], meta: { tbl, dcols, acols } };

    const d = this.buildDateExpr('o', dcols);
    const a = this.buildAmountExpr('o', acols);

    const where: string[] = [`${d} IS NOT NULL`];
    if (fromMonth) where.push(`${d} >= to_date('${fromMonth}','YYYY-MM')`);
    if (toMonth)   where.push(`${d} < (to_date('${toMonth}','YYYY-MM') + interval '1 month')`);

    const sql = `
      SELECT to_char(date_trunc('month', ${d}), 'YYYY-MM') AS month,
             SUM(${a})::numeric AS net
      FROM ${tbl.ref} o
      WHERE ${where.join(' AND ')}
      GROUP BY 1
      ORDER BY 1
    `;
    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(sql);
      return { rows: Array.isArray(rows) ? rows : [], meta: { tbl, dcols, acols } };
    } catch (e) {
      return { rows: [], meta: { tbl, dcols, acols, error: 'query_failed' } };
    }
  }

  @Get('sales.monthly')
  async salesMonthly(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('debug') debug?: string,
  ) {
    const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : undefined);
    const fromMonth = mm(from);
    const toMonth   = mm(to);

    const tables = await this.candidateTables();
    const tried: any[] = [];
    let picked: string | null = null;
    let rows: any[] = [];

    for (const t of tables) {
      const r = await this.tryMonthly(t, fromMonth, toMonth);
      tried.push({ table: t.ref, dcols: r.meta.dcols, acols: r.meta.acols, count: r.rows.length, error: r.meta.error ?? null });
      if (r.rows.length > 0) {
        rows = r.rows;
        picked = t.ref;
        break;
      }
    }

    const payload: any = {
      range: { from: fromMonth ?? null, to: toMonth ?? null },
      series: rows.map(r => ({ month: r.month, net: Number(r.net) || 0 })),
    };
    if (debug) payload._debug = { picked, tried, tables: tables.map(t=>t.ref) };
    return payload;
  }
}
