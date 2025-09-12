import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { map } from 'rxjs/operators';

function isPrismaDecimal(v: any) {
  return v && typeof v === 'object' && typeof v.toNumber === 'function' && v.constructor?.name === 'Decimal';
}

function normalize(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (isPrismaDecimal(value)) return value.toNumber();

  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data) => normalize(data)));
  }
}
