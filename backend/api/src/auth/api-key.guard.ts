import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req: any = context.switchToHttp().getRequest();

    // Rutas públicas (no requieren key)
    const url: string = req.url || '';
    if (url.startsWith('/health') || url.startsWith('/ui') || url.startsWith('/docs')) {
      return true;
    }

    // Si no hay API_KEY configurada, no bloqueamos (modo dev)
    const expected = process.env.API_KEY;
    if (!expected) return true;

    // Tomamos de header, query o cookie
    const provided =
      req.headers['x-api-key'] ||
      req.query?.api_key ||
      req.cookies?.api_key;

    return String(provided) === String(expected);
  }
}
