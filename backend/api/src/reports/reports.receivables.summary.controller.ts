import { Controller, Get, Query } from '@nestjs/common';

function mm(s?: string) {
  return s && /^\d{4}-\d{2}$/.test(s) ? s : null;
}

@Controller('reports')
export class ReportsReceivablesSummaryController {
  @Get('receivables.summary')
  async summary(@Query('from') from?: string, @Query('to') to?: string) {
    // Stub: estructura lista; luego sumamos de la tabla real
    return {
      range: { from: mm(from), to: mm(to) },
      paid: 0,
      pending: 0,
      overdue: 0,
      _hint: 'stub',
    };
  }
}
