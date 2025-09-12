import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Query } from '@nestjs/common';

import { PrismaService } from '../prisma.service';

type Range = { start: Date; end: Date };

function parseRange(from?: string, to?: string): Range {
  const now = new Date();
  // por defecto: año en curso
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
      // end exclusivo = primer día del mes siguiente
      end = new Date(Date.UTC(y, mo, 1));
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
    const p: any = this.prisma;

    // Detectar delegates disponibles (nombres reales en Render)
    const sale =
      p.sale || p.Sale || p.ventas || p.Ventas;
    const compras =
      p.purchase || p.compras || p.Purchase || p.Compras;
    const preciosIng =
      p.precios_ingredientes || p.PreciosIngredientes || p.precios || p.preciosIng;
    const receivable =
      p.receivable || p.Receivable || p.cxc || p.cuentas_por_cobrar;

    // --- Ventas ---
    let sales = 0;
    try {
      if (sale?.aggregate) {
        // En el modelo Sale del Render, la fecha es "date"
        const where = sale === p.Sale || sale === p.sale
          ? { date: { gte: start, lt: end } }
          : { createdAt: { gte: start, lt: end } };
        const salesAgg = await sale.aggregate({ _sum: { total: true }, where });
        sales = Number(salesAgg?._sum?.total || 0);
      } else if (p.$queryRaw) {
        // Fallback crudo por si no hay aggregate
        const rows: any = await p.$queryRaw`
          SELECT COALESCE(SUM(total),0) AS total
          FROM "Sale"
          WHERE "date" >= ${start} AND "date" < ${end}
        `;
        sales = Number(rows?.[0]?.total || 0);
      }
    } catch { sales = 0; }

    // --- Compras (sum(cantidad) * precio_unitario de precios_ingredientes) ---
    let purchases = 0;
    try {
      if (compras?.groupBy && preciosIng?.findMany) {
        const groups = await compras.groupBy({
          by: ['ingrediente'],
          where: { fecha_pago: { gte: start, lt: end } }, // campo real en Render
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
      } else {
        purchases = 0;
      }
    } catch { purchases = 0; }

    // --- CxC pendientes (si no existe el modelo, 0) ---
    let receivablesPending = 0;
    try {
      if (receivable?.aggregate) {
        const receivablesAgg = await receivable.aggregate({
          _sum: { balance: true },
          where: { status: { in: ['Pendiente', 'PENDING', 'pending'] } },
        });
        receivablesPending = Number(receivablesAgg?._sum?.balance || 0);
      }
    } catch { receivablesPending = 0; }

    // --- Top client por ventas (en DB Render el campo es "client") ---
    let topClient: any = null;
    try {
      if (sale?.groupBy) {
        const where = sale === p.Sale || sale === p.sale
          ? { date: { gte: start, lt: end } }
          : { createdAt: { gte: start, lt: end } };
        const top = await sale.groupBy({
          by: ['client'],
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
