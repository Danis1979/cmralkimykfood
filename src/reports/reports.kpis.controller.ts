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

  // (opcional) debug en prod
  @Get('_debug_delegates')
  getDelegates() {
    const p: any = this.prisma;
    const keys = Object.keys(p).filter(k => {
      try { return p[k] && (p[k].aggregate || p[k].groupBy || p[k].findMany); }
      catch { return false; }
    }).sort();
    return { delegates: keys };
  }

  @Get('kpis')
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM o ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM o ISO date' })
  async getKpis(@Query('from') from?: string, @Query('to') to?: string) {
    const { start, end } = parseRange(from, to);
    const p: any = this.prisma;

    // Delegates dinámicos según existan en runtime
    const sale = p.sale || p.Sale || p.ventas || p.Ventas;                  // Render: Model "Sale" => delegate "sale"
    const compras = p.purchase || p.compras || p.Purchase || p.Compras;     // Render: "compras"
    const preciosIng = p.precios_ingredientes || p.PreciosIngredientes;     // Render: "precios_ingredientes"
    const receivable = p.receivable || p.Receivable || p.cxc;               // Puede NO existir en Render

    // --- Ventas ---
    let sales = 0;
    try {
      if (sale?.aggregate) {
        const where = (sale === p.Sale || sale === p.sale)
          ? { date: { gte: start, lt: end } }        // Render: "Sale.date"
          : { createdAt: { gte: start, lt: end } };
        const salesAgg = await sale.aggregate({ _sum: { total: true }, where });
        sales = Number(salesAgg?._sum?.total || 0);
      } else if (p.$queryRaw) {
        const rows: any = await p.$queryRaw`
          SELECT COALESCE(SUM(total),0) AS total
          FROM "Sale"
          WHERE "date" >= ${start} AND "date" < ${end}
        `;
        sales = Number(rows?.[0]?.total || 0);
      }
    } catch { sales = 0; }

    // --- Compras: sum(cantidad) * precio_unitario (si existen tablas) ---
    let purchases = 0;
    try {
      if (compras?.groupBy && preciosIng?.findMany) {
        const groups = await compras.groupBy({
          by: ['ingrediente'],
          where: { fecha_pago: { gte: start, lt: end } },
          _sum: { cantidad: true },
        });
        const precios = await preciosIng.findMany();
        const priceMap = new Map(
          precios.map((r: any) => [r.ingrediente, Number(r.precio_unitario || 0)])
        );
        for (const g of groups) {
          const qty = Number(g?._sum?.cantidad || 0);
          const pu = priceMap.get(g.ingrediente);
          if (pu) purchases += qty * pu;
        }
      }
    } catch { purchases = 0; }

    // --- CxC pendientes (si no hay modelo, queda 0) ---
    let receivablesPending = 0;
    try {
      if (receivable?.aggregate) {
        const agg = await receivable.aggregate({
          _sum: { balance: true },
          where: { status: { in: ['Pendiente', 'PENDING', 'pending'] } },
        });
        receivablesPending = Number(agg?._sum?.balance || 0);
      }
    } catch { receivablesPending = 0; }

    // --- Top client por ventas ---
    let topClient: any = null;
    try {
      if (sale?.groupBy) {
        const where = (sale === p.Sale || sale === p.sale)
          ? { date: { gte: start, lt: end } }
          : { createdAt: { gte: start, lt: end } };
        const top = await sale.groupBy({
          by: ['client'], // Render: campo "client" en Sale
          where,
          _sum: { total: true },
          _count: { _all: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 1,
        });
        if (top?.length) {
          const t = top[0];
          const revenue = Number(t?._sum?.total || 0);
          const salesCount = Number(t?._count?._all || 0);
          topClient = {
            client: t.client,
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
