// scripts/stock-mp-in.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mp = await prisma.product.findUnique({ where: { sku: 'MP-MASA-BASE' } });
  if (!mp) throw new Error('MP-MASA-BASE no encontrado');

  const qty = 20; // 20 "kg" de MP para pruebas

  // onHand actual (sumamos movimientos con signo)
  const moves = await prisma.inventoryMove.findMany({ where: { productId: mp.id } });
  const onHand = moves.reduce((acc, m) => acc + (m.direction === 'IN' ? m.qty : -m.qty), 0);

  const move = await prisma.inventoryMove.create({
    data: {
      productId: mp.id,
      qty,
      direction: 'IN',
      reason: 'ajuste',
      refType: 'seed',
      refId: 'stock-mp-initial',
      onHandAfter: onHand + qty,
      locationTo: 'MP',
    },
  });

  console.log('✅ Ajuste IN MP realizado:', {
    sku: mp.sku,
    qty,
    onHandBefore: onHand,
    onHandAfter: move.onHandAfter,
  });
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });