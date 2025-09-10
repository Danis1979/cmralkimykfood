import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsMutationsController } from './products.mutations.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProductsController, ProductsMutationsController],
  providers: [PrismaService],
})
export class ProductsModule {}
