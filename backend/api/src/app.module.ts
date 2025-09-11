import { Module, Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
class AppController {
  @Get('health')
  health() { return { status: 'ok' }; }

  @Get('version')
  version() {
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      return { version: pkg.version ?? 'unknown' };
    } catch {
      return { version: 'unknown' };
    }
  }
}

@Module({
  controllers: [AppController],
})
export class AppModule {}
