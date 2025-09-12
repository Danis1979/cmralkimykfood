import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { UseInterceptors, Controller, Get, Query } from '@nestjs/common';
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
      const d = new Date(from); if (!isNaN(+d)) start = d;
    }
  }
  if (to) {
    const m = mm(to);
    if (m) {
      const [y, mo] = m.split('-').map(Number);
      end = new Date(Date.UTC(y, mo, 1)); // exclusivo
    } else {
      const d = new Date(to); if (!isNaN(+d)) end = d;
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

    // soportar distintos nombres según el esquema en Render vs local
    const sale = p.sale || p.Sale || p.ventas || p.Ventas;
    const purchase = p.purchase || p.Purchase;
    const receivable = p.receivable || p.Receivable;
    const compras = p.compras;
    const precios = p.precios_ingredientes;

    // --- SALES ---
    let sales = 0;
    try {
      if (sale && typeof sale.aggregate === 'function') {
        try {
          const agg = await sale.aggregate({
            _sum: { total: true },
            where: { createdAt: { gte: start, lt: end }, status: 'EMITIDA' },
          });
          sales = Number(agg?._sum?.total || 0);
        } catch {
          try {
            const agg = await sale.aggregate({
              _sum: { total: true },
              where: { createdAt: { gte: start, lt: end } },
            });
            sales = Number(agg?._sum?.total || 0);
          } catch {
            const agg = await sale.aggregate({
              _sum: { total: true },
              where: { date: { gte: start, lt: end } },
            });
            sales = Number(agg?._sum?.total || 0);
          }
        }
      }
    } catch { sales = 0; }

    // --- PURCHASES ---
    let purchases = 0;
    try {
      if (purchase && typeof purchase.aggregate === 'function') {
        try {
          const agg = await purchase.aggregate({
            _sum: { total: true },
            where: { createdAt: { gte: start, lt: end } },
          });
          purchases = Number(agg?._sum?.total || 0);
        } catch {
          const agg = await purchase.aggregate({
            _sum: { total: true },
            where: { date: { gte: start, lt: end } },
          });
          purchases = Number(agg?._sum?.total || 0);
        }
      } else if (
        compras && typeof compras.groupBy === 'function' &&
        precios && typeof precios.findMany === 'function'
      ) {
        // Fallback: sum(cantidad) * precio_unitario
        const items = await compras.groupBy({
          by: ['ingrediente'],
          _sum: { cantidad: true },
          where: { fecha_pago: { gte: start, lt: end } },
        });
        const priceRows = await precios.findMany();
        const priceMap = new Map(priceRows.map((r: any) =>
          [r.ingrediente, Number(r.precio_unitario || 0)]
        ));
        purchases = items.reduce((acc: number, r: any) =>
          acc + Number(r?._sum?.cantidad || 0) * (priceMap.get(r.ingrediente) ?? 0), 0);
      }
    } catch { purchases = 0; }

    // --- RECEIVABLES ---
    let receivablesPending = 0;
    try {
      if (receivable && typeof receivable.aggregate === 'function') {
        try {
          const agg = await receivable.aggregate({
            _sum: { balance: true },
            where: { status: 'Pendiente' },
          });
          receivablesPending = Number(agg?._sum?.balance || 0);
        } catch {
          const agg = await receivable.aggregate({ _sum: { balance: true } });
          receivablesPending = Number(agg?._sum?.balance || 0);
        }
      }
    } catch { receivablesPending = 0; }

    // --- TOP CLIENT ---
    let topClient: any = null;
    try {
      if (sale && typeof sale.groupBy === 'function') {
        let group: any[] = [];
        try {
          group = await sale.groupBy({
            by: ['clientId'],
            where: { createdAt: { gte: start, lt: end }, status: 'EMITIDA' },
            _sum: { total: true },
            _count: { _all: true },
            orderBy: { _sum: { total: 'desc' } },
            take: 1,
          });
        } catch {
          try {
            group = await sale.groupBy({
              by: ['clientId'],
              where: { createdAt: { gte: start, lt: end } },
              _sum: { total: true },
              _count: { _all: true },
              orderBy: { _sum: { total: 'desc' } },
              take: 1,
            });
          } catch {
            group = await sale.groupBy({
              by: ['client'],
              where: { date: { gte: start, lt: end } },
              _sum: { total: true },
              _count: { _all: true },
              orderBy: { _sum: { total: 'desc' } },
              take: 1,
            });
          }
        }
        if (group.length) {
          const top = group[0];
          const revenue = Number(top?._sum?.total || 0);
          const salesCount = Number(top?._count?._all || 0);
          topClient = {
            clientId: (top as any).clientId ?? null,
            client: (top as any).client ?? null,
            revenue,
            salesCount,
            avgTicket: salesCount ? Number((revenue / salesCount).toFixed(2)) : 0,
          };
        }
      }
    } catch { topClient = null; }

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: { sales, purchases, net: sales - purchases },
      receivablesPending,
      topClient,
    };
  }
}
