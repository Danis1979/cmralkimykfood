import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const cs = process.env.DATABASE_URL;
    // SSL true por defecto en Render; poner PGSSL=disable para desactivar si es local sin SSL
    const ssl =
      process.env.PGSSL === 'disable'
        ? false
        : { rejectUnauthorized: false } as any;

    this.pool = cs ? new Pool({ connectionString: cs, ssl }) : new Pool();
  }

  async onModuleInit() {
    // opcional: test de conexión
    await this.pool.query('select 1');
  }

  async onModuleDestroy() {
    try { await this.pool.end(); } catch {}
  }

  async $queryRawUnsafe<T = any[]>(sql: string, ...params: any[]): Promise<T> {
    const res = await this.pool.query(sql, params);
    return res.rows as unknown as T;
  }

  async $executeRawUnsafe(sql: string, ...params: any[]): Promise<number> {
    const res = await this.pool.query(sql, params);
    return res.rowCount ?? 0;
  }
}
