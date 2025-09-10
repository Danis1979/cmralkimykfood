// scripts/seed-product.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Producto mínimo (PT)
  const p = await prisma.product.create({
    data: {
      sku: 'PT-CAPRESE-001',
      name: 'Milanesa de Soja Caprese',
      type: 'PT',           // PT=producto terminado, MP=insumo (después lo estandarizamos)
      uom: 'unidad',
      costStd: '0.00',
      priceList: '0.00',
      active: true,
    },
  });

  const count = await prisma.product.count();
  console.log('✅ Producto creado:', p.id, p.sku);
  console.log('📦 Total productos:', count);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });