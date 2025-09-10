import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

function parseRange(from?: string, to?: string) {
  const now = new Date();
  let start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  let end = now;
  if (from) {
    const mf = /^(\d{4})-(\d{2})$/.exec(from);
    start = mf ? new Date(Date.UTC(+mf[1], +mf[2]-1, 1)) : new Date(from);
  }
  if (to) {
    const mt = /^(\d{4})-(\d{2})$/.exec(to);
    end = mt ? new Date(Date.UTC(+mt[1], +mt[2], 1)) : new Date(to);
  }
  return { start, end };
}
function qs(params: Record<string, any>) {
  const usp = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsOverviewController {
  @Get('overview')
  async overview(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitRaw?: string
  ) {
    parseRange(from, to);
    const limit = Math.max(1, Math.min(50, Number(limitRaw ?? '5') || 5));

    const base = `${req.protocol}://${req.get('host')}`;
    const headers: Record<string,string> = {};
    const key = String(req.headers['x-api-key'] || '').trim();
    if (key) headers['x-api-key'] = key;
    const _fetch: any = (global as any).fetch;

    async function getJson(path: string) {
      try {
        const r = await _fetch(base + path, { headers });
        if (!r.ok) return { status: r.status, message: `Fetch ${path} => ${r.status}` };
        return await r.json();
      } catch (e: any) {
        return { status: 500, message: `Error ${path}: ${e?.message || e}` };
      }
    }

    const [
      kpis,
      topClients,
      marginByProduct,
      salesVsPurchases,
      inventoryValue,
      productions,
    ] = await Promise.all([
      getJson(`/reports/kpis${qs({ from, to })}`),
      getJson(`/reports/top-clients${qs({ from, to, limit })}`),
      getJson(`/reports/margin-by-product${qs({ from, to, limit })}`),
      getJson(`/reports/sales-vs-purchases${qs({ from, to })}`),
      getJson(`/reports/inventory-value`),
      getJson(`/ops/productions${qs({ skip: 0, take: limit })}`),
    ]);

    const links = {
      csv: {
        topClients: `/reports/top-clients.csv${qs({ from, to, limit })}`,
        marginByProduct: `/reports/margin-by-product.csv${qs({ from, to, limit })}`,
        salesVsPurchases: `/reports/sales-vs-purchases.csv${qs({ from, to })}`,
        inventoryValue: `/reports/inventory-value.csv`,
        productions: `/reports/productions.csv${qs({ from, to })}`,
        inventoryMoves: `/reports/inventory-moves.csv${qs({ from, to })}`,
        receivablesAging: `/reports/receivables-aging.csv${qs({ as_of: to ?? new Date().toISOString().slice(0,10) })}`,
      }
    };

    return {
      range: { from: from ?? null, to: to ?? null },
      limit,
      kpis, topClients, marginByProduct, salesVsPurchases, inventoryValue, productions,
      links,
    };
  }
}
