// scripts/seed-recipe.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // IDs por SKU que ya cargamos
  const pt = await prisma.product.findUnique({ where: { sku: 'PT-CAPRESE-001' } });
  const mp = await prisma.product.findUnique({ where: { sku: 'MP-MASA-BASE' } });

  if (!pt || !mp) throw new Error('Falta PT-CAPRESE-001 o MP-MASA-BASE');

  // Relación de consumo (placeholder): 1 kg de MP por 1 unidad de PT
  // Luego lo ajustamos a tu receta real.
  const r = await prisma.recipe.upsert({
    where: { productId_componentId: { productId: pt.id, componentId: mp.id } },
    update: { qtyPerUnit: '1.0' },
    create: { productId: pt.id, componentId: mp.id, qtyPerUnit: '1.0' },
  });

  console.log('✅ Receta creada/actualizada:', {
    pt: pt.sku,
    componente: mp.sku,
    qtyPerUnit: r.qtyPerUnit.toString(),
  });
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());