#!/usr/bin/env bash
set -euo pipefail

# 1) Localizar el controller de inventory-moves.csv
CTRL=$(grep -RIl --include='*.ts' -E '@Get\(\s*["'\''`]inventory-moves\.csv' src/reports | head -n1 || true)
if [[ -z "${CTRL:-}" ]]; then
  CTRL=$(grep -RIl --include='*.ts' 'inventory-moves' src/reports | head -n1 || true)
fi
[[ -n "${CTRL:-}" ]] || { echo "✖ No encontré el controller de inventory-moves.csv en src/reports"; exit 1; }
echo "→ Controller: $CTRL"

# 2) Backup
cp -n "$CTRL" "$CTRL.bak.$(date +%Y%m%d%H%M%S)" || true

# 3) Comentar cualquier setHeader(Content-Disposition, ...) previo (dinámico)
perl -0777 -i -pe "s/(res\.setHeader\(\s*['\"\`]Content-Disposition['\"\`]\s*,\s*['\"\`]attachment;[^)]+?\)\s*;)/\/\/ \1/g" "$CTRL"

# 4) Inyectar override justo ANTES de enviar el CSV
#    (si no existe ya uno correcto inmediatamente antes del send)
if ! perl -0777 -ne 'print "ok" if /setHeader\(\s*["\x27`]Content-Disposition["\x27`]\s*,\s*["\x27`]attachment; filename="inventory-moves\.csv"["\x27`]\s*\).*res\.send\(\s*csv\s*\)\s*;/s' "$CTRL" >/dev/null; then
  perl -0777 -i -pe 's/(res\.send\(\s*csv\s*\)\s*;)/res.setHeader('\''Content-Disposition'\'','\''attachment; filename="inventory-moves.csv"'\'');\n    $1/s' "$CTRL"
fi

echo "✔ Override inyectado."

# 5) Verificación rápida por HEAD
BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"
echo; echo "HEAD verificación:"
curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/inventory-moves.csv" | grep -Ei '^Content-(Type|Disposition)' || true
echo 'Esperado: Content-Disposition: attachment; filename="inventory-moves.csv"'
