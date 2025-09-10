import { ApiTags } from '@nestjs/swagger';

import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { UseInterceptors } from "@nestjs/common";
import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function bucketDays(diff: number) {
  if (diff <= 0) return 'current';
  if (diff <= 30) return '1-30';
  if (diff <= 60) return '31-60';
  if (diff <= 90) return '61-90';
  return '90+';
}

@Controller('reports')
@ApiTags('Reports')

@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class ReportsReceivablesAgingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('receivables-aging')
  async aging(@Query('as_of') asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const recs = await this.prisma.receivable.findMany({
      where: { status: 'Pendiente' as any },
      include: { sale: { include: { client: true } } },
    });

    const items: any[] = [];
    const byClientMap = new Map<string, any>();
    const totals = { current: 0, ['1-30']: 0, ['31-60']: 0, ['61-90']: 0, ['90+']: 0, total: 0 };

    for (const r of recs as any[]) {
      const due = new Date(r.dueDate ?? r.createdAt);
      const diffDays = Math.floor((+asOfDate - +due) / 86400000);
      const bk = bucketDays(diffDays);
      const amt = Number(r.balance ?? r.amount ?? 0);

      totals[bk as keyof typeof totals] += amt;
      totals.total += amt;

      items.push({
        id: r.id,
        client: r.sale?.client?.name ?? '',
        email: r.sale?.client?.email ?? '',
        dueDate: due.toISOString(),
        balance: amt,
        bucket: bk,
      });

      const k = r.sale?.clientId ?? 'unknown';
      const acc = byClientMap.get(k) || {
        clientId: k, client: r.sale?.client?.name ?? '', email: r.sale?.client?.email ?? '',
        current: 0, ['1-30']: 0, ['31-60']: 0, ['61-90']: 0, ['90+']: 0, total: 0
      };
      (acc as any)[bk] += amt;
      acc.total += amt;
      byClientMap.set(k, acc);
    }

    return { asOf: asOfDate.toISOString(), totals, items, byClient: Array.from(byClientMap.values()) };
  }
}
