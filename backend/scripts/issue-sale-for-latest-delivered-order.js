// scripts/issue-sale-for-latest-delivered-order.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    // Tomamos el pedido más reciente ENTREGADO
    const order = await tx.order.findFirst({
      where: { status: 'ENTREGADO' },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) throw new Error('No hay pedidos ENTREGADO');

    // Evitar duplicar venta si ya existe
    const existingSale = await tx.sale.findFirst({ where: { orderId: order.id } });
    if (existingSale) {
      console.log('ℹ️ Venta ya existe para el pedido:', existingSale.id);
      return;
    }

    const client = await tx.client.findUnique({ where: { id: order.clientId } });
    const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    if (!client || items.length === 0) throw new Error('Faltan cliente o items');

    // Precio de prueba por unidad (ajustá luego)
    const PRICE = 1000; // ARS por unidad
    const qtyTotal = items.reduce((a, it) => a + it.qty, 0);
    const subtotal = PRICE * qtyTotal;
    const iva = Math.round(subtotal * 0.21); // IVA 21% (redondeo simple)
    const total = subtotal + iva;

    // Crear venta (Cuenta Corriente → generamos AR a 30 días)
    const sale = await tx.sale.create({
      data: {
        orderId: order.id,
        clientId: client.id,
        status: 'EMITIDA',
        pm: 'CuentaCorriente',
        invoiceType: 'B',
        subtotal: String(subtotal),
        iva: String(iva),
        total: String(total),
        notes: 'Venta demo por pedido entregado',
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            qty: it.qty,
            price: String(PRICE),
          })),
        },
      },
      include: { items: true },
    });

    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
    await tx.receivable.create({
      data: {
        saleId: sale.id,
        clientId: client.id,
        dueDate: due,
        balance: String(total),
        status: 'Pendiente',
      },
    });

    console.log('✅ Venta emitida:', sale.id, 'Total ARS', total);
    console.log('🧾 Items:', sale.items.map(i => ({ qty: i.qty, price: i.price.toString() })));
    console.log('📄 Receivable creado a 30 días.');
  });
}

main()
  .catch((e) => { console.error('❌ Error venta:', e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());