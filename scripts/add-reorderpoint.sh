#!/usr/bin/env bash
set -euo pipefail

SCHEMA="${1:-backend/api/prisma/schema.prisma}"
# fallback común
if [[ ! -f "$SCHEMA" ]]; then SCHEMA="prisma/schema.prisma"; fi
[[ -f "$SCHEMA" ]] || { echo "❌ No encontré Prisma schema"; exit 1; }

echo "🗂  Schema: $SCHEMA"
cp "$SCHEMA" "$SCHEMA.bak.$(date +%Y%m%d%H%M%S)"

# Inserta el campo si no existe dentro de model Product { ... }
awk '
BEGIN{inprod=0; hasfield=0}
{
  if ($0 ~ /^\s*model\s+Product\b/) { inprod=1; hasfield=0 }
  if (inprod && $0 ~ /\breorderPoint\b/) { hasfield=1 }
  if (inprod && $0 ~ /^\s*}\s*$/) {
    if (!hasfield) {
      print "  reorderPoint Int? @default(0)"
      hasfield=1
      print $0
      inprod=0
      next
    } else {
      inprod=0
    }
  }
  print
}' "$SCHEMA" > "$SCHEMA.tmp" && mv "$SCHEMA.tmp" "$SCHEMA"

# Formatear/generar y aplicar al DB
npx prisma format --schema "$SCHEMA"
npx prisma generate --schema "$SCHEMA"
npx prisma db push --schema "$SCHEMA"

echo "✅ Prisma actualizado. Si tu watcher no ve los tipos nuevos, reiniciá el servidor."
