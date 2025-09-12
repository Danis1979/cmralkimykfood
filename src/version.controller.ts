import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller()
export class VersionController {
  @Get('version')
  getVersion() {
    let name = 'api';
    let version = '0.0.0';
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
      name = pkg.name ?? name;
      version = pkg.version ?? version;
    } catch {}
    return { name, version, env: process.env.NODE_ENV ?? 'development' };
  }
}
