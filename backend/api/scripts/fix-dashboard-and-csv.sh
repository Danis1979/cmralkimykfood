#!/usr/bin/env bash
set -e

FILE="public/dashboard.html"
[[ -f "$FILE" ]] || { echo "✖ No existe $FILE (corré desde backend/api)"; exit 1; }

need_script() {
  local path="$1"
  local esc=$(printf '%s\n' "$path" | sed 's/[.[\*^$(){}|+?\\]/\\&/g')
  if ! grep -q "src=\"$esc\"" "$FILE"; then
    echo "＋ Inyectando $path en <head>..."
    awk -v RS= -v ORS= '{ sub(/<head>/, "<head>\n  <script src=\"'"$path"'\"></script>"); print }' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
  else
    echo "✓ Ya estaba $path"
  fi
}

echo "== Parchando dashboard =="
need_script "/js/prefs.api.js"
need_script "/vendor/chart.umd.js"
need_script "/js/kpis.widgets.js"
need_script "/js/activity.tables.js"
need_script "/js/csv.exports.js"

echo
echo "== Normalizando filename de inventory-moves.csv =="
# Cambia cualquier filename distinto a inventory-moves.csv
grep -RIl "inventory-moves" src/reports | while read -r f; do
  if grep -q 'Content-Disposition' "$f"; then
    if grep -q 'inventory-moves_all\.csv' "$f"; then
      echo "＊ Corrigiendo $f -> inventory-moves.csv"
      sed -i '' 's/inventory-moves_all\.csv/inventory-moves.csv/g' "$f"
    fi
  fi
done

echo
echo "== Validando DOM (IDs/scripts) =="
BASE="${BASE:-https://localhost:3000}" scripts/qa-front-dom.sh

echo
echo "== Validando endpoints CSV =="
BASE="${BASE:-https://localhost:3000}" KEY="${KEY:-supersecreta-123}" scripts/qa-csv-endpoints.sh

echo
echo "✓ Listo. Refrescá el dashboard en el navegador."
