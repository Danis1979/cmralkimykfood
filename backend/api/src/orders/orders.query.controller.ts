import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

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

    const statusFilter = status?.toUpperCase().trim() || undefined;

    // Rango de fechas
    let range: { gte?: Date; lte?: Date } | undefined;
    if (dateFrom || dateTo) {
      range = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (isNaN(d.getTime())) throw new BadRequestException('date_from inválida (YYYY-MM-DD)');
        range.gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (isNaN(d.getTime())) throw new BadRequestException('date_to inválida (YYYY-MM-DD)');
        range.lte = d;
      }
    }

    // Si no existe el modelo order en el client, saltamos al legacy
    const canUseOrder =
      (this.prisma as any)?.order && typeof (this.prisma as any).order.findMany === 'function';

    if (canUseOrder) {
      try {
        const whereOrder: any = {};
        if (statusFilter) whereOrder.status = statusFilter;
        if (range) whereOrder.createdAt = range;
        if (clientEmail) whereOrder.client = { email: clientEmail };

        const [items, total] = await Promise.all([
          (this.prisma as any).order.findMany({
            where: whereOrder,
            skip: _skip,
            take: _take,
            orderBy: { createdAt: 'desc' },
            include: {
              client: true,
              items: { include: { product: true } },
            },
          }),
          (this.prisma as any).order.count({ where: whereOrder }),
        ]);

        const out = (items ?? []).map((o: any) => {
          const list: any[] = Array.isArray(o.items) ? o.items : [];
          const subtotal = list.reduce((acc: number, it: any) => {
            const num =
              typeof it.price === 'number'
                ? it.price
                : Number((it.price as any)?.toString?.() ?? it.price ?? 0);
            return acc + num * (Number(it.qty) || 0);
          }, 0);
          return {
            id: o.id,
            status: o.status ?? undefined,
            createdAt: o.createdAt ?? undefined,
            client: o.client?.name ?? o.clientId ?? undefined,
            notes: o.notes ?? undefined,
            subtotal,
            items: list.map((it: any) => ({
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
      } catch (_e) {
        // si falla, continuamos al fallback legacy
      }
    }

    // Fallback LEGACY: sale/date — NO pasar status ni clientEmail (pueden no existir)
    const whereSale: any = {};
    if (range) whereSale.date = range;

    const [items, total] = await Promise.all([
      (this.prisma as any).sale.findMany({
        where: whereSale,
        skip: _skip,
        take: _take,
        orderBy: { date: 'desc' },
        select: { id: true, date: true, client: true, total: true },
      }),
      (this.prisma as any).sale.count({ where: whereSale }),
    ]);

    const out = (items ?? []).map((o: any) => ({
      id: o.id,
      status: o.status ?? undefined,
      createdAt: o.date,
      client: o.client,
      notes: undefined,
      subtotal: typeof o.total === 'number' ? o.total : Number(o.total ?? 0),
      items: [] as any[],
    }));

    return { total, skip: _skip, take: _take, items: out };
  }
}
