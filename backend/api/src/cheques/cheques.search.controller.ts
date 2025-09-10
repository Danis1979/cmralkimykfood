import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ChequeStatus, ChequeType } from '@prisma/client';

@Controller('cheques-search')
export class ChequesSearchController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('due_from') dueFrom?: string,  // filtra por payDate
    @Query('due_to') dueTo?: string,      // filtra por payDate
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '20',
  ) {
    const _skip = Math.max(0, parseInt(String(skip), 10) || 0);
    const _take = Math.min(100, Math.max(1, parseInt(String(take), 10) || 20));

    let statusEnum: ChequeStatus | undefined;
    if (status) {
      const up = status.toUpperCase() as ChequeStatus;
      if (!Object.values(ChequeStatus).includes(up)) {
        throw new BadRequestException(`status inválido. Usá uno de: ${Object.values(ChequeStatus).join(', ')}`);
      }
      statusEnum = up;
    }

    let typeEnum: ChequeType | undefined;
    if (type) {
      const low = type.toLowerCase() as ChequeType;
      if (!Object.values(ChequeType).includes(low)) {
        throw new BadRequestException(`type inválido. Usá uno de: ${Object.values(ChequeType).join(', ')}`);
      }
      typeEnum = low;
    }

    // rango creación (createdAt)
    let createdAt: { gte?: Date; lte?: Date } | undefined;
    if (dateFrom || dateTo) {
      createdAt = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (isNaN(d.getTime())) throw new BadRequestException('date_from inválida (YYYY-MM-DD)');
        createdAt.gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (isNaN(d.getTime())) throw new BadRequestException('date_to inválida (YYYY-MM-DD)');
        createdAt.lte = d;
      }
    }

    // rango vencimiento (usamos payDate)
    let payDate: { gte?: Date; lte?: Date } | undefined;
    if (dueFrom || dueTo) {
      payDate = {};
      if (dueFrom) {
        const d = new Date(dueFrom);
        if (isNaN(d.getTime())) throw new BadRequestException('due_from inválida (YYYY-MM-DD)');
        payDate.gte = d;
      }
      if (dueTo) {
        const d = new Date(dueTo);
        if (isNaN(d.getTime())) throw new BadRequestException('due_to inválida (YYYY-MM-DD)');
        payDate.lte = d;
      }
    }

    const where: any = {};
    if (statusEnum) where.status = statusEnum;
    if (typeEnum) where.type = typeEnum;
    if (createdAt) where.createdAt = createdAt;
    if (payDate) where.payDate = payDate;

    const [items, total, sumRec, sumEmi] = await Promise.all([
      this.prisma.cheque.findMany({
        where,
        skip: _skip,
        take: _take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cheque.count({ where }),
      this.prisma.cheque.aggregate({
        _sum: { amount: true },
        where: { ...where, type: 'recibido' as ChequeType },
      }),
      this.prisma.cheque.aggregate({
        _sum: { amount: true },
        where: { ...where, type: 'emitido' as ChequeType },
      }),
    ]);

    const toNum = (v: any) => Number(v?.toString?.() ?? v ?? 0);
    const out = items.map((c: any) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      bank: c.bank ?? undefined,
      number: c.number ?? undefined,
      amount: toNum(c.amount),
      dueDate: c.payDate ?? c.issueDate ?? undefined, // mostramos payDate como "dueDate"
      createdAt: c.createdAt,
    }));

    return {
      total,
      skip: _skip,
      take: _take,
      summary: {
        recibidos: toNum(sumRec._sum.amount),
        emitidos: toNum(sumEmi._sum.amount),
        neto: toNum(sumRec._sum.amount) - toNum(sumEmi._sum.amount),
      },
      items: out,
    };
  }
}
