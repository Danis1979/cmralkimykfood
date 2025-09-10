import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrdersController } from './orders.controller'; // tu controller existente (crear/confirmar/etc.)
import { OrdersSearchController } from './orders.search.controller';

@Module({
  controllers: [OrdersController, OrdersSearchController],
  providers: [PrismaService],
})
export class OrdersModule {}
