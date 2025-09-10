// backend/api/src/ops/ops.controller.ts
import { parseOrder } from '../common/order.util';
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProduceDto } from './dto/produce.dto';
import { randomUUID } from 'crypto';

type Dir = 'asc' | 'desc';

// ---- Helper: orderBy a partir de ?order=campo:dir,campo2:dir2 ----
function buildOrderBy(order?: string) {
  // Intentamos usar parseOrder si existe y devuelve algo razonable
  let pairs: Array<{ field: string; dir?: Dir }> = [];
  try {
    const out = (parseOrder as any)?.(order);
    if (Array.isArray(out)) {
      // normalizamos a {field, dir}
      pairs = out
        .map((p: any) =>
          Array.isArray(p)
            ? {
                field: String(p[0] ?? '').trim(),
                dir: String(p[1] ?? 'asc').toLowerCase() as Dir,
              }
            : {
                field: String(p?.field ?? '').trim(),
                dir: String(p?.dir ?? 'asc').toLowerCase() as Dir,
              },
        )
        .filter((p) => p.field);
    }
  } catch {
    // ignoramos y caemos al parser local
  }

  // Fallback simple si no hay parseOrder o no devolvió nada
  if (!pairs.length && order && order.trim()) {
    pairs = order
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((tok) => {
        const [fRaw, dRaw] = tok.split(':');
        const field = String(fRaw ?? '').trim().toLowerCase();
        const dir = String(dRaw ?? 'asc').trim().toLowerCase() as Dir;
        return field ? { field, dir: dir === 'desc' ? 'desc' : 'asc' } : null;
      })
      .filter(Boolean) as Array<{ field: string; dir: Dir }>;
  }

  const mapField = (f: string, dir: Dir) => {
    // mapeos conocidos -> Prisma orderBy
    switch (f) {
      case 'date':
      case 'createdat':
        return { createdAt: dir };
      case 'qty':
        return { qty: dir };
      case 'sku':
        return { product: { sku: dir } };
      case 'name':
        return { product: { name: dir } };
      default:
        // fallback a campo directo (si existiese)
        return { [f]: dir } as any;
    }
  };

  const orderBy = pairs.map((p) => mapField(p.field.toLowerCase(), p.dir ?? 'asc'));
  // default seguro
  return orderBy.length ? orderBy : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
}

@Controller('ops')
export class OpsController {
  constructor(private prisma: PrismaService) {}

