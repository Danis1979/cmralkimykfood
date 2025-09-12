// @ts-nocheck
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type PaymentMethod = 'CuentaCorriente' | 'Contado' | 'Transferencia' | 'Cheque';
type InvoiceType = 'A' | 'B';

@Controller('sales')
export class SalesController {
  constructor(private prisma: PrismaService) {}

  @Post('issue')
  async issue(@Body() body: { orderId: string; paymentMethod?: PaymentMethod; invoiceType?: InvoiceType }) {
    if (!body?.orderId) throw new BadRequestException('orderId requerido');
    const pm: PaymentMethod = body.paymentMethod || 'CuentaCorriente';
    const invoiceType: InvoiceType = body.invoiceType || 'B';

    return this.prisma.$transaction(async (tx) => {
      // 1) Pedido ENTREGADO + items
      const order = await (tx as any).order.findUnique({ where: { id: body.orderId }, include: { items: true } });
      if (!order) throw new BadRequestException('Pedido inexistente');
      if (order.status !== 'ENTREGADO') throw new BadRequestException(`El pedido debe estar ENTREGADO (actual=${order.status})`);

      // Evitar duplicados
      const existing = await (tx as any).sale.findFirst({ where: { orderId: order.id } });
      if (existing) return { id: existing.id, status: existing.status, note: 'Venta ya existe para este pedido' };

      // Resolver productos para saber SKU (solo para respuesta)
      const products = await (tx as any).product.findMany({ where: { id: { in: order.items.map(i => i.productId) } } });
      const byId = Object.fromEntries(products.map(p => [p.id, p]));

      // 2) Totales (usa price del item; si es null, 0)
      const subtotal = order.items.reduce((acc, it) => acc + (Number(it.price ?? 0) * it.qty), 0);
      const iva = Math.round(subtotal * 0.21);
      const total = subtotal + iva;

      // 3) Crear venta + items
      const sale = await (tx as any).sale.create({
        data: {
          orderId: order.id,
          clientId: order.clientId,
          status: pm === 'CuentaCorriente' ? 'EMITIDA' : 'CERRADA',
          pm: pm as any,
          invoiceType,
          subtotal: String(subtotal),
          iva: String(iva),
          total: Number(total),
          notes: 'Venta emitida vía API',
          items: {
            create: order.items.map(it => ({
              productId: it.productId,
              qty: it.qty,
              price: String(Number(it.price ?? 0)),
            })),
          },
        },
        include: { items: true },
      });

      // 4) Tesorería / Cuentas por cobrar según PM
      if (pm === 'CuentaCorriente') {
        const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
        await (tx as any).receivable.create({
          data: {
            saleId: sale.id,
            clientId: order.clientId,
            dueDate: due,
            balance: String(total),
            status: 'Pendiente',
          },
        });
      } else if (pm === 'Contado' || pm === 'Transferencia') {
        // Ingreso directo a Banco
        await (tx as any).ledgerEntry.create({
          data: {
            account: 'Banco',
            type: 'HABER',
            amount: String(total),
            refType: 'sale',
            refId: sale.id,
            description: `Cobro ${pm} venta ${sale.id}`,
          },
        });
      } else if (pm === 'Cheque') {
        // Cheque recibido + ledger a ChequesRecibidos
        const ch = await (tx as any).cheque.create({
          data: {
            type: 'recibido',
            bank: 'Banco Cliente',
            number: 'AUTO',
            issueDate: new Date(),
            payDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            amount: String(total),
            status: 'RECIBIDO',
            refType: 'sale',
            refId: sale.id,
            saleId: sale.id,
          },
        });
        await (tx as any).ledgerEntry.create({
          data: {
            account: 'ChequesRecibidos',
            type: 'HABER',
            amount: String(total),
            refType: 'cheque',
            refId: ch.id,
            description: `Cheque recibido por venta ${sale.id}`,
          },
        });
      }

      return {
        id: sale.id,
        status: sale.status,
        pm,
        invoiceType,
        subtotal,
        iva,
        total,
        items: sale.items.map(i => ({ sku: byId[i.productId]?.sku ?? i.productId, qty: i.qty, price: i.price.toString() })),
      };
    });
  }
}