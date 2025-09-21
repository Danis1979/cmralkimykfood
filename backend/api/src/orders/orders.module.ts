import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrdersController } from './orders.controller';
import { OrdersQueryController } from './orders.query.controller';

@Module({
  controllers: [OrdersController, OrdersQueryController],
  providers: [PrismaService],
  exports: [],
})
export class OrdersModule {}
