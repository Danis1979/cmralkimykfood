#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

echo "→ Buscando referencias 'inventory-moves_all.csv'…"
MAPFILES=()
while IFS= read -r -d '' f; do MAPFILES+=("$f"); done < <(grep -RIlZ --include='*.ts' 'inventory-moves_all\.csv' src || true)
if ((${#MAPFILES[@]})); then
  echo "  Archivos:"
  printf '  - %s\n' "${MAPFILES[@]}"
  for f in "${MAPFILES[@]}"; do
    cp -n "$f" "$f.bak.$(date +%Y%m%d%H%M%S)" || true
    sed -i '' 's/inventory-moves_all\.csv/inventory-moves.csv/g' "$f"
  done
else
  echo "  No encontré strings 'inventory-moves_all.csv' (ok)."
fi

# Forzar Content-Disposition correcto en el controller de inventory-moves.csv
CTRL=$(grep -RIl --include='*.ts' 'inventory-moves\.csv' src/reports | grep -i 'inventory.moves' | head -n1 || true)
if [[ -n "${CTRL:-}" ]]; then
  echo "→ Normalizando Content-Disposition en: $CTRL"
  cp -n "$CTRL" "$CTRL.bak.$(date +%Y%m%d%H%M%S)" || true

  # 1) Unificar cualquier Content-Disposition → inventory-moves.csv
  perl -0777 -i -pe 's/(res\.setHeader\(\s*["\x27`]Content-Disposition["\x27`]\s*,\s*["\x27`]attachment;\s*filename=)["\x27`][^"\x27`]*?\.csv(["\x27`]\s*\))/\1"inventory-moves.csv"\2/g' "$CTRL"

  # 2) Asegurar uno explícito después del Content-Type (override final)
  if ! perl -0777 -ne 'print "ok" if /setHeader\(\s*["\x27`]Content-Disposition["\x27`]\s*,\s*["\x27`]attachment; filename="inventory-moves\.csv"["\x27`]\s*\)/' "$CTRL" >/dev/null; then
    perl -0777 -i -pe 's/(res\.setHeader\(\s*["\x27`]Content-Type["\x27`][^;]*;\s*\))/$1\n    res.setHeader('\''Content-Disposition'\'','\''attachment; filename="inventory-moves.csv"'\'');/s' "$CTRL"
  fi
else
  echo "✖ No pude localizar controller de inventory-moves.csv (src/reports)."
fi

echo "→ Esperando que el watcher recompilé (si usás start:dev)…"
sleep 1

BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"
echo; echo "HEAD verificación:"
curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/inventory-moves.csv" | grep -Ei '^Content-(Type|Disposition)' || true
echo 'Esperado: Content-Disposition: attachment; filename="inventory-moves.csv"'
