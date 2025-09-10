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

    const [salesAgg, purchasesAgg, receivablesAgg, topGroup] = await Promise.all([
      this.prisma.sale.aggregate({
        _sum: { total: true },
        where: { status: 'EMITIDA', createdAt: { gte: start, lt: end } },
      }),
      this.prisma.purchase.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: start, lt: end } },
      }),
      this.prisma.receivable.aggregate({
        _sum: { balance: true },
        where: { status: 'Pendiente' }, // CxC pendientes actuales
      }),
      this.prisma.sale.groupBy({
        by: ['clientId'],
        where: { status: 'EMITIDA', createdAt: { gte: start, lt: end } },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 1,
      }),
    ]);

    const sales = Number(salesAgg._sum.total || 0);
    const purchases = Number(purchasesAgg._sum.total || 0);
    const net = sales - purchases;
    const receivablesPending = Number(receivablesAgg._sum.balance || 0);

    let topClient: any = null;
    if (topGroup.length) {
      const top = topGroup[0];
      const client = top.clientId
        ? await this.prisma.client.findUnique({ where: { id: top.clientId } })
        : null;
      const revenue = Number(top._sum.total || 0);
      const salesCount = Number(top._count._all || 0);
      topClient = {
        clientId: top.clientId,
        client: client?.name || null,
        email: client?.email || null,
        revenue,
        salesCount,
        avgTicket: salesCount ? Number((revenue / salesCount).toFixed(2)) : 0,
      };
    }

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: { sales, purchases, net },
      receivablesPending,
      topClient,
    };
  }
}
