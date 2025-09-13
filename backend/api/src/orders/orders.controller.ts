import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  private parsePaging(qs: Record<string, any>) {
    const limit = Math.min(Math.max(parseInt(qs?.limit ?? '20', 10) || 20, 1), 100);
    const page = Math.max(parseInt(qs?.page ?? '1', 10) || 1, 1);
    const skip = (page - 1) * limit;
    return { limit, page, skip };
  }

  private pickDateKey(sample: any): string | null {
    if (!sample) return null;
    const keys = Object.keys(sample);
    const candidates = ['createdAt','created_at','fecha','date','issuedAt'];
    return candidates.find(k => keys.includes(k)) || null;
  }

  private async listBase(qs: Record<string, any>) {
    const sale = (this.prisma as any).sale;
    if (!sale) return { total: 0, items: [] };

    const { limit, skip } = this.parsePaging(qs);
    try {
      // Descubrimos campo de fecha (si no hay, ordenamos por id)
      const sample = await sale.findFirst({
        select: { id: true, createdAt: true, created_at: true, fecha: true, date: true, issuedAt: true }
      });
      const dateKey = this.pickDateKey(sample);
      const orderBy = dateKey ? { [dateKey]: 'desc' } : { id: 'desc' as const };

      const items = await sale.findMany({ skip, take: limit, orderBy }).catch(() => []);
      const total = await sale.count().catch(() => 0);

      return { total, items };
    } catch (e: any) {
      // Nunca 500: devolvemos vacío y detalle
      return { total: 0, items: [], error: 'orders_fallback', detail: e?.message ?? String(e) };
    }
  }

  @Get()
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  async list(@Query() qs: Record<string, any>) {
    return this.listBase(qs);
  }

  @Get('search')
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'q', required: false, description: 'no-op por ahora' })
  async search(@Query() qs: Record<string, any>) {
    return this.listBase(qs);
  }

  @Get(':id')
  async byId(@Param('id') id: string) {
    const sale = (this.prisma as any).sale;
    if (!sale) return null;
    const numeric = /^\d+$/.test(id) ? Number(id) : id;
    try {
      return (await sale.findUnique({ where: { id: numeric } }))
          ?? (await sale.findFirst({ where: { id } }))
          ?? null;
    } catch {
      return null;
    }
  }

  @Get('_debug')
  async debug() {
    const sale = (this.prisma as any).sale;
    if (!sale) return { delegate: false };
    const rec = await sale.findFirst();
    return { delegate: true, keys: rec ? Object.keys(rec) : [], sample: rec };
  }
}
