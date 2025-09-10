#!/usr/bin/env bash
set -euo pipefail

GLOB="src/reports/*.ts"

fix_file() {
  local f="$1"
  cp "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"

  # 1) Reemplazar líneas sueltas "(CacheInterceptor)" y "(30)" por decoradores válidos
  #    Sólo si aparecen como línea completa (con o sin espacios).
  sed -i '' -E \
    -e 's/^[[:space:]]*\(CacheInterceptor\)[[:space:]]*$/@UseInterceptors(CacheInterceptor)/' \
    -e 's/^[[:space:]]*\(30\)[[:space:]]*$/@CacheTTL(30)/' \
    "$f"

  # 2) Asegurar imports de decoradores
  if ! grep -q 'UseInterceptors' "$f"; then
    sed -i '' '1i\
import { UseInterceptors } from "@nestjs/common";
' "$f"
  fi

  if grep -q '@nestjs/cache-manager' "$f"; then
    # Normalizar el import de cache-manager para que tenga ambos símbolos
    perl -0777 -i -pe 's/import\s*{\s*[^}]*}\s*from\s*"@nestjs\/cache-manager";/import { CacheInterceptor, CacheTTL } from "@nestjs\/cache-manager";/s' "$f"
  else
    sed -i '' '1i\
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
' "$f"
  fi
}

any=0
for f in $GLOB; do
  [[ -f "$f" ]] || continue
  any=1
  echo "Arreglando: $f"
  fix_file "$f"
done

if [[ "$any" -eq 0 ]]; then
  echo "No se encontraron archivos en $GLOB"
else
  echo "Validando que no queden líneas malas…"
  if grep -RIn '^(CacheInterceptor)$' src/reports 2>/dev/null; then
    echo "⚠️ Quedaron líneas con (CacheInterceptor). Revisá el archivo listado."
  fi
  if grep -RIn '^(30)$' src/reports 2>/dev/null; then
    echo "⚠️ Quedaron líneas con (30). Revisá el archivo listado."
  fi
fi

echo "Compilando…"
npm run start:dev
