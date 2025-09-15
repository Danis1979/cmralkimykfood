import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('reports')
export class ReportsSalesMonthlyController {
  constructor(private readonly prisma: PrismaService) {}

  private parseYm(s?: string): Date | null {
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    return new Date(Date.UTC(y, mo - 1, 1));
  }

  private addMonths(d: Date, n: number): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  }

  private async detectDateKey(sale: any): Promise<string> {
    const cands = ['date', 'fecha', 'issuedAt', 'createdAt', 'created_at'];
    for (const k of cands) {
      try {
        const r = await sale.findFirst({
          select: { [k]: true },
          orderBy: { id: 'desc' } as any,
        });
        if (r && r[k] != null) return k;
      } catch { /* ignore */ }
    }
    return 'date';
  }

  @Get('sales.monthly')
  async monthly(
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
  ) {
    const sale = (this.prisma as any).sale;
    if (!sale) {
      return {
        range: { from: null, to: null },
        series: [],
        meta: { error: 'no_sale_delegate' },
      };
    }

    // Rango: por defecto últimos 6 meses (cerrados)
    let start = this.parseYm(fromQ);
    let endInc = this.parseYm(toQ); // inclusive (fin de mes); luego lo pasamos a exclusivo
    if (!start || !endInc) {
      const now = new Date();
      const firstThisMonth = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1,
      ));
      start = this.addMonths(firstThisMonth, -5);
      endInc = firstThisMonth; // último mes incluido = mes actual
    }
    const endEx = this.addMonths(endInc, 1); // exclusivo para query

    // Campo de fecha (auto)
    const dateKey = await this.detectDateKey(sale);

    // Traer filas y agregar en memoria por YYYY-MM
    let rows: any[] = [];
    try {
      rows = await sale.findMany({
        where: { [dateKey]: { gte: start, lt: endEx } },
        select: {
          [dateKey]: true,
          total: true,
          net: true,
          amount: true,
          totalAmount: true,
        },
        orderBy: { [dateKey]: 'asc' } as any,
        take: 5000,
      });
    } catch (e) {
      return {
        range: { from: start.toISOString(), to: endEx.toISOString() },
        series: [],
        meta: { error: 'query_failed', dateKey },
      };
    }

    // Lista de meses del rango
    const months: string[] = [];
    for (let d = new Date(start); d < endEx; d = this.addMonths(d, 1)) {
      months.push(d.toISOString().slice(0, 7));
    }

    // Acumulador por mes
    const acc: Record<string, number> = {};
    for (const m of months) acc[m] = 0;

    for (const r of rows) {
      const dt = r[dateKey];
      const iso = (dt instanceof Date ? dt : new Date(dt)).toISOString();
      const ym = iso.slice(0, 7);
      const val = Number(r.total ?? r.net ?? r.totalAmount ?? r.amount ?? 0);
      if (Number.isFinite(val)) acc[ym] = (acc[ym] ?? 0) + val;
    }

    const series = months.map(m => ({ month: m, net: acc[m] || 0 }));

    return {
      range: { from: start.toISOString(), to: endEx.toISOString() },
      series,
      meta: { count: rows.length, dateKey },
    };
  }
}
