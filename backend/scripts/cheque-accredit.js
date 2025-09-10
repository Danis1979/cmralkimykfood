// scripts/cheque-accredit.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ch = await prisma.cheque.findFirst({
    where: { type: 'recibido', status: 'DEPOSITADO' },
    orderBy: { createdAt: 'desc' },
  });
  if (!ch) throw new Error('No hay cheques DEPOSITADO para acreditar');

  await prisma.cheque.update({ where: { id: ch.id }, data: { status: 'ACREDITADO' } });
  console.log('✅ Cheque acreditado:', ch.id);
}

main().catch(e => { console.error('❌ Error acreditar:', e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());