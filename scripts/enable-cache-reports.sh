#!/usr/bin/env bash
set -euo pipefail

root="."
app="$root/src/app.module.ts"

echo "📦 Instalando dependencias de caché…"
npm i -S @nestjs/cache-manager cache-manager >/dev/null

echo "🛠  Habilitando CacheModule en AppModule…"
# 1) imports
grep -q "@nestjs/cache-manager" "$app" || \
  sed -i '' '1i\
import { CacheModule } from "@nestjs/cache-manager";
' "$app"

# 2) agregar CacheModule.register(...) al array de imports:
#    si ya existe CacheModule no lo duplica
if ! grep -q "CacheModule.register" "$app"; then
  perl -0777 -i'' -pe '
    s/imports\s*:\s*\[/imports: [CacheModule.register({ ttl: 30 * 1000 }), /s
  ' "$app"
fi

echo "🧩 Decorando controllers de reports con CacheInterceptor…"
add_sw_deps() {
  local f="$1"
  # UseInterceptors (de @nestjs/common) y CacheTTL/CacheInterceptor (de @nestjs/cache-manager)
  grep -q "UseInterceptors" "$f" || \
    sed -i '' '1i\
import { UseInterceptors } from "@nestjs/common";
' "$f"
  grep -q "@nestjs/cache-manager" "$f" || \
    sed -i '' '1i\
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
' "$f"
}

decorate_class() {
  local f="$1"
  # Insertar @UseInterceptors(CacheInterceptor) antes de export class … si no existe
  grep -q "@UseInterceptors(CacheInterceptor)" "$f" || \
    perl -0777 -i'' -pe 's/(export\s+class\s+[A-Za-z0-9_]+\s+{)/@UseInterceptors(CacheInterceptor)\n\1/s' "$f"
  # Agregar @CacheTTL(30) a cada @Get si no existe alguno en el archivo; como atajo, lo agregamos clase-level si falta
  grep -q "@CacheTTL(" "$f" || \
    perl -0777 -i'' -pe 's/(@UseInterceptors\(CacheInterceptor\)\s*\n)(export\s+class)/\1@CacheTTL(30)\n\2/s' "$f"
}

shopt -s nullglob
for f in $root/src/reports/*.controller.ts; do
  echo "   → $f"
  add_sw_deps "$f"
  decorate_class "$f"
done

echo "🔧 Opcional: habilitar ETag fuerte (mejora cache HTTP intermedio)…"
main_ts="$root/src/main.ts"
grep -q "app.set('etag'," "$main_ts" || \
  sed -i '' "s/const app = await NestFactory.create([^)]*);/const app = await NestFactory.create(\1);\n  app.set('etag','strong');/" "$main_ts"

echo "✅ Listo. Reiniciá el dev server y probá."
