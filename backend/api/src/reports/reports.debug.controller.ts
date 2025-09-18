import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsDebugController {
  constructor(private readonly prisma: PrismaService) {}

  // Escanea tablas candidatas y muestra count + 1 fila de ejemplo
  @Get('_debug.orders.sources')
  async sources() {
    const candidates = [
      '"Order"',
      'orders',
      '"Orders"',
      'orders_view',
      'v_orders'
    ];

    const out: any = {};
    for (const t of candidates) {
      try {
        const cnt = await this.prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n FROM ${t}`);
        const n = cnt?.[0]?.n ?? 0;
        let sample: any = null;
        if (n > 0) {
          // traemos columnas típicas de fecha e importe si existen
          const cols = [
            'id','clientId','customerId',
            'total','net','totalNet','grandTotal','amount','totalAmount','subtotal',
            'date','saleDate','createdAt','dateKey','fecha'
          ];
          const list = cols.map(c => `CASE WHEN to_regclass('${t}') IS NOT NULL AND EXISTS(
            SELECT 1 FROM information_schema.columns WHERE table_name = replace(lower('${t}'),'"','') AND lower(column_name)=lower('${c}')
          ) THEN ${c}::text ELSE NULL END AS "${c}"`).join(',');
          const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT ${list} FROM ${t} ORDER BY 1 DESC LIMIT 1`);
          sample = rows?.[0] ?? null;
        }
        out[t] = { rows: n, sample };
      } catch (e:any) {
        out[t] = { error: String(e?.message || e) };
      }
    }
    return out;
  }
}
