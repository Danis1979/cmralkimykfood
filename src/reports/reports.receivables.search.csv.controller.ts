import { ApiTags } from '@nestjs/swagger';

// backend/api/src/reports/reports.receivables.search.csv.controller.ts
import { Controller, Get, Query, Res, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';

type Dir = 'asc' | 'desc';
function csv(s?: string) { return String(s ?? '').replace(/"/g, '""'); }
function fix(n: number) { return Number.isFinite(n) ? n.toFixed(2) : '0.00'; }

// YYYY-MM  -> inicio/fin de mes (UTC)
// YYYY-MM-DD -> fecha exacta
function parseRange(from?: string, to?: string) {
  let gte: Date | undefined;
  let lt: Date | undefined;

  const m = (s: string) => {
    const [y, mm] = s.split('-').map(Number);
    return new Date(Date.UTC(y, (mm ?? 1) - 1, 1));
  };
  if (from) {
    gte = /^\d{4}-\d{2}$/.test(from) ? m(from) : new Date(from);
  }
  if (to) {
    if (/^\d{4}-\d{2}$/.test(to)) {
      const start = m(to);
      lt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    } else {
      const d = new Date(to);
      lt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
    }
  }
  return { gte, lt };
}

function buildOrder(order?: string) {
  // soporta ?order=dueDate:asc,createdAt:desc,client:asc
  const pairs = (order || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(tok => {
      const [f, d] = tok.split(':');
      const dir = (String(d || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc') as Dir;
      switch ((f || '').toLowerCase()) {
        case 'duedate':   return { dueDate: dir } as any;
        case 'createdat': return { createdAt: dir } as any;
        case 'status':    return { status: dir } as any;
        case 'client':    return { client: { name: dir } } as any;
        default:          return { createdAt: 'desc' as const };
      }
    });
  return pairs.length ? pairs : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
}

@UseInterceptors(CacheInterceptor)
@Controller('reports')
@ApiTags('Reports')

export class ReportsReceivablesSearchCsvController {
  constructor(private prisma: PrismaService) {}

  @CacheTTL(60)
  @Get('receivables-search.csv')
  async receivablesCsv(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,        // OPEN | PAID | OVERDUE | etc (lo que uses)
    @Query('client') clientQ?: string,       // substring
    @Query('order') order?: string,          // dueDate:asc,client:asc,...
    @Query('limit') limitStr?: string,
    @Query('skip')  skipStr?: string,
  ) {
    const { gte, lt } = parseRange(from, to);
    const take = Math.max(1, Math.min(1000, Number(limitStr || 500)));
    const skip = Math.max(0, Number(skipStr || 0));
    const orderBy = buildOrder(order);

    const where: any = {};
    if (gte || lt) where.createdAt = { ...(gte && { gte }), ...(lt && { lt }) };
    if (status && status.trim()) where.status = status.trim().toUpperCase();
    if (clientQ && clientQ.trim()) {
      where.client = { is: { OR: [
        { name:  { contains: clientQ, mode: 'insensitive' } },
        { email: { contains: clientQ, mode: 'insensitive' } },
      ] } };
    }

    const rows = await (this.prisma as any).receivable.findMany({
      where,
      include: { client: true, sale: true },
      orderBy,
      take, skip,
    });

    const header = 'Id,CreatedAt,DueDate,Status,Client,Email,Amount,Paid,Balance,Notes';
    const lines = rows.map((r: any) => {
      const amount  = Number(r.amount ?? 0);
      const paid    = Number(r.paid   ?? 0);
      const balance = amount - paid;
      return [
        r.id,
        r.createdAt?.toISOString() ?? '',
        r.dueDate?.toISOString() ?? '',
        r.status ?? '',
        csv(r.client?.name ?? ''),
        csv(r.client?.email ?? ''),
        fix(amount),
        fix(paid),
        fix(balance),
        csv(r.notes ?? ''),
      ].map(v => String(v)).join(',');
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="receivables-search.csv"');
    res.send([header, ...lines].join('\n'));
  }
}