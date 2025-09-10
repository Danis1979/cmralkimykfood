import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Controller('deliveries')
export class DeliveriesController {
  constructor(private prisma: PrismaService) {}

  @Post('confirm')
  async confirm(@Body() body: { orderId: string }) {
    if (!body?.orderId) throw new BadRequestException('orderId requerido');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: body.orderId }, include: { items: true } });
      if (!order) throw new BadRequestException('Pedido inexistente');
      if (order.status !== 'CONFIRMADO') {
        throw new BadRequestException(`El pedido debe estar CONFIRMADO (actual=${order.status})`);
      }

      const reservas = await tx.stockReservation.findMany({ where: { orderId: order.id, status: 'ACTIVA' } });
      if (!reservas.length) throw new BadRequestException('No hay reservas activas para este pedido');

      for (const it of order.items) {
        const res = reservas.find((r) => r.productId === it.productId);
        const qty = res?.qty ?? 0;
        if (qty <= 0) continue;

        const onHand = await this.getOnHand(tx, it.productId);
        if (onHand < qty) throw new BadRequestException(`Stock insuficiente para entregar. Necesario ${qty}, onHand ${onHand}`);

        await tx.inventoryMove.create({
          data: {
            productId: it.productId,
            qty,
            direction: 'OUT',
            reason: 'venta-entrega',
            refType: 'order',
            refId: order.id,
            locationFrom: 'PT',
            onHandAfter: onHand - qty,
          },
        });

        await tx.stockReservation.update({ where: { id: res!.id }, data: { status: 'CONSUMIDA' } });
      }

      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'ENTREGADO' } });
      return { id: updated.id, status: updated.status };
    });
  }

  // 👉 FIX: usar el tipo correcto del cliente transaccional
  private async getOnHand(tx: Prisma.TransactionClient, productId: string) {
    const [inAgg, outAgg] = await Promise.all([
      tx.inventoryMove.aggregate({ where: { productId, direction: 'IN' }, _sum: { qty: true } }),
      tx.inventoryMove.aggregate({ where: { productId, direction: 'OUT' }, _sum: { qty: true } }),
    ]);
    return (inAgg._sum.qty ?? 0) - (outAgg._sum.qty ?? 0);
  }
}