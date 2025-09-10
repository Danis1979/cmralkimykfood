#!/usr/bin/env bash
set -euo pipefail

ROOT="src/reports"
GLOB="$ROOT"/*.controller.ts

yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
green(){ printf "\033[32m%s\033[0m\n" "$*"; }

[[ -d "$ROOT" ]] || { yellow "No existe $ROOT"; exit 0; }

for f in $GLOB; do
  [[ -f "$f" ]] || continue
  echo "— $f"

  # 1) @nestjs/common → agregar UseInterceptors si falta
  if ! grep -q 'UseInterceptors' "$f"; then
    perl -0777 -i -pe "s#import \{([^}]*)\} from '@nestjs/common';#import { \1, UseInterceptors } from '@nestjs/common';#;" "$f"
  fi

  # 2) @nestjs/cache-manager → asegurar CacheInterceptor y CacheTTL
  if ! grep -q '@nestjs/cache-manager' "$f"; then
    sed -i '' '1i\
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
' "$f"
  else
    perl -0777 -i -pe "s#import \{([^}]*)\} from '@nestjs/cache-manager';#my \$x=\$1; \$x=~s/\\bCacheInterceptor\\b//g; \$x=~s/\\bCacheTTL\\b//g; 'import { ' . \$x . (length(\$x)>0 ? ', ' : '') . 'CacheInterceptor, CacheTTL } from '\\''@nestjs/cache-manager'\\'';';#e" "$f"
  fi

  # 3) Decorador de clase después de @Controller('reports')
  if ! grep -Eq '@UseInterceptors\(\s*CacheInterceptor\s*\)' "$f"; then
    perl -0777 -i -pe "s#(@Controller\(['\"]reports['\"]\)\s*)#\$1\n@UseInterceptors(CacheInterceptor)\n#;" "$f"
  fi

  # 4) TTL a cada @Get (60s)
  perl -0777 -i -pe "s#\n(\s*)@Get\(#\n\1@CacheTTL(60)\n\1@Get(#g" "$f"
done

green '✔ Cache agregado a controllers de Reports (decorador + TTL 60s).'
