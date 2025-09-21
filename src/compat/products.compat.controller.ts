import { Controller, Get, Query } from '@nestjs/common';

function pickInt(v: any, def: number) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

@Controller('products')
export class ProductsCompatController {
  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') _sort?: string,
    @Query('q') _q?: string,
  ) {
    const p = pickInt(page, 1);
    const l = pickInt(limit, 20);
    return { page: p, total: 0, pages: 1, items: [] as any[] };
  }

  @Get('search')
  search(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') _sort?: string,
    @Query('q') _q?: string,
  ) {
    const p = pickInt(page, 1);
    const l = pickInt(limit, 20);
    return { page: p, total: 0, pages: 1, items: [] as any[] };
  }
}
