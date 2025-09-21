import { Module } from '@nestjs/common';
import { ClientsCompatController } from './clients.compat.controller';
import { SuppliersCompatController } from './suppliers.compat.controller';
import { ProductsCompatController } from './products.compat.controller';
import { DbService } from '../db.service';

@Module({
  controllers: [
    ClientsCompatController,
    SuppliersCompatController,
    ProductsCompatController,
  ],
  providers: [DbService],
})
export class CompatModule {}
