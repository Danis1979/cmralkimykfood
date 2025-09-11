import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsTopClientsController {
  constructor(private prisma: PrismaService) {}

  @Get('top-clients')
  async topClients(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '10',
  ) {
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    // Traemos ventas con cliente y total, sumamos por cliente.
    const sales = await (this.prisma as any).sale.findMany({
      where,
      select: { client: true, total: true },
    });

    const map = new Map<string, number>();
    for (const s of sales) {
      const key = String((s as any).client);
      const val = Number((s as any).total) || 0;
      map.set(key, (map.get(key) || 0) + val);
    }

    const items = Array.from(map.entries())
      .map(([client, total]) => ({ client, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, Math.max(1, parseInt(limit as string, 10) || 10));

    return { items };
  }
}
