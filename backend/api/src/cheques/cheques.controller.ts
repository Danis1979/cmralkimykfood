import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ChequeStatus } from '@prisma/client';

@Controller('cheques')
export class ChequesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query('status') status?: string) {
    // Validamos y convertimos el string al enum ChequeStatus (RECIBIDO, DEPOSITADO, etc.)
    let where: { status?: ChequeStatus } | undefined = undefined;
    if (status) {
      const upper = status.toUpperCase() as ChequeStatus;
      if (!Object.values(ChequeStatus).includes(upper)) {
        throw new BadRequestException(
          `status inválido. Usá uno de: ${Object.values(ChequeStatus).join(', ')}`
        );
      }
      where = { status: upper };
    }

    const items = await this.prisma.cheque.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  // Depositar un cheque RECIBIDO -> mueve a Banco (ledger) y pasa a DEPOSITADO
  @Post(':id/deposit')
  async deposit(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const ch = await tx.cheque.findUnique({ where: { id } });
      if (!ch) throw new BadRequestException('Cheque no encontrado');
      if (ch.type !== 'recibido' || ch.status !== 'RECIBIDO') {
        throw new BadRequestException('El cheque debe ser RECIBIDO para depositar');
      }

      await tx.ledgerEntry.create({
        data: {
          account: 'ChequesRecibidos',
          type: 'DEBE', // limpia ChequesRecibidos
          amount: ch.amount.toString(),
          refType: 'cheque',
          refId: ch.id,
          description: 'Depósito de cheque',
        },
      });
      await tx.ledgerEntry.create({
        data: {
          account: 'Banco',
          type: 'HABER', // entra a banco
          amount: ch.amount.toString(),
          refType: 'cheque',
          refId: ch.id,
          description: 'Depósito de cheque',
        },
      });

      const up = await tx.cheque.update({ where: { id: ch.id }, data: { status: 'DEPOSITADO' } });
      return { id: up.id, status: up.status };
    });
  }

  // Acreditar un cheque DEPOSITADO -> solo cambia el estado
  @Post(':id/accredit')
  async accredit(@Param('id') id: string) {
    const ch = await this.prisma.cheque.findUnique({ where: { id } });
    if (!ch) throw new BadRequestException('Cheque no encontrado');
    if (ch.type !== 'recibido' || ch.status !== 'DEPOSITADO') {
      throw new BadRequestException('El cheque debe estar DEPOSITADO para acreditar');
    }
    const up = await this.prisma.cheque.update({ where: { id }, data: { status: 'ACREDITADO' } });
    return { id: up.id, status: up.status };
  }

  // ======== NUEVOS HANDLERS PARA CHEQUES EMITIDOS ========

  // ENTREGAR cheque emitido (EMITIDO -> ENTREGADO)
  @Post('emitted/:id/deliver')
  async deliverEmitted(@Param('id') id: string) {
    const ch = await this.prisma.cheque.findUnique({ where: { id } });
    if (!ch) throw new BadRequestException('Cheque no encontrado');
    if (ch.type !== 'emitido' || ch.status !== 'EMITIDO') {
      throw new BadRequestException('El cheque debe estar EMITIDO para entregar');
    }
    const up = await this.prisma.cheque.update({ where: { id }, data: { status: 'ENTREGADO' } });
    return { id: up.id, status: up.status };
  }

  // DEBITAR cheque emitido (ENTREGADO -> DEBITADO) + ledger
  @Post('emitted/:id/debit')
  async debitEmitted(@Param('id') id: string) {
    return this.prisma.$transaction(async (tx) => {
      const ch = await tx.cheque.findUnique({ where: { id } });
      if (!ch) throw new BadRequestException('Cheque no encontrado');
      if (ch.type !== 'emitido' || ch.status !== 'ENTREGADO') {
        throw new BadRequestException('El cheque debe estar ENTREGADO para debitar');
      }

      // 1) Limpiar ChequesEmitidos (HABER)
      await tx.ledgerEntry.create({
        data: {
          account: 'ChequesEmitidos',
          type: 'HABER',
          amount: ch.amount.toString(),
          refType: 'cheque',
          refId: ch.id,
          description: 'Débito de cheque (limpia ChequesEmitidos)',
        },
      });

      // 2) Salida de Banco (DEBE)
      await tx.ledgerEntry.create({
        data: {
          account: 'Banco',
          type: 'DEBE',
          amount: ch.amount.toString(),
          refType: 'cheque',
          refId: ch.id,
          description: 'Débito de cheque',
        },
      });

      const up = await tx.cheque.update({ where: { id }, data: { status: 'DEBITADO' } });
      return { id: up.id, status: up.status };
    });
  }
}