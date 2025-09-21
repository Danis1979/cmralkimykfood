import { Module } from '@nestjs/common';
import { ClientsCompatController } from './clients.compat.controller';
import { SuppliersCompatController } from './suppliers.compat.controller';
import { ProductsCompatController } from './products.compat.controller';

@Module({
  controllers: [
    ClientsCompatController,
    SuppliersCompatController,
    ProductsCompatController,
  ],
})
export class CompatModule {}
