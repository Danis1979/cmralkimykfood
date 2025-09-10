import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('inventory')
export class InventoryController {
  constructor(private prisma: PrismaService) {}

  @Get('stock')
  async stock(@Query('sku') sku?: string, @Query('take') take = '50') {
    if (sku) {
      const p = await this.prisma.product.findUnique({ where: { sku } });
      if (!p) throw new NotFoundException('Producto no encontrado');
      const onHand = await this.getOnHand(p.id);
      const reserved = await this.getReserved(p.id);
      return { items: [{ sku: p.sku, name: p.name, onHand, reserved, available: onHand - reserved }] };
    }
    const n = Math.min(parseInt(take, 10) || 50, 200);
    const products = await this.prisma.product.findMany({ take: n, orderBy: { createdAt: 'desc' } });
    const items = await Promise.all(products.map(async (p) => {
      const [onHand, reserved] = await Promise.all([this.getOnHand(p.id), this.getReserved(p.id)]);
      return { sku: p.sku, name: p.name, onHand, reserved, available: onHand - reserved };
    }));
    return { items };
  }

  private async getOnHand(productId: string) {
    const [inAgg, outAgg] = await Promise.all([
      this.prisma.inventoryMove.aggregate({ where: { productId, direction: 'IN' }, _sum: { qty: true } }),
      this.prisma.inventoryMove.aggregate({ where: { productId, direction: 'OUT' }, _sum: { qty: true } }),
    ]);
    return (inAgg._sum.qty ?? 0) - (outAgg._sum.qty ?? 0);
  }
  private async getReserved(productId: string) {
    const agg = await this.prisma.stockReservation.aggregate({ where: { productId, status: 'ACTIVA' }, _sum: { qty: true } });
    return agg._sum.qty ?? 0;
  }
}