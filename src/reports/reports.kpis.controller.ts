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

    const p = this.prisma as any;

    // Detectar delegates disponibles (evita reventar si falta alguno en Render)
    const sale = p.sale ?? p.Sale ?? p.ventas ?? p.Ventas;
    const purchase = p.purchase ?? p.Purchase ?? p.compras ?? p.Compras;
    const receivable = p.receivable ?? p.Receivable ?? p.cxc ?? p.cuentas_por_cobrar;

    // ---- Ventas ----
    let sales = 0;
    try {
      if (sale?.aggregate) {
        const agg = await sale.aggregate({
          _sum: { total: true },
          where: { status: 'EMITIDA', createdAt: { gte: start, lt: end } },
        });
        sales = Number(agg._sum?.total ?? 0);
      }
    } catch (e) {
      console.warn('KPIs: sales.aggregate falló:', (e as any)?.message);
    }

    // ---- Compras ----
    let purchases = 0;
    try {
      if (purchase?.aggregate) {
        const agg = await purchase.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: start, lt: end } },
        });
        purchases = Number(agg._sum?.total ?? 0);
      } else if (p.compras?.groupBy && p.precios_ingredientes?.findMany) {
        // fallback: calcula compras por cantidad * precio_unitario
        const precios = await p.precios_ingredientes.findMany();
        const priceMap = new Map(
          precios.map((r: any) => [r.ingrediente, Number(r.precio_unitario || 0)])
        );
        const grupos = await p.compras.groupBy({
          by: ['ingrediente'],
          _sum: { cantidad: true },
          where: { fecha_pago: { gte: start, lt: end } },
        });
        for (const g of grupos) {
          const qty = Number(g._sum?.cantidad ?? 0);
          const pu = priceMap.get(g.ingrediente) ?? 0;
          purchases += qty * pu;
        }
        purchases = Number(purchases.toFixed(2));
      }
    } catch (e) {
      console.warn('KPIs: purchases fallback falló:', (e as any)?.message);
    }

    // ---- CxC pendientes actuales ----
    let receivablesPending = 0;
    try {
      if (receivable?.aggregate) {
        const agg = await receivable.aggregate({
          _sum: { balance: true },
          where: { status: 'Pendiente' },
        });
        receivablesPending = Number(agg._sum?.balance ?? 0);
      }
    } catch (e) {
      console.warn('KPIs: receivables.aggregate falló:', (e as any)?.message);
    }

    // ---- Top client del rango ----
    let topClient: any = null;
    try {
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
          let clientName: string | null = null;
          let email: string | null = null;
          try {
            const clientD =
              p.client ?? p.Client ?? p.cliente ?? p.Cliente ?? p.clientes ?? p.Clientes;
            if (clientD?.findUnique && top.clientId) {
              const c = await clientD.findUnique({ where: { id: top.clientId } });
              clientName = c?.name ?? c?.nombre ?? null;
              email = c?.email ?? c?.correo ?? null;
            }
          } catch {}

          const revenue = Number(top._sum?.total ?? 0);
          const salesCount = Number(top._count?._all ?? 0);
          topClient = {
            clientId: top.clientId ?? null,
            client: clientName,
            email,
            revenue,
            salesCount,
            avgTicket: salesCount ? Number((revenue / salesCount).toFixed(2)) : 0,
          };
        }
      }
    } catch {
      topClient = null;
    }

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: { sales, purchases, net: sales - purchases },
      receivablesPending,
      topClient,
    };
  }
}
