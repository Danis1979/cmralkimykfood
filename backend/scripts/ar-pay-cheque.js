// scripts/ar-pay-cheque.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    // Última cuenta por cobrar con saldo
    const r = await tx.receivable.findFirst({
      where: { balance: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      include: { sale: true, client: true },
    });
    if (!r) throw new Error('No hay cuentas por cobrar con saldo');

    const balance = parseFloat(r.balance.toString());
    const importe = balance; // cobramos el total pendiente (ajusta si querés parcial)
    if (importe <= 0) throw new Error('Saldo ya está en 0');

    // Registrar cheque recibido
    const ch = await tx.cheque.create({
      data: {
        type: 'recibido',
        bank: 'Banco Demo',
        number: '00012345',
        issueDate: new Date(),
        payDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // a 7 días
        amount: String(importe),
        status: 'RECIBIDO',
        refType: 'receivable',
        refId: r.id,
        saleId: r.saleId,
      },
    });

    // Asiento de ingreso a ChequesRecibidos (HABER)
    await tx.ledgerEntry.create({
      data: {
        account: 'ChequesRecibidos',
        type: 'HABER',
        amount: String(importe),
        refType: 'cheque',
        refId: ch.id,
        description: `Cheque recibido de ${r.client.name} por sale ${r.saleId}`,
      },
    });

    // Bajar saldo del receivable
    await tx.receivable.update({
      where: { id: r.id },
      data: {
        balance: '0',
        status: 'Pagado',
      },
    });
    await tx.sale.update({ where: { id: r.saleId }, data: { status: 'CERRADA' } });

    console.log('✅ Cheque recibido:', ch.id, 'importe', importe);
    console.log('🧾 Receivable', r.id, '→ Pagado (saldo 0)');
  });
}

main().catch(e => { console.error('❌ Error cheque:', e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());