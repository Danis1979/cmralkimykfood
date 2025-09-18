import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('orders')
export class OrdersDetailController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/full')
  async getOrderFull(@Param('id') id: string) {
    const oid = Number(id);

    // 1) cmr."Sale"
    const saleRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT s.id, s."date", c.name AS client, s.total
       FROM cmr."Sale" s
       LEFT JOIN cmr."Client" c ON c.id = s."clientId"
       WHERE s.id = $1`, oid);

    if (saleRows.length) {
      const header = saleRows[0];
      const items = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT si."productId" AS "productId",
                COALESCE(p.name,'(s/n)') AS product,
                si.qty AS qty,
                si.price AS price,
                (si.qty * si.price) AS "lineTotal"
         FROM cmr."SaleItem" si
         LEFT JOIN cmr."Product" p ON p.id = si."productId"
         WHERE si."saleId" = $1
         ORDER BY product ASC`, oid);
      return { ...header, items };
    }

    // 2) Fallback public.orders (sin ítems)
    const ordRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, date, client, total
       FROM public.orders
       WHERE id = $1`, oid);

    if (ordRows.length) {
      return { ...ordRows[0], items: [] };
    }

    // 3) Nada
    return { id: oid, items: [] };
  }
}
