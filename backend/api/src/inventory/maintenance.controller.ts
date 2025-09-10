import { Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('inventory')
export class InventoryMaintenanceController {
  constructor(private prisma: PrismaService) {}

  // Libera reservas vencidas y cancela pedidos CONFIRMADO sin reservas activas
  @Post('release-expired')
  async releaseExpired() {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1) Marcar EXPIRADA toda reserva ACTIVA vencida
      const toExpire = await tx.stockReservation.findMany({
        where: { status: 'ACTIVA', expiresAt: { lt: now } },
        select: { id: true, orderId: true },
      });

      for (const r of toExpire) {
        await tx.stockReservation.update({
          where: { id: r.id },
          data: { status: 'EXPIRADA' },
        });
      }

      // 2) Cancelar pedidos CONFIRMADO que quedaron sin reservas activas
      const touchedOrderIds = [...new Set(toExpire.map(r => r.orderId).filter(Boolean))] as string[];
      const cancelledOrders: string[] = [];

      for (const orderId of touchedOrderIds) {
        const activeCount = await tx.stockReservation.count({
          where: { orderId, status: 'ACTIVA' },
        });
        const order = await tx.order.findUnique({ where: { id: orderId } });

        if (order && order.status === 'CONFIRMADO' && activeCount === 0) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: 'CANCELADO',
              notes: (order.notes ? order.notes + ' ' : '') + '[auto] cancelado por expiración de reserva',
            },
          });
          cancelledOrders.push(orderId);
        }
      }

      return {
        expiredReservations: toExpire.length,
        cancelledOrders,
        ranAt: now.toISOString(),
      };
    });
  }
}
