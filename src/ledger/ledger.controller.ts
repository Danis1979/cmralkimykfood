import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('ledger')
export class LedgerController {
  constructor(private prisma: PrismaService) {}

  @Get('balances')
  async balances() {
    const entries = await (this.prisma as any).ledgerEntry.findMany();
    const sign = (t: 'DEBE' | 'HABER') => (t === 'HABER' ? 1 : -1);

    const totals: Record<string, number> = {};
    for (const e of entries) {
      const amt = Number(e.amount.toString());
      totals[e.account] = (totals[e.account] || 0) + sign(e.type) * amt;
    }

    return { totals };
  }
}