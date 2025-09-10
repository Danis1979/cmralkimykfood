// scripts/ar-pay-transfer.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const IMPORTE = 4000; // podés cambiar este monto (ARS)

  await prisma.$transaction(async (tx) => {
    // Tomo el último receivable con saldo > 0
    const r = await tx.receivable.findFirst({
      where: { balance: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      include: { sale: true, client: true },
    });
    if (!r) throw new Error('No hay cuentas por cobrar con saldo');

    const balanceActual = parseFloat(r.balance.toString());
    const importe = Math.min(IMPORTE, balanceActual);
    const nuevoSaldo = balanceActual - importe;

    // Asiento en ledger (Banco / HABER)
    await tx.ledgerEntry.create({
      data: {
        account: 'Banco',
        type: 'HABER',
        amount: String(importe),
        refType: 'receivable',
        refId: r.id,
        description: `Cobro transferencia cliente ${r.client.name} (sale ${r.saleId})`,
      },
    });

    // Actualizo receivable
    await tx.receivable.update({
      where: { id: r.id },
      data: {
        balance: String(nuevoSaldo),
        status: nuevoSaldo <= 0 ? 'Pagado' : 'Cobrado',
      },
    });

    // Si quedó en cero, cierro la venta
    if (nuevoSaldo <= 0) {
      await tx.sale.update({ where: { id: r.saleId }, data: { status: 'CERRADA' } });
    }

    console.log('✅ Cobro registrado (Transferencia)');
    console.log('   Sale:', r.saleId);
    console.log('   Importe:', importe);
    console.log('   Saldo anterior:', balanceActual, '→ Saldo nuevo:', nuevoSaldo);
  });
}

main()
  .catch((e) => { console.error('❌ Error cobro:', e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());