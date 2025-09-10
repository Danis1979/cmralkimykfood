import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SalesController],
  providers: [PrismaService],
})
export class SalesModule {}