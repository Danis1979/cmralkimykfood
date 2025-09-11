import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('products')
export class ProductsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query('take') take = '50') {
    const n = Math.min(parseInt(take, 10) || 50, 100);
    const items = await (this.prisma as any).product.findMany({
      take: n,
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }
}