import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryController } from './inventory.controller';
import { InventoryMaintenanceController } from './maintenance.controller';

@Module({
  controllers: [InventoryController, InventoryMaintenanceController],
  providers: [PrismaService],
})
export class InventoryModule {}
