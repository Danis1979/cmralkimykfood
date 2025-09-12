import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ChequesController } from './cheques.controller'; // tu controller existente (deposit/accredit/emitted/...)
import { ChequesSearchController } from './cheques.search.controller';

@Module({
  controllers: [ChequesController, ChequesSearchController],
  providers: [PrismaService],
})
export class ChequesModule {}
