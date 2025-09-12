import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PurchasesController],
  providers: [PrismaService],
})
export class PurchasesModule {}