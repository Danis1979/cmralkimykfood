import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsDebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('_debug.orders.sources')
  async sources() {
    const candidates = [
      { from: '"Order"',        dateCols: ['saleDate','date','createdAt','dateKey'] },
      { from: 'orders',         dateCols: ['date','createdAt','dateKey'] },
      { from: 'sales',          dateCols: ['date','createdAt','dateKey'] },
      { from: 'orders_view',    dateCols: ['date','createdAt','dateKey'] },
      { from: 'v_orders',       dateCols: ['date','createdAt','dateKey'] },
    ];
    const out:any = {};
    for (const c of candidates) {
      try {
        const cnt = await this.prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n FROM ${c.from}`);
        const n = cnt?.[0]?.n ?? 0;
        let sample:any = null;
        if (n>0) {
          const cols = ['id','clientId','total','totalNet','net','grandTotal','amount','subtotal','date','saleDate','createdAt','dateKey'];
          const sel = cols.map(x=>`NULLIF(${x}::text,'') AS "${x}"`).join(',');
          const r = await this.prisma.$queryRawUnsafe<any[]>(`SELECT ${sel} FROM ${c.from} ORDER BY 1 DESC LIMIT 1`);
          sample = r?.[0] ?? null;
        }
        out[c.from] = { rows:n, sample };
      } catch (e:any) {
        out[c.from] = { error: String(e?.message || e) };
      }
    }
    return out;
  }
}
