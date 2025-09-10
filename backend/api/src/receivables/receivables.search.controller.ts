import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DocStatus } from '@prisma/client';

@Controller('receivables-search')
export class ReceivablesSearchController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('status') status?: string,            // Pendiente | Vencido | Pagado | Cobrado (según tu enum DocStatus)
    @Query('clientEmail') clientEmail?: string,
    @Query('date_from') dateFrom?: string,       // filtra por createdAt
    @Query('date_to') dateTo?: string,
    @Query('due_from') dueFrom?: string,         // filtra por dueDate
    @Query('due_to') dueTo?: string,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '20',
  ) {
    const _skip = Math.max(0, parseInt(String(skip), 10) || 0);
    const _take = Math.min(100, Math.max(1, parseInt(String(take), 10) || 20));

    // Validar status si viene
    let statusEnum: DocStatus | undefined;
    if (status) {
      const up = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() as DocStatus;
      if (!Object.values(DocStatus).includes(up)) {
        throw new BadRequestException(`status inválido. Usá uno de: ${Object.values(DocStatus).join(', ')}`);
      }
      statusEnum = up;
    }

    // Rangos de fechas
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

    let dueDate: { gte?: Date; lte?: Date } | undefined;
    if (dueFrom || dueTo) {
      dueDate = {};
      if (dueFrom) {
        const d = new Date(dueFrom);
        if (isNaN(d.getTime())) throw new BadRequestException('due_from inválida (YYYY-MM-DD)');
        dueDate.gte = d;
      }
      if (dueTo) {
        const d = new Date(dueTo);
        if (isNaN(d.getTime())) throw new BadRequestException('due_to inválida (YYYY-MM-DD)');
        dueDate.lte = d;
      }
    }

    // WHERE base
    const where: any = {};
    if (statusEnum) where.status = statusEnum;
    if (clientEmail) where.client = { email: clientEmail };
    if (createdAt) where.createdAt = createdAt;
    if (dueDate) where.dueDate = dueDate;

    const [items, total] = await Promise.all([
      this.prisma.receivable.findMany({
        where,
        skip: _skip,
        take: _take,
        orderBy: { createdAt: 'desc' },
        include: { client: true, sale: true },
      }),
      this.prisma.receivable.count({ where }),
    ]);

    const toNum = (v: any) => Number(v?.toString?.() ?? v ?? 0);
    const now = new Date();

    // Sumatorias
    const [sumPendYVenc, sumPag, sumVencido] = await Promise.all([
      this.prisma.receivable.aggregate({
        _sum: { balance: true },
        where: { ...where, status: { in: ['Pendiente', 'Vencido'] as DocStatus[] } as any },
      }),
      this.prisma.receivable.aggregate({
        _sum: { balance: true },
        where: { ...where, status: 'Pagado' as DocStatus },
      }),
      this.prisma.receivable.aggregate({
        _sum: { balance: true },
        where: { ...where, status: { not: 'Pagado' as DocStatus }, dueDate: { lt: now } },
      }),
    ]);

    const out = items.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      client: r.client?.name ?? r.clientId,
      saleId: r.saleId ?? undefined,
      dueDate: r.dueDate,
      balance: toNum((r as any).balance),
      notes: r.sale?.invoiceType ? `Factura ${r.sale.invoiceType}` : undefined,
    }));

    return {
      total,
      skip: _skip,
      take: _take,
      summary: {
        pendiente: toNum(sumPendYVenc._sum.balance),
        pagado: toNum(sumPag._sum.balance),
        vencido: toNum(sumVencido._sum.balance),
        netoPendiente: toNum(sumPendYVenc._sum.balance), // útil para “cobrar”
      },
      items: out,
    };
  }
}
