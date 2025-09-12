#!/usr/bin/env bash
set -euo pipefail

FILE="src/reports/reports.inventory.moves.csv.controller.ts"

# Localizar archivo si cambió el nombre
if [[ ! -f "$FILE" ]]; then
  CAND=$(grep -RIl --include='*.ts' "inventory-moves\.csv" src/reports || true)
  if [[ -z "${CAND:-}" ]]; then
    echo "✖ No encontré controller de inventory-moves.csv en src/reports"
    exit 1
  fi
  FILE=$(echo "$CAND" | grep -v '\.bak\.' | head -n1)
fi

cp -n "$FILE" "$FILE.bak.$(date +%Y%m%d%H%M%S)" || true
echo "→ Normalizando filename en: $FILE"

# 1) Reemplazos evidentes
sed -i '' 's/inventory-moves_all\.csv/inventory-moves.csv/g' "$FILE" || true

# 2) Cualquier filename="inventory-moves*.csv" → inventory-moves.csv
perl -0777 -i -pe 's/filename=(["\x27`])inventory-moves[^"\x27`]*?(\.csv)\1/filename=$1inventory-moves.csv$1/g;' "$FILE"

# 3) Si no hay Content-Disposition correcto, insertarlo tras Content-Type
if ! grep -q 'filename="inventory-moves.csv"' "$FILE"; then
  perl -0777 -i -pe \
    's/(res\.setHeader\(\s*["\x27`]Content-Type["\x27`][^;]*;\s*\))/$1\n    res.setHeader('\''Content-Disposition'\'','\''attachment; filename="inventory-moves.csv"'\'');/s' \
    "$FILE"
fi

echo "✔ Parches aplicados."

# Verificación rápida (HEAD)
BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"
echo
echo "HEAD verificación de /reports/inventory-moves.csv:"
curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/inventory-moves.csv" | grep -i '^Content-Disposition' || true
echo 'Esperado: Content-Disposition: attachment; filename="inventory-moves.csv"'
