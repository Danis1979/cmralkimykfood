// scripts/cheque-deposit.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const ch = await tx.cheque.findFirst({
      where: { type: 'recibido', status: 'RECIBIDO' },
      orderBy: { createdAt: 'desc' },
    });
    if (!ch) throw new Error('No hay cheques RECIBIDOS para depositar');

    // Mover de ChequesRecibidos → Banco en ledger
    await tx.ledgerEntry.create({
      data: {
        account: 'ChequesRecibidos',
        type: 'DEBE',             // limpiamos ChequesRecibidos
        amount: ch.amount.toString(),
        refType: 'cheque',
        refId: ch.id,
        description: 'Depósito de cheque',
      },
    });
    await tx.ledgerEntry.create({
      data: {
        account: 'Banco',
        type: 'HABER',            // entra al banco (seguimos nuestra convención)
        amount: ch.amount.toString(),
        refType: 'cheque',
        refId: ch.id,
        description: 'Depósito de cheque',
      },
    });

    await tx.cheque.update({ where: { id: ch.id }, data: { status: 'DEPOSITADO' } });
    console.log('🏦 Cheque depositado:', ch.id);
  });
}

main().catch(e => { console.error('❌ Error depósito:', e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());