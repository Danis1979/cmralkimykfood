import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OpsController],
  providers: [PrismaService],
})
export class OpsModule {}
