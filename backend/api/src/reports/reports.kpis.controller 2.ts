import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors, Controller, Get, Query } from "@nestjs/common";
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
    const p: any = this.prisma;
    const { sale, purchase, receivable, client, compras, precios_ingredientes } = p;

    // Ventas
    let sales = 0;
    if (sale?.aggregate) {
      const salesAgg = await sale.aggregate({
        _sum: { total: true },
        where: { status: 'EMITIDA', createdAt: { gte: start, lt: end } },
      });
      sales = Number(salesAgg._sum?.total ?? 0);
    }

    // Compras (nativo o fallback con compras x precios_ingredientes)
    let purchases = 0;
    if (purchase?.aggregate) {
      const purchasesAgg = await purchase.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: start, lt: end } },
      });
      purchases = Number(purchasesAgg._sum?.total ?? 0);
    } else if (compras?.groupBy && precios_ingredientes?.findMany) {
      const grupos = await compras.groupBy({
        by: ['ingrediente'],
        _sum: { cantidad: true },
        where: { fecha_pago: { gte: start, lt: end } },
      });
      const precios = await precios_ingredientes.findMany({
        where: { ingrediente: { in: grupos.map((g: any) => g.ingrediente) } },
      });
      const mapa = new Map(precios.map((p: any) => [p.ingrediente, Number(p.precio_unitario || 0)]));
      for (const g of grupos) {
        const qty = Number(g._sum?.cantidad ?? 0);
        const pu = mapa.get(g.ingrediente) || 0;
        purchases += qty * pu;
      }
    }

    // CxC pendientes
    let receivablesPending = 0;
    if (receivable?.aggregate) {
      const recAgg = await receivable.aggregate({
        _sum: { balance: true },
        where: { status: 'Pendiente' },
      });
      receivablesPending = Number(recAgg._sum?.balance ?? 0);
    }

    // Top cliente
    let topClient: any = null;
    if (sale?.groupBy) {
      const topGroup = await sale.groupBy({
        by: ['clientId'],
        where: { status: 'EMITIDA', createdAt: { gte: start, lt: end } },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 1,
      });
      if (topGroup.length) {
        const top = topGroup[0];
        const cli = top.clientId && client?.findUnique
          ? await client.findUnique({ where: { id: top.clientId } })
          : null;
        const revenue = Number(top._sum?.total ?? 0);
        const salesCount = Number(top._count?._all ?? 0);
        topClient = {
          clientId: top.clientId ?? null,
          client: cli?.name ?? null,
          email: cli?.email ?? null,
          revenue,
          salesCount,
          avgTicket: salesCount ? Number((revenue / salesCount).toFixed(2)) : 0,
        };
      }
    }

    const net = sales - purchases;
    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: { sales, purchases, net },
      receivablesPending,
      topClient,
    };
  }
}
