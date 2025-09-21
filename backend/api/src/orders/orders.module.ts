import { OrdersDetailController } from "./orders.detail.controller";
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ OrdersQueryController, ],
  providers: [PrismaService],
})
export class OrdersModule {}