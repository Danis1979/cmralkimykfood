#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-src}"
# 1) Detectar dónde se arma Swagger (DocumentBuilder / SwaggerModule.createDocument)
CANDIDATES=$(grep -RIl --include='*.ts' -E 'SwaggerModule\.createDocument|new\s+DocumentBuilder\s*\(' "$ROOT" 2>/dev/null || true)
if [[ -z "${CANDIDATES}" ]]; then
  echo "✖ No encontré bootstrap de Swagger en $ROOT (busqué DocumentBuilder / createDocument)."
  exit 1
fi

TARGET=""
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  # elegimos el primer candidato que contenga new DocumentBuilder()
  if grep -qE 'new\s+DocumentBuilder\s*\(' "$f"; then TARGET="$f"; break; fi
done <<< "$CANDIDATES"

# fallback: primer candidato
[[ -n "$TARGET" ]] || TARGET="$(echo "$CANDIDATES" | head -n1)"

echo "→ Parcheando: $TARGET"

# 2) Evitar duplicar
if grep -qE '\.addTag\(\s*[\'"]Reports[\'"]\s*\)' "$TARGET"; then
  echo "  ✓ Ya tenía .addTag('Reports')"
else
  # Inserto .addTag('Reports') antes de .build()
  perl -0777 -i.bak -pe '
    s/(new\s+DocumentBuilder\(\)(?:(?!\.build\(\)).)*)(\.build\(\))/\1.addTag("Reports")\n  \2/s
  ' "$TARGET"
  echo "  ＋ Añadido .addTag('Reports') en DocumentBuilder (backup: $TARGET.bak)"
fi

echo "✔ Listo. Si tenés watcher (start:dev) se recompila solo; si no, reiniciá."
