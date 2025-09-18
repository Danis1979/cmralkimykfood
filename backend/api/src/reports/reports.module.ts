import { ReportsDebugController } from "./reports.debug.controller";
import { ReportsSalesMonthlyController } from './reports.sales.monthly.controller';
// backend/api/src/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// JSON controllers
import { ReportsOverviewController } from './reports.overview.controller';
import { ReportsReceivablesAgingController } from './reports.receivables.aging.controller';
import { ReportsInventoryValueController } from './reports.inventory.value.controller';
import { ReportsSalesVsPurchasesController } from './reports.sales.vs.purchases.controller';
import { ReportsMarginByProductController } from './reports.margin.by.product.controller';
import { ReportsTopClientsController } from './reports.top.clients.controller';
import { ReportsKpisController } from './reports.kpis.controller';

// CSV controllers
import { ReportsInventoryMovesCsvController } from './reports.inventory.moves.csv.controller';
import { ReportsReceivablesAgingCsvController } from './reports.csv.controller';
import { ReportsTopClientsCsvController } from './reports.top.clients.csv.controller';
import { ReportsMarginByProductCsvController } from './reports.margin.by.product.csv.controller';
import { ReportsSalesVsPurchasesCsvController } from './reports.sales.vs.purchases.csv.controller';
import { ReportsInventoryValueCsvController } from './reports.inventory.value.csv.controller';
import { ReportsOrdersCsvController } from './reports.orders.csv.controller';
import { ReportsProductionsCsvController } from './reports.productions.csv.controller';
import { ReportsReceivablesSearchCsvController } from './reports.receivables.search.csv.controller';
import { ReportsStockCsvController } from './reports.stock.csv.controller';

@Module({
  controllers: [// JSON
    ReportsOverviewController,
    ReportsReceivablesAgingController,
    ReportsKpisController,
    ReportsInventoryValueController,
    ReportsSalesVsPurchasesController,
    ReportsMarginByProductController,
    ReportsTopClientsController,

    // CSV
    ReportsInventoryMovesCsvController,
    ReportsReceivablesAgingCsvController,
    ReportsTopClientsCsvController,
    ReportsMarginByProductCsvController,
    ReportsSalesVsPurchasesCsvController,
    ReportsInventoryValueCsvController,
    ReportsOrdersCsvController,
    ReportsProductionsCsvController,
    ReportsReceivablesSearchCsvController,
    ReportsStockCsvController,  ReportsSalesMonthlyController],
  providers: [PrismaService],
})
export class ReportsModule {}
