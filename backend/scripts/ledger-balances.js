// scripts/ledger-balances.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.ledgerEntry.findMany();
  const sign = (t) => (t === 'HABER' ? 1 : -1); // convención usada hasta ahora
  const totals = {};
  for (const e of entries) {
    totals[e.account] = (totals[e.account] || 0) + sign(e.type) * parseFloat(e.amount.toString());
  }
  console.log('📊 Saldos ledger:', totals);
}

main().catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());