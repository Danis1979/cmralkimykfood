// scripts/seed-mp.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mp = await prisma.product.create({
    data: {
      sku: 'MP-MASA-BASE',
      name: 'Masa base',
      type: 'MP',       // MP = materia prima
      uom: 'kg',
      costStd: '0.00',
      active: true,
    },
  });

  const countMP = await prisma.product.count({ where: { type: 'MP' } });
  console.log('✅ Insumo creado:', mp.id, mp.sku);
  console.log('🧱 Total insumos (MP):', countMP);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());