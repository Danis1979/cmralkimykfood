import { Body, Controller, Headers, Param, Patch, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateCostDto {
  @IsNumber()
  @Type(() => Number)
  costStd!: number;
}

function checkKey(k?: string) {
  const expected = process.env.API_KEY || 'supersecreta-123';
  if (expected && k !== expected) throw new UnauthorizedException();
}

@Controller('products')
export class ProductsMutationsController {
  constructor(private prisma: PrismaService) {}

  @Patch(':sku/cost')
  async updateCost(
    @Param('sku') sku: string,
    @Body() body: UpdateCostDto,
    @Headers('x-api-key') key?: string,
  ) {
    checkKey(key);
    const p = await this.prisma.product.update({
      where: { sku },
      data: { costStd: new Prisma.Decimal(body.costStd) },
      select: { sku: true, name: true, costStd: true, updatedAt: true },
    });
    return { ok: true, product: p };
  }
}
