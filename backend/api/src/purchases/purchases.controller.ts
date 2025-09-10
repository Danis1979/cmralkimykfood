import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type PurchaseItemInput = { sku: string; qty: number; price: number };

@Controller('purchases')
export class PurchasesController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(@Body() body: { supplierName?: string; supplierId?: string; items: PurchaseItemInput[]; notes?: string }) {
    if (!body?.items?.length) throw new BadRequestException('Faltan items');

    // Resolver proveedor
    let supplierId = body.supplierId;
    if (!supplierId) {
      if (!body.supplierName) throw new BadRequestException('supplierId o supplierName requerido');
      const s = await this.prisma.supplier.findFirst({ where: { name: body.supplierName } });
      if (!s) throw new BadRequestException('Proveedor no encontrado');
      supplierId = s.id;
    }

    // Resolver productos por SKU
    const skus = [...new Set(body.items.map(i => i.sku))];
    const products = await this.prisma.product.findMany({ where: { sku: { in: skus } } });
    if (products.length !== skus.length) {
      const found = new Set(products.map(p => p.sku));
      const missing = skus.filter(s => !found.has(s));
      throw new BadRequestException(`SKU inexistente: ${missing.join(', ')}`);
    }
    const bySku = Object.fromEntries(products.map(p => [p.sku, p]));

    // Totales
    const total = body.items.reduce((a, it) => a + it.qty * it.price, 0);

    // Crear compra + IN + cheque emitido + ledger
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId,
          pm: 'Cheque',
          total: String(total),
          status: 'EMITIDA',
          notes: body.notes || 'Compra vía API',
          items: {
            create: body.items.map(it => ({
              productId: bySku[it.sku].id,
              qty: it.qty,
              price: String(it.price),
            })),
          },
        },
        include: { items: true },
      });

      // IN de cada item al stock (kárdex)
      for (const it of purchase.items) {
        const moves = await tx.inventoryMove.findMany({ where: { productId: it.productId } });
        const onHandBefore = moves.reduce((a, m) => a + (m.direction === 'IN' ? m.qty : -m.qty), 0);
        await tx.inventoryMove.create({
          data: {
            productId: it.productId,
            qty: it.qty,
            direction: 'IN',
            reason: 'compra',
            refType: 'purchase',
            refId: purchase.id,
            locationTo: 'MP',
            onHandAfter: onHandBefore + it.qty,
          },
        });
      }

      // Cheque emitido (queda EMITIDO)
      const ch = await tx.cheque.create({
        data: {
          type: 'emitido',
          bank: 'Banco Demo',
          number: 'AUTO',
          issueDate: new Date(),
          payDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          amount: String(total),
          status: 'EMITIDO',
          refType: 'purchase',
          refId: purchase.id,
          purchaseId: purchase.id,
        },
      });

      // Ledger: ChequesEmitidos (DEBE)
      await tx.ledgerEntry.create({
        data: {
          account: 'ChequesEmitidos',
          type: 'DEBE',
          amount: String(total),
          refType: 'cheque',
          refId: ch.id,
          description: `Cheque emitido por compra ${purchase.id}`,
        },
      });

      return {
        id: purchase.id,
        total,
        chequeId: ch.id,
        chequeStatus: 'EMITIDO',
      };
    });
  }
}