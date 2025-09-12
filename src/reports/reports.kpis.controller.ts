import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type Range = { start: Date; end: Date };

function parseRange(from?: string, to?: string): Range {
  const now = new Date();
  let start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  let end = new Date();

  const mm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? s : null);

  if (from) {
    const m = mm(from);
    if (m) {
      const [y, mo] = m.split('-').map(Number);
      start = new Date(Date.UTC(y, mo - 1, 1));
    } else {
      const d = new Date(from);
      if (!isNaN(+d)) start = d;
    }
  }
  if (to) {
    const m = mm(to);
    if (m) {
      const [y, mo] = m.split('-').map(Number);
      end = new Date(Date.UTC(y, mo, 1)); // exclusivo
    } else {
      const d = new Date(to);
      if (!isNaN(+d)) end = d;
    }
  }
  return { start, end };
}

@ApiTags('Reports')
@Controller('reports')
@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsKpisController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('kpis')
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM o ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM o ISO date' })
  async getKpis(@Query('from') from?: string, @Query('to') to?: string) {
    const { start, end } = parseRange(from, to);
    const p: any = this.prisma as any;

    // ---- Ventas (Sale) ----
    const salesAgg = p.sale?.aggregate
      ? await p.sale.aggregate({
          _sum: { total: true },
          where: { date: { gte: start, lt: end } },
        })
      : { _sum: { total: 0 } };

    const sales = Number(salesAgg._sum?.total ?? 0);

    // ---- Compras (compras) * precios_ingredientes ----
    // Sumamos cantidad * precio_unitario por ingrediente en el rango.
    let purchases = 0;
    if (p.compras?.findMany && p.precios_ingredientes?.findMany) {
      const [rows, prices] = await Promise.all([
        p.compras.findMany({
          where: { fecha_pago: { gte: start, lt: end } },
          select: { ingrediente: true, cantidad: true },
        }),
        p.precios_ingredientes.findMany({
          select: { ingrediente: true, precio_unitario: true },
        }),
      ]);
      const priceMap = new Map<string, number>();
      for (const pr of prices) priceMap.set(pr.ingrediente, Number(pr.precio_unitario || 0));
      for (const r of rows) {
        const qty = Number(r.cantidad || 0);
        const pu = priceMap.get(r.ingrediente) ?? 0;
        purchases += qty * pu;
      }
    }

    // ---- CxC pendientes (no hay modelo) ----
    const receivablesPending = 0;

    // ---- Top client (agrupando por Sale.client) ----
    let topClient: any = null;
    if (p.sale?.groupBy) {
      const top = await p.sale.groupBy({
        by: ['client'],
        where: { date: { gte: start, lt: end } },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 1,
      });
      if (top.length) {
        const revenue = Number(top[0]._sum?.total || 0);
        const count = Number(top[0]._count?._all || 0);
        topClient = {
          client: top[0].client,
          revenue,
          salesCount: count,
          avgTicket: count ? Number((revenue / count).toFixed(2)) : 0,
        };
      }
    }

    const net = Number((sales - purchases).toFixed(2));

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: { sales: Number(sales.toFixed?.(2) ?? sales), purchases: Number(purchases.toFixed(2)), net },
      receivablesPending,
      topClient,
    };
  }
}
