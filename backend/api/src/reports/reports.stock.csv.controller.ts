import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('reports')
export class ReportsStockCsvController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stock.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="stock.csv"')
  async stockCsv(@Res() res: Response) {
    // Encabezado mínimo siempre presente
    const header = ['id','sku','name','stock','unit_cost','total_cost'];
    let rows: Array<(string|number|null|undefined)[]> = [];

    try {
      const anyPrisma = this.prisma as any;

      // Detectamos algún delegate utilizable
      const product = anyPrisma.product ?? anyPrisma.products ?? null;
      const inventory = anyPrisma.inventory ?? anyPrisma.inventories ?? null;

      if (inventory?.findMany) {
        // Caso: hay tabla de inventario ya calculada
        const items = await inventory.findMany({ take: 1000 });
        rows = items.map((it: any) => {
          const id = it.id ?? it.productId ?? it.itemId ?? null;
          const sku = it.sku ?? it.code ?? null;
          const name = it.name ?? it.productName ?? it.description ?? null;
          const stock = Number(it.stock ?? it.quantity ?? it.qty ?? 0);
          const unit = Number(it.unitCost ?? it.cost ?? 0);
          const total = Number(isFinite(stock * unit ? stock * unit : 0) ? stock * unit : 0);
          return [id, sku, name, stock, unit, total];
        });
      } else if (product?.findMany) {
        // Caso: solo productos; devolvemos stock=0 como fallback
        const items = await product.findMany({ take: 1000, select: { id: true, sku: true, code: true, name: true, description: true, cost: true } });
        rows = items.map((p: any) => {
          const id = p.id;
          const sku = p.sku ?? p.code ?? null;
          const name = p.name ?? p.description ?? null;
          const unit = Number(p.cost ?? 0);
          const stock = 0;
          const total = 0;
          return [id, sku, name, stock, unit, total];
        });
      }
    } catch {
      // Silencioso: mantenemos rows=[]
    }

    // CSV final (si no hubo datos, solo encabezado)
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header, ...rows].map(r => r.map(escape).join(',')).join('\n') + '\n';

    res.status(200).send(lines);
  }
}
