// scripts/produce-pt.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOnHand(tx, productId) {
  const moves = await tx.inventoryMove.findMany({ where: { productId } });
  return moves.reduce((acc, m) => acc + (m.direction === 'IN' ? m.qty : -m.qty), 0);
}

async function main() {
  const skuPT = 'PT-CAPRESE-001';
  const skuMP = 'MP-MASA-BASE';
  const qtyOk = 10; // producimos 10 unidades de PT

  await prisma.$transaction(async (tx) => {
    const pt = await tx.product.findUnique({ where: { sku: skuPT } });
    const mp = await tx.product.findUnique({ where: { sku: skuMP } });
    if (!pt || !mp) throw new Error('Falta PT o MP');

    // Receta PT <- MP
    const recipe = await tx.recipe.findUnique({
      where: { productId_componentId: { productId: pt.id, componentId: mp.id } },
    });
    if (!recipe) throw new Error('No existe receta PT↔MP');

    const perUnit = parseFloat(recipe.qtyPerUnit.toString()); // Decimal → number
    const qtyMpNeeded = Math.round(qtyOk * perUnit); // entero para este ejemplo

    // Chequeo de stock MP
    const onHandMP = await getOnHand(tx, mp.id);
    if (onHandMP < qtyMpNeeded) {
      throw new Error(
        `MP insuficiente. Necesario ${qtyMpNeeded}, disponible ${onHandMP}`
      );
    }
    const onHandPT = await getOnHand(tx, pt.id);

    // Crear OP (cerrada directa para el test)
    const po = await tx.productionOrder.create({
      data: { status: 'CERRADA', notes: 'OP demo cierre directo' },
    });

    // Registrar entradas/salidas de la OP
    await tx.poInput.create({
      data: { poId: po.id, productId: mp.id, qty: qtyMpNeeded },
    });
    await tx.poOutput.create({
      data: { poId: po.id, productId: pt.id, qtyOk, qtyMerma: 0 },
    });

    // Movimientos de inventario (Kárdex)
    const moveOutMP = await tx.inventoryMove.create({
      data: {
        productId: mp.id,
        qty: qtyMpNeeded,
        direction: 'OUT',
        reason: 'produccion-out',
        refType: 'productionOrder',
        refId: po.id,
        locationFrom: 'MP',
        onHandAfter: onHandMP - qtyMpNeeded,
      },
    });

    const moveInPT = await tx.inventoryMove.create({
      data: {
        productId: pt.id,
        qty: qtyOk,
        direction: 'IN',
        reason: 'produccion-in',
        refType: 'productionOrder',
        refId: po.id,
        locationTo: 'PT',
        onHandAfter: onHandPT + qtyOk,
      },
    });

    console.log('✅ OP cerrada:', po.id);
    console.log('🔻 OUT MP:', { sku: skuMP, qty: qtyMpNeeded, onHandAfter: moveOutMP.onHandAfter });
    console.log('🔺 IN PT:', { sku: skuPT, qty: qtyOk, onHandAfter: moveInPT.onHandAfter });
  });
}

main()
  .catch((e) => {
    console.error('❌ Error producción:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });