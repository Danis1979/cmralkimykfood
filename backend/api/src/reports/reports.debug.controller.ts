import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsDebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('_debug.orders.sources')
  async sources() {
    const candidates = [
      'public."Order"', 'public.orders', 'public."Orders"', 'public.orders_view', 'public.v_orders'
    ];
    const out:any = {};
    for (const t of candidates) {
      try {
        const cnt = await this.prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n FROM ${t}`);
        const n = cnt?.[0]?.n ?? 0;
        let sample:any = null;
        if (n>0) {
          const cols = ['id','clientId','total','net','totalNet','grandTotal','amount','totalAmount','subtotal','date','saleDate','createdAt','dateKey','fecha'];
          const sel = cols.map(x=>`CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=replace(lower('${t}'),'public.','') AND lower(column_name)=lower('${x}')) THEN ${x}::text ELSE NULL END AS "${x}"`).join(',');
          const r = await this.prisma.$queryRawUnsafe<any[]>(`SELECT ${sel} FROM ${t} ORDER BY 1 DESC LIMIT 1`);
          sample = r?.[0] ?? null;
        }
        out[t] = { rows:n, sample };
      } catch (e:any) {
        out[t] = { error: String(e?.message || e) };
      }
    }
    return out;
  }
}
