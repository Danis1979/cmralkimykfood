// scripts/seed-client.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'demo@cliente.com';

  const existing = await prisma.client.findFirst({ where: { email } });
  if (existing) {
    console.log('✅ Cliente ya existe:', existing.name, existing.id);
    return;
  }

  const c = await prisma.client.create({
    data: {
      name: 'Cliente Demo',
      cuit: '20-12345678-9',
      address: 'Av. Siempreviva 742',
      email,
      phone: '+54 9 11 5555-5555',
      paymentTerms: 'CTA_CTE_30',
    },
  });
  console.log('✅ Cliente creado:', c.name, c.id);
}

main()
  .catch((e) => { console.error('❌ Error:', e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());