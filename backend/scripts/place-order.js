// scripts/place-order.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOnHand(tx, productId) {
  const moves = await tx.inventoryMove.findMany({ where: { productId } });
  return moves.reduce((acc, m) => acc + (m.direction === 'IN' ? m.qty : -m.qty), 0);
}
async function getReserved(tx, productId) {
  const res = await tx.stockReservation.findMany({
    where: { productId, status: 'ACTIVA' },
    select: { qty: true },
  });
  return res.reduce((a, r) => a + r.qty, 0);
}

async function main() {
  const qty = 6;                    // pedimos 6 unidades (hay 10 PT)
  const client = await prisma.client.findFirst({ where: { name: 'Cliente Demo' }});
  const pt = await prisma.product.findUnique({ where: { sku: 'PT-CAPRESE-001' }});
  if (!client || !pt) throw new Error('Falta cliente o PT');

  await prisma.$transaction(async (tx) => {
    // Crear pedido
    const order = await tx.order.create({
      data: { clientId: client.id, status: 'BORRADOR', notes: 'Pedido demo' },
    });
    await tx.orderItem.create({
      data: { orderId: order.id, productId: pt.id, qty, price: '0.00' },
    });

    // Confirmar pedido → Reserva
    const onHand = await getOnHand(tx, pt.id);
    const reserved = await getReserved(tx, pt.id);
    const disponible = onHand - reserved;
    if (disponible < qty) throw new Error(`No hay PT disponible. Disponible=${disponible}, pedido=${qty}`);

    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await tx.stockReservation.create({
      data: { orderId: order.id, productId: pt.id, qty, status: 'ACTIVA', expiresAt },
    });
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMADO' },
    });

    console.log('✅ Pedido confirmado y reservado:', updated.id);
    console.log('ℹ️  PT onHand:', onHand, 'reservado vigente:', reserved + qty, 'disponible:', onHand - (reserved + qty));
  });
}

main().catch(e=>{console.error('❌ Error pedido:', e.message||e);process.exit(1)}).finally(()=>prisma.$disconnect());