  @Post('produce')
  async produce(@Body() body: ProduceDto) {
    try {
      const sku = (body?.sku || '').trim();
      const qty = body?.qty as number; // class-transformer ya lo hace número
      if (!sku || !isFinite(qty) || qty <= 0) {
        throw new HttpException('sku y qty (num>0) son requeridos', HttpStatus.BAD_REQUEST);
      }

      // PT
      const pt = await this.prisma.product.findUnique({ where: { sku } });
      if (!pt) throw new HttpException('PT no encontrado por sku', HttpStatus.BAD_REQUEST);
      if (pt.type !== 'PT') throw new HttpException('El sku indicado no es un PT', HttpStatus.BAD_REQUEST);

      // Receta
      const recipe = await this.prisma.recipe.findMany({
        where: { productId: pt.id },
        include: { component: true },
      });

      const components = recipe.map((r) => ({
        id: r.componentId,
        sku: r.component?.sku,
        name: r.component?.name,
        need: Number(r.qtyPerUnit) * qty, // si tu modelo usa Int, vamos a redondear
      }));

      // OnHand helper
      const onHandFor = async (productId: string) => {
        const [ins, outs] = await Promise.all([
          this.prisma.inventoryMove.aggregate({
            where: { productId, direction: 'IN' as any },
            _sum: { qty: true },
          }),
          this.prisma.inventoryMove.aggregate({
            where: { productId, direction: 'OUT' as any },
            _sum: { qty: true },
          }),
        ]);
        return Number(ins._sum.qty ?? 0) - Number(outs._sum.qty ?? 0);
      };

      // Faltantes
      const shortages: Array<{ sku: string; need: number; onHand: number; missing: number }> = [];
      for (const c of components) {
        const stock = await onHandFor(c.id);
        if (stock < c.need) {
          shortages.push({
            sku: c.sku || '',
            need: c.need,
            onHand: stock,
            missing: Number((c.need - stock).toFixed(4)),
          });
        }
      }
      if (shortages.length)
        throw new HttpException({ message: 'Faltante de MP', shortages }, HttpStatus.BAD_REQUEST);

      // Usamos un batchId para agrupar IN y OUT de la misma producción
      const batchId = randomUUID();

      // Movimientos: OUT MP, IN PT
      const result = await this.prisma.$transaction(async (tx) => {
        // OUT de insumos
        if (components.length) {
          for (const c of components) {
            const q = Math.round(c.need); // qty es Int en tu modelo
            await tx.inventoryMove.create({
              data: {
                productId: c.id,
                direction: 'OUT' as any,
                qty: q,
                reason: 'PRODUCCION',
                refType: 'PROD',
                refId: batchId,
              } as any,
            });
          }
        }
        // IN PT
        const inQty = Math.round(qty);
        const inPt = await tx.inventoryMove.create({
          data: {
            productId: pt.id,
            direction: 'IN' as any,
            qty: inQty,
            reason: 'PRODUCCION',
            refType: 'PROD',
            refId: batchId,
          } as any,
        });

        const onHandPt = await onHandFor(pt.id);
        const consumed: { sku: string; consumed: number; onHandAfter: number }[] = [];
        for (const c of components) {
          const oh = await onHandFor(c.id);
          consumed.push({ sku: c.sku || '', consumed: Math.round(c.need), onHandAfter: oh });
        }

        return {
          batchId,
          produced: { sku: pt.sku, qty: inQty, onHandAfter: onHandPt },
          consumed,
          moveId: inPt.id,
        };
      });

      return result;
    } catch (e: any) {
      const msg = e?.message || 'Error';
      const code = e?.code || e?.name;
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { message: 'Produce failed', code, detail: msg, cause: e?.meta || e },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('productions')
  async productions(
    @Query('take') takeQ?: string,
    @Query('skip') skipQ?: string,
    @Query('order') order?: string,     // orden múltiple: date:desc,sku:asc
    @Query('sku') sku?: string,         // filtro por SKU
    @Query('direction') dirQ?: string,  // IN | OUT
    @Query('from') from?: string,       // YYYY-MM o YYYY-MM-DD
    @Query('to') to?: string,           // YYYY-MM o YYYY-MM-DD
  ) {
    const take = Math.max(1, Math.min(100, Number(takeQ || 20)));
    const skip = Math.max(0, Number(skipQ || 0));
    const orderBy = buildOrderBy(order);

    // --- helpers de rango ---
    const parseMonth = (s: string) => {
      // '2025-09' -> comienzo de mes en Z
      const [y, m] = s.split('-').map(Number);
      if (!y || !m) return null;
      return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    };
    const parseDay = (s: string) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    let gte: Date | undefined;
    let lt: Date | undefined;

    if (from) {
      if (/^\d{4}-\d{2}$/.test(from)) {
        gte = parseMonth(from)!;
      } else {
        gte = parseDay(from) || undefined;
      }
    }
    if (to) {
      if (/^\d{4}-\d{2}$/.test(to)) {
        const start = parseMonth(to)!;
        lt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0));
      } else {
        // si viene día, usamos <= fin del día → lt = next day 00:00Z
        const d = parseDay(to);
        if (d) {
          lt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
        }
      }
    }

    // --- where dinámico ---
    const where: any = { reason: 'PRODUCCION' as any };
    if (sku?.trim()) {
      where.product = { is: { sku: sku.trim() } };
    }
    if (/^(IN|OUT)$/i.test(dirQ || '')) {
      where.direction = (dirQ as any).toUpperCase();
    }
    if (gte || lt) {
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lt) where.createdAt.lt = lt;
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryMove.findMany({
        where,
        include: { product: true }, // para sku/name
        orderBy,
        take,
        skip,
      }),
      this.prisma.inventoryMove.count({ where }),
    ]);

    return {
      total,
      skip,
      take,
      items: items.map((m) => ({
        id: m.id,
        batchId: (m as any).refId || null,
        direction: m.direction,
        sku: (m as any).product?.sku || null,
        name: (m as any).product?.name || null,
        qty: m.qty,
        date: m.createdAt,
      })),
    };
  }
}