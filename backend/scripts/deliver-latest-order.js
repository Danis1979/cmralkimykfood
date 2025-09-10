// scripts/deliver-latest-order.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOnHand(tx, productId) {
  const moves = await tx.inventoryMove.findMany({ where: { productId } });
  return moves.reduce((acc, m) => acc + (m.direction === 'IN' ? m.qty : -m.qty), 0);
}

async function main() {
  await prisma.$transaction(async (tx) => {
    // Tomamos el pedido más reciente CONFIRMADO
    const order = await tx.order.findFirst({
      where: { status: 'CONFIRMADO' },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) throw new Error('No hay pedidos CONFIRMADO');

    // Traemos items y reservas activas del pedido
    const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    const reservas = await tx.stockReservation.findMany({
      where: { orderId: order.id, status: 'ACTIVA' },
    });
    if (!items.length || !reservas.length) throw new Error('Faltan items/reservas');

    // Por simplicidad, entregamos lo reservado (mismo qty por producto)
    for (const it of items) {
      const res = reservas.find(r => r.productId === it.productId);
      const qty = res ? res.qty : 0;
      if (qty <= 0) continue;

      const onHand = await getOnHand(tx, it.productId);
      if (onHand < qty) throw new Error(`Stock insuficiente para entregar. Necesario ${qty}, onHand ${onHand}`);

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

      await tx.stockReservation.update({
        where: { id: res.id },
        data: { status: 'CONSUMIDA' },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'ENTREGADO' },
    });

    console.log('🚚 Entrega confirmada. Pedido:', order.id);
  });
}

main().catch(e=>{console.error('❌ Error entrega:', e.message||e);process.exit(1)}).finally(()=>prisma.$disconnect());