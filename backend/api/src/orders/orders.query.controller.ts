import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
export class OrdersQueryController {
  constructor(private prisma: PrismaService) {}

  @Get('search')
  async list(
    @Query('status') status?: string,
    @Query('clientEmail') clientEmail?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '20',
  ) {
    const _skip = Math.max(0, parseInt(String(skip), 10) || 0);
    const _take = Math.min(100, Math.max(1, parseInt(String(take), 10) || 20));

    let statusFilter: any | undefined;
    if (status) {
      const up = status.toUpperCase() as OrderStatus;
      if (!Object.values(OrderStatus).includes(up)) {
        throw new BadRequestException(
          `status inválido. Usá uno de: ${Object.values(OrderStatus).join(', ')}`
        );
      }
      statusFilter = up;
    }

    let createdAt: { gte?: Date; lte?: Date } | undefined;
    if (dateFrom || dateTo) {
      createdAt = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (isNaN(d.getTime())) throw new BadRequestException('date_from inválida (YYYY-MM-DD)');
        createdAt.gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (isNaN(d.getTime())) throw new BadRequestException('date_to inválida (YYYY-MM-DD)');
        createdAt.lte = d;
      }
    }

    const where: any = {};
    if (statusFilter) where.status = statusFilter;
    if (createdAt) where.createdAt = createdAt;
    if (clientEmail) where.client = { email: clientEmail };

    const [items, total] = await Promise.all([
      (this.prisma as any).order.findMany({
        where,
        skip: _skip,
        take: _take,
        orderBy: { createdAt: 'desc' },
        include: {
          client: true,
          items: { include: { product: true } },
        },
      }),
      (this.prisma as any).order.count({ where }),
    ]);

    const out = items.map((o) => {
      const subtotal = o.items.reduce((acc, it) => {
        const priceNum =
          typeof it.price === 'number'
            ? it.price
            : Number((it.price as any)?.toString?.() ?? it.price ?? 0);
        return acc + priceNum * it.qty;
      }, 0);
      return {
        id: o.id,
        status: o.status,
        createdAt: o.createdAt,
        client: o.client?.name ?? o.clientId,
        notes: o.notes ?? undefined,
        subtotal,
        items: o.items.map((it) => ({
          sku: it.product?.sku,
          name: it.product?.name,
          qty: it.qty,
          price:
            typeof it.price === 'number'
              ? it.price
              : Number((it.price as any)?.toString?.() ?? it.price ?? 0),
        })),
      };
    });

    return { total, skip: _skip, take: _take, items: out };
  }
}
