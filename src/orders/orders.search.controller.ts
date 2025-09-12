import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('orders/search')
export class OrdersSearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '50',
  ) {
    const where: any = {};
    if (status && status.trim()) where.status = status.trim();

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const _skip = Number.parseInt(skip, 10) || 0;
    const _take = Number.parseInt(take, 10) || 50;

    const [items, total] = await Promise.all([
      (this.prisma as any).order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: _skip,
        take: _take,
      }),
      (this.prisma as any).order.count({ where }),
    ]);

    return { items, total, skip: _skip, take: _take };
  }
}
