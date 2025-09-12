import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type OrderItemInput = { sku: string; qty: number; price?: number };

@Controller('orders')
export class OrdersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query('take') take = '50') {
    const n = Math.min(parseInt(take, 10) || 50, 200);
    const orders = await (this.prisma as any).order.findMany({
      take: n,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });
    return {
      items: orders.map(o => ({
        id: o.id,
        status: o.status,
        clientId: o.clientId,
        items: o.items.map(i => ({ sku: i.product.sku, qty: i.qty, price: i.price })),
        createdAt: o.createdAt,
      })),
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const o = await (this.prisma as any).order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!o) throw new NotFoundException('Pedido no encontrado');
    return {
      id: o.id,
      status: o.status,
      clientId: o.clientId,
      items: o.items.map(i => ({ sku: i.product.sku, qty: i.qty, price: i.price })),
      createdAt: o.createdAt,
      notes: o.notes,
    };
  }

  // Crea BORRADOR. Acepta clientId o clientEmail.
  @Post()
  async create(@Body() body: { clientId?: string; clientEmail?: string; items: OrderItemInput[]; notes?: string }) {
    if (!body?.items?.length) throw new BadRequestException('Faltan items');
    const clientId = await this.resolveClientId(body.clientId, body.clientEmail);

    // Resolver productos por SKU
    const skus = [...new Set(body.items.map(i => i.sku))];
    const products = await (this.prisma as any).product.findMany({ where: { sku: { in: skus } } });
    if (products.length !== skus.length) {
      const found = new Set(products.map(p => p.sku));
      const missing = skus.filter(s => !found.has(s));
      throw new BadRequestException(`SKU inexistente: ${missing.join(', ')}`);
    }
    const bySku = Object.fromEntries(products.map(p => [p.sku, p]));

    const order = await (this.prisma as any).order.create({
      data: {
        clientId,
        status: 'BORRADOR',
        notes: body.notes || null,
        items: {
          create: body.items.map(it => ({
            productId: bySku[it.sku].id,
            qty: it.qty,
            price: it.price != null ? String(it.price) : null,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    return {
      id: order.id,
      status: order.status,
      items: order.items.map(i => ({ sku: i.product.sku, qty: i.qty, price: i.price })),
    };
  }

  // CONFIRMADO → crea reservas si hay disponible suficiente
  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @Body() body?: { ttlHours?: number }) {
    const order = await (this.prisma as any).order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'BORRADOR') throw new BadRequestException(`Solo BORRADOR puede confirmarse (actual=${order.status})`);

    const products = await (this.prisma as any).product.findMany({ where: { id: { in: order.items.map(i => i.productId) } } });
    const ttlMs = ((body?.ttlHours ?? 72) | 0) * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    // Validar disponible por item
    for (const it of order.items) {
      const onHand = await this.getOnHand(it.productId);
      const reserved = await this.getReserved(it.productId);
      const available = onHand - reserved;
      if (available < it.qty) {
        const sku = products.find(p => p.id === it.productId)?.sku || it.productId;
        throw new BadRequestException(`Stock insuficiente para ${sku}. Disponible=${available}, pedido=${it.qty}`);
      }
    }

    // Crear reservas y confirmar
    await this.prisma.$transaction(async (tx) => {
      for (const it of order.items) {
        await (tx as any).stockReservation.create({
          data: {
            orderId: order.id,
            productId: it.productId,
            qty: it.qty,
            status: 'ACTIVA',
            expiresAt,
          },
        });
      }
      await (tx as any).order.update({ where: { id: order.id }, data: { status: 'CONFIRMADO' } });
    });

    // Resumen
    const items = await Promise.all(order.items.map(async (it) => {
      const p = products.find(x => x.id === it.productId)!;
      const onHand = await this.getOnHand(it.productId);
      const reserved = await this.getReserved(it.productId);
      return { sku: p.sku, qty: it.qty, onHand, reserved, available: onHand - reserved };
    }));
    return { id: order.id, status: 'CONFIRMADO', items, expiresAt };
  }

  // Helpers
  private async resolveClientId(clientId?: string, clientEmail?: string) {
    if (clientId) return clientId;
    if (!clientEmail) throw new BadRequestException('Proveé clientId o clientEmail');
    const c = await (this.prisma as any).client.findFirst({ where: { email: clientEmail } });
    if (!c) throw new BadRequestException('Cliente no encontrado (por email)');
    return c.id;
  }

  private async getOnHand(productId: string) {
    const [inAgg, outAgg] = await Promise.all([
      (this.prisma as any).inventoryMove.aggregate({ where: { productId, direction: 'IN' }, _sum: { qty: true } }),
      (this.prisma as any).inventoryMove.aggregate({ where: { productId, direction: 'OUT' }, _sum: { qty: true } }),
    ]);
    return (inAgg._sum.qty ?? 0) - (outAgg._sum.qty ?? 0);
  }

  private async getReserved(productId: string) {
    const agg = await (this.prisma as any).stockReservation.aggregate({
      where: { productId, status: 'ACTIVA' },
      _sum: { qty: true },
    });
    return agg._sum.qty ?? 0;
  }
}