import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReceivablesController } from './receivables.controller'; // tu controller actual (cobros)
import { ReceivablesSearchController } from './receivables.search.controller';

@Module({
  controllers: [ReceivablesController, ReceivablesSearchController],
  providers: [PrismaService],
})
export class ReceivablesModule {}
