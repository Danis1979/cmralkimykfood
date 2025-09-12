import { Module, Controller, Get } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as fs from 'fs';
import * as path from 'path';

import { ChequesModule } from './cheques/cheques.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { InventoryModule } from './inventory/inventory.module';
import { LedgerModule } from './ledger/ledger.module';
import { OpsModule } from './ops/ops.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';

@Controller()
class AppController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('version')
  version() {
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      return { version: pkg.version ?? 'unknown' };
    } catch {
      return { version: 'unknown' };
    }
  }
}

@Module({
  imports: [
    // Sirve los archivos de ./public en la raíz del sitio (/, /dashboard.html, etc.)
    // Usamos process.cwd() para que funcione igual en local y en Render sin copiar a dist/.
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), 'public'),
      serveRoot: '/', // opcional: por defecto ya es '/'
    }),

    // Cache global (lo pide el CacheInterceptor en Reports)
    CacheModule.register({ isGlobal: true }),

    // Módulos de la app
    ChequesModule,
    DeliveriesModule,
    InventoryModule,
    LedgerModule,
    OpsModule,
    OrdersModule,
    ProductsModule,
    PurchasesModule,
    ReceivablesModule,
    ReportsModule,
    SalesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}