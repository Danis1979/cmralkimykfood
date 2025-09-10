// backend/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { VersionController } from './version.controller';
import { AppController } from './app.controller';

import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { SalesModule } from './sales/sales.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { LedgerModule } from './ledger/ledger.module';
import { ChequesModule } from './cheques/cheques.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReportsModule } from './reports/reports.module';
import { OpsModule } from './ops/ops.module';

@Module({
  imports: [
    // Cache global (ttl en segundos)
    CacheModule.register({ isGlobal: true, ttl: 30 }),

    // Config global
    ConfigModule.forRoot({ isGlobal: true }),

    // Servir el dashboard estático
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveStaticOptions: { index: ['index.html', 'dashboard.html'] },
    }),

    // Feature modules
    ProductsModule,
    InventoryModule,
    OrdersModule,
    DeliveriesModule,
    SalesModule,
    ReceivablesModule,
    LedgerModule,
    ChequesModule,
    PurchasesModule,
    ReportsModule,
    OpsModule,
  ],
  controllers: [VersionController, AppController],
  providers: [],
})
export class AppModule {}