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
    // 🔎 Buscamos en TODAS las schemas (excepto sistema) tablas/vistas con "order" o "sale" en el nombre
    const q = `
      SELECT table_schema AS schema, table_name AS name
      FROM information_schema.tables
      WHERE table_type IN ('BASE TABLE','VIEW')
        AND table_schema NOT IN ('pg_catalog','information_schema')
        AND (table_name ILIKE '%order%' OR table_name ILIKE '%sale%')
      ORDER BY table_schema, table_name
    `;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(q);
    // preferimos nombres típicos primero
    const boost = (t:string) => (['Order','orders','sales','sale','Sales'].includes(t) ? 0 : 1);
    const list = (rows ?? []).map(r => {
      const ref = `${this.quoteIdent(r.schema)}.${this.quoteIdent(r.name)}`;
      return { schema: r.schema, name: r.name, ref };
    }).sort((a,b)=> boost(a.name)-boost(b.name) || a.schema.localeCompare(b.schema) || a.name.localeCompare(b.name));
    // fallback extras por si no aparecen (edge raro)
    const extras: Tbl[] = [
      { schema:'public', name:'Order',  ref: `public."Order"` },
      { schema:'public', name:'orders', ref: `public.orders`  },
    ];
    const seen = new Set(list.map(x=>x.ref));
    for (const e of extras) if (!seen.has(e.ref)) list.unshift(e);
    return list;
  }

  private async existingCols(tbl: Tbl, cand: string[]): Promise<string[]> {
    const q = `
      SELECT lower(column_name) AS c
      FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
    `;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(q, tbl.schema, tbl.name);
    const have = new Set((rows??[]).map(r=>String(r.c)));
    return cand.filter(c => have.has(c.toLowerCase()));
  }

  private buildDateExpr(alias: string, cols: string[]) {
    const parts: string[] = [];
    for (const c of cols) {
      if (c === 'datekey') {
        parts.push(`
          CASE 
            WHEN ${alias}."dateKey" ~ '^[0-9]{8}$' THEN to_date(${alias}."dateKey",'YYYYMMDD')::timestamptz
            WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (${alias}."dateKey")::date::timestamptz
            WHEN ${alias}."dateKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN (${alias}."dateKey")::timestamptz
            ELSE NULL
          END
        `);
      } else {
        parts.push(`(${alias}."${c}")::timestamptz`);
      }
    }
    if (parts.length === 0) return 'NULL';
    return `COALESCE(${parts.join(',')})`;
  }

  private buildAmountExpr(alias: string, cols: string[]) {
    const casts = cols.map(c => `(${alias}."${c}")::numeric`);
    return casts.length ? `COALESCE(${casts.join(',')},0)` : '0';
  }

  private async tryMonthly(tbl: Tbl, fromMonth?: string, toMonth?: string) {
    const dcols = await this.existingCols(tbl, ['date','saledate','createdat','datekey','fecha']);
    const acols = await this.existingCols(tbl, ['total','net','totalnet','grandtotal','amount','totalamount','subtotal']);
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
    } catch {
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
    let picked: any = null;
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
