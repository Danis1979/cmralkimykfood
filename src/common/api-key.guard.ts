import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expected = process.env.API_KEY || 'supersecreta-123';

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, any>; method: string; url: string; path?: string }>();

    // Permitir recursos públicos/estáticos y preflight
    const path = (req.path || req.url || '').split('?')[0];
    if (
      req.method === 'OPTIONS' ||
      path === '/' ||
      path === '/health' ||
      path === '/version' ||
      path === '/docs' ||
      path === '/docs-json' ||
      path === '/dashboard.html' ||
      path === '/index.html' ||
      path.startsWith('/js/') ||
      path.startsWith('/css/') ||
      path.startsWith('/assets/') ||
      path.startsWith('/images/') ||
      path === '/favicon.ico'
    ) {
      return true;
    }

    const header = req.headers['x-api-key'];
    const key = (Array.isArray(header) ? header[0] : header) ?? '';
    if (!this.expected) return true;            // si no hay API_KEY definida, no bloquea (DEV)
    if (String(key) === this.expected) return true;

    throw new UnauthorizedException('Invalid API key');
  }
}
