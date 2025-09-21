import { Module } from '@nestjs/common';
import { ProductsCompatController } from './products-compat.controller';
import { PrismaService } from '../prisma.service';
@Module({ controllers: [ProductsCompatController], providers: [PrismaService] })
export class ProductsCompatModule {}
