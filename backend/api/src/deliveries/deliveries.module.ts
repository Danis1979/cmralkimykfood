import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DeliveriesController],
  providers: [PrismaService],
})
export class DeliveriesModule {}