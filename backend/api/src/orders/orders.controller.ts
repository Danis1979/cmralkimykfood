import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  private norm(limit?: any, page?: any) {
    const l = Number(limit);
    const p = Number(page);
    return {
      limit: Number.isFinite(l) && l > 0 && l <= 200 ? l : 20,
      page:  Number.isFinite(p) && p > 0 ? p : 1,
    };
  }

  private async listBase(qs: Record<string, any>) {
    const { limit, page } = this.norm(qs.limit, qs.page);
    const skip = (page - 1) * limit;

    const sale = (this.prisma as any).sale;
    if (!sale) return { items: [], total: 0, page, limit };

    const where: any = {};
    if (qs.q && /^\d+$/.test(String(qs.q))) where.id = Number(qs.q);

    let items: any[] = [];
    let total = 0;
    try {
      [items, total] = await Promise.all([
        sale.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        sale.count({ where }),
      ]);
    } catch {
      [items, total] = await Promise.all([
        sale.findMany({ where, skip, take: limit, orderBy: { id: 'desc' } }),
        sale.count({ where }),
      ]);
    }
    return { items, total, page, limit };
  }

  @Get()
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'q', required: false, description: 'id numérico (opcional)' })
  async list(@Query() qs: Record<string, any>) { return this.listBase(qs); }

  @Get('search')
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'q', required: false, description: 'id numérico (opcional)' })
  async search(@Query() qs: Record<string, any>) { return this.listBase(qs); }

  @Get(':id')
  async byId(@Param('id') id: string) {
    const sale = (this.prisma as any).sale;
    if (!sale) return null;
    const numId = /^\d+$/.test(id) ? Number(id) : id;
    return (await sale.findUnique({ where: { id: numId } })) ??
           (await sale.findUnique({ where: { id } })) ?? null;
  }
}
