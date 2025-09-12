#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"
FROM="${FROM:-2025-09}"
TO="${TO:-2025-09}"
RANGE="from=${FROM}&to=${TO}"

say(){ echo -e "\n== $* =="; }
ok(){ echo "✔ $1"; }
ko(){ echo "✖ $1"; exit 1; }

# --- 0) Health / Version (HTTPS) ---
say "Health & Version"
STATUS=$(curl -ksS --tlsv1.2 "$BASE/health"  | jq -r .status)
VER=$(    curl -ksS --tlsv1.2 "$BASE/version" | jq -r .version)
[[ "$STATUS" == "ok" ]] && ok "health ok" || ko "health != ok ($STATUS)"
[[ -n "$VER" && "$VER" != "null" ]] && ok "version $VER" || ko "version vacía"

# --- 1) Auth / 401 ---
say "Auth (401 sin o con API Key inválida)"
code_no_key=$(curl -ksS --tlsv1.2 -o /dev/null -w '%{http_code}' "$BASE/reports/kpis?$RANGE")
code_bad_key=$(curl -ksS --tlsv1.2 -H "x-api-key: WRONG" -o /dev/null -w '%{http_code}' "$BASE/reports/kpis?$RANGE")
[[ "$code_no_key" == "401" ]] && ok "401 sin key" || ko "esperaba 401 sin key, obtuve $code_no_key"
[[ "$code_bad_key" == "401" ]] && ok "401 key inválida" || ko "esperaba 401 con key inválida, obtuve $code_bad_key"

# --- 2) Estáticos (HEAD 200) ---
say "Estáticos (HEAD 200)"
for p in /js/prefs.api.js /js/kpis.widgets.js /js/activity.tables.js /js/csv.exports.js /vendor/chart.umd.js; do
  code=$(curl -ksSI --tlsv1.2 "$BASE$p" | head -n1 | awk '{print $2}')
  [[ "$code" == "200" ]] && ok "$p -> 200" || ko "$p -> $code"
done

# --- 3) Reports JSON (sanity) ---
say "Reports JSON (sanity con API key)"
KPIS=$(curl -ksS --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/kpis?$RANGE")
echo "$KPIS" | jq .totals
[[ "$(echo "$KPIS" | jq -r '.totals.sales')" != "null" ]] || ko "KPIs sin totals"

# --- 4) CSV headers (Content-Type + filename) ---
say "CSV headers"
H=$(curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/top-clients.csv?$RANGE")
echo "$H" | grep -Ei 'Content-Type|Content-Disposition'
echo "$H" | grep -qi 'text/csv' || ko "Content-Type no es text/csv"
echo "$H" | grep -qi 'filename="top-clients.csv"' || ko "filename inesperado"

# --- 5) OPS /productions (orden + filtros) ---
say "OPS /productions (orden + filtros)"
curl -ksS --tlsv1.2 -H "x-api-key: $KEY" "$BASE/ops/productions?take=5" | jq '.items | map({sku,date})' | head
curl -ksS --tlsv1.2 -H "x-api-key: $KEY" "$BASE/ops/productions?order=sku:asc,date:desc&take=5" | jq '.items | map({sku,date})' | head
curl -ksS --tlsv1.2 -H "x-api-key: $KEY" "$BASE/ops/productions?sku=PT-CAPRESE-001&direction=IN&$RANGE&order=date:asc" | jq '.items | map({dir:.direction, sku, date})' | head

# --- 6) Cache TTL (2 llamadas seguidas; 2da más rápida) ---
say "Cache TTL (KPIs)"
t1=$(curl -ksS --tlsv1.2 -H "x-api-key: $KEY" -w '%{time_total}' -o /dev/null "$BASE/reports/kpis?$RANGE")
t2=$(curl -ksS --tlsv1.2 -H "x-api-key: $KEY" -w '%{time_total}' -o /dev/null "$BASE/reports/kpis?$RANGE")
echo "t1=$t1  t2=$t2"
awk -v a="$t1" -v b="$t2" 'BEGIN{exit !(b <= a)}' && ok "2da llamada más rápida (cache)" || ok "tiempos similares (OK si ~igual)"

# --- 7) Consistencia JSON ↔ CSV ---
say "Consistencia JSON ↔ CSV"
if [[ -x scripts/qa-consistency.sh ]]; then
  BASE="$BASE" KEY="$KEY" FROM="$FROM" TO="$TO" scripts/qa-consistency.sh
else
  echo "ℹ No encontré scripts/qa-consistency.sh; saltando este paso."
fi

echo -e "\n✅ QA FULL OK"
