import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrdersController } from './orders.controller';
import { OrdersDetailController } from './orders.detail.controller';
import { OrdersQueryController } from './orders.query.controller';

@Module({
  controllers: [OrdersQueryController, OrdersController, OrdersDetailController],
  providers: [PrismaService],
})
export class OrdersModule {}
