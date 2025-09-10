#!/usr/bin/env bash
set -euo pipefail

FILE="src/reports/reports.inventory.moves.csv.controller.ts"

echo "→ Ubicando último backup (si existe)…"
LAST_BAK="$(ls -t ${FILE}.bak.* 2>/dev/null | head -n1 || true)"
if [[ -n "${LAST_BAK}" ]]; then
  echo "  Backup encontrado: ${LAST_BAK}"
  cp "${LAST_BAK}" "${FILE}"
  echo "  Restaurado ${FILE} desde backup."
else
  echo "  No hay backup previo; sigo con el archivo actual."
fi

echo "→ Normalizando Content-Disposition en ${FILE}"
# 1) Reemplazar cualquier Content-Disposition previo por el correcto
perl -0777 -i -pe \
  "s/res\.setHeader\(\s*(['\"\`])Content-Disposition\1\s*,\s*(['\"\`]).*?\2\s*\)\s*;/res.setHeader('Content-Disposition','attachment; filename=\"inventory-moves.csv\"');/g" \
  "${FILE}"

# 2) Si no existe ningún Content-Disposition, insertarlo después del Content-Type
if ! grep -q 'filename="inventory-moves\.csv"' "${FILE}"; then
  perl -0777 -i -pe \
    "s/(res\.setHeader\(\s*(['\"\`])Content-Type\2\s*,\s*(['\"\`])text\/csv; charset=utf-8\3\)\s*;)/\1\n    res.setHeader('Content-Disposition','attachment; filename=\"inventory-moves.csv\"');/s" \
    "${FILE}"
fi

# 3) Eliminar cualquier override dinámico que arme _all u otros sufijos
perl -0777 -i -pe "s/^(\s*)\/\/\s*res\.setHeader\(\s*(['\"\`])Content-Disposition\2.*\);\s*\n//mg" "${FILE}"

echo "→ Verificación estática en el archivo:"
grep -n 'Content-Disposition' "${FILE}" || true

# 4) (Opcional) tocar un archivo para forzar recompilación si estás con nodemon/ts-node
test -f "${FILE}" && touch "${FILE}"

# 5) Probar por HEAD y GET
BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"

echo; echo "== HEAD /reports/inventory-moves.csv =="
set +e
curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/inventory-moves.csv" | grep -Ei '^Content-(Type|Disposition)'
RC_HEAD=$?
set -e

echo; echo "== GET /reports/inventory-moves.csv (primeras 2 líneas) =="
curl -ksS  --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/inventory-moves.csv" | head -n2

echo; echo "→ Resultado HEAD (0=ok): $RC_HEAD"
echo '   Esperado: Content-Disposition: attachment; filename="inventory-moves.csv"'
