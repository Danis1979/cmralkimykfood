import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('receivables')
export class ReceivablesController {
  constructor(private prisma: PrismaService) {}

  // Listar CxC (por defecto solo Pendiente/Cobrado con saldo > 0)
  @Get()
  async list(@Query('status') status?: 'Pendiente' | 'Cobrado' | 'Pagado', @Query('take') take = '50') {
    const n = Math.min(parseInt(take, 10) || 50, 200);
    const where: any = {};
    if (status) where.status = status;
    const items = await this.prisma.receivable.findMany({
      where,
      take: n,
      orderBy: { createdAt: 'desc' },
      include: { client: true, sale: true },
    });
    return {
      items: items.map((r) => ({
        id: r.id,
        client: r.client?.name ?? r.clientId,
        saleId: r.saleId,
        dueDate: r.dueDate,
        balance: Number(r.balance.toString()),
        status: r.status,
      })),
    };
  }

  // Cobro por Transferencia (parcial o total)
  @Post(':id/pay/transfer')
  async payTransfer(@Param('id') id: string, @Body() body: { amount: number }) {
    const amount = Number(body?.amount);
    if (!amount || amount <= 0) throw new BadRequestException('amount requerido (> 0)');

    return this.prisma.$transaction(async (tx) => {
      const r = await tx.receivable.findUnique({ where: { id }, include: { sale: true, client: true } });
      if (!r) throw new BadRequestException('Receivable no encontrado');
      const balance = Number(r.balance.toString());
      if (balance <= 0) throw new BadRequestException('Saldo ya cancelado');
      if (amount > balance) throw new BadRequestException(`Importe ${amount} mayor al saldo ${balance}`);

      const nuevoSaldo = balance - amount;

      // Ledger: entra a Banco (HABER) por el importe cobrado
      await tx.ledgerEntry.create({
        data: {
          account: 'Banco',
          type: 'HABER',
          amount: String(amount),
          refType: 'receivable',
          refId: r.id,
          description: `Cobro transferencia cliente ${r.client?.name ?? r.clientId} (sale ${r.saleId})`,
        },
      });

      // Actualizar receivable
      await tx.receivable.update({
        where: { id: r.id },
        data: {
          balance: String(nuevoSaldo),
          status: nuevoSaldo <= 0 ? 'Pagado' : 'Cobrado',
        },
      });

      // Cerrar venta si quedó en 0
      if (nuevoSaldo <= 0) {
        await tx.sale.update({ where: { id: r.saleId }, data: { status: 'CERRADA' } });
      }

      return {
        receivableId: r.id,
        saleId: r.saleId,
        charged: amount,
        newBalance: nuevoSaldo,
        status: nuevoSaldo <= 0 ? 'Pagado' : 'Cobrado',
      };
    });
  }

  // Cobro con Cheque (parcial o total; si no pasás amount, cobra el saldo)
  @Post(':id/pay/cheque')
  async payCheque(
    @Param('id') id: string,
    @Body() body: { amount?: number; bank?: string; number?: string; days?: number },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.receivable.findUnique({
        where: { id },
        include: { sale: true, client: true },
      });
      if (!r) throw new BadRequestException('Receivable no encontrado');

      const balance = Number(r.balance.toString());
      if (balance <= 0) throw new BadRequestException('Saldo ya cancelado');

      const amount =
        body?.amount && body.amount > 0 ? Math.min(Number(body.amount), balance) : balance;

      // 1) Registrar cheque recibido
      const ch = await tx.cheque.create({
        data: {
          type: 'recibido',
          bank: body?.bank || 'Banco Cliente',
          number: body?.number || 'AUTO',
          issueDate: new Date(),
          payDate: new Date(Date.now() + ((body?.days ?? 7) * 24 * 60 * 60 * 1000)),
          amount: String(amount),
          status: 'RECIBIDO',
          refType: 'receivable',
          refId: r.id,
          saleId: r.saleId,
        },
      });

      // 2) Ledger: entra a ChequesRecibidos (HABER)
      await tx.ledgerEntry.create({
        data: {
          account: 'ChequesRecibidos',
          type: 'HABER',
          amount: String(amount),
          refType: 'cheque',
          refId: ch.id,
          description: `Cheque recibido de ${r.client?.name ?? r.clientId} (sale ${r.saleId})`,
        },
      });

      // 3) Actualizar receivable
      const nuevoSaldo = balance - amount;
      await tx.receivable.update({
        where: { id: r.id },
        data: {
          balance: String(nuevoSaldo),
          status: nuevoSaldo <= 0 ? 'Pagado' : 'Cobrado',
        },
      });

      // 4) Cerrar la venta si quedó en cero
      if (nuevoSaldo <= 0) {
        await tx.sale.update({ where: { id: r.saleId }, data: { status: 'CERRADA' } });
      }

      return { receivableId: r.id, chequeId: ch.id, charged: amount, newBalance: nuevoSaldo };
    });
  }
}