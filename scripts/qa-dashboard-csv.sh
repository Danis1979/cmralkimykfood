#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"

say(){ echo -e "\n== $* =="; }

say "HTTPS /health y /version"
curl -ksS --tlsv1.2 "$BASE/health"  | jq -r .status
curl -ksS --tlsv1.2 "$BASE/version" | jq -r .version

say "Dashboard HTML cargado (título y scripts esperados)"
TMP="$(mktemp)"; curl -ksS --tlsv1.2 "$BASE/dashboard.html" > "$TMP"
grep -Eoi '<title>[^<]+' "$TMP" | head -n1 || true
grep -Eo 'src="/js/(prefs\.api|kpis\.widgets|activity\.tables|csv\.exports)\.js"' "$TMP" | sort -u

say "HEAD de JS estáticos (deben dar 200)"
for p in /js/prefs.api.js /js/kpis.widgets.js /js/activity.tables.js /js/csv.exports.js /vendor/chart.umd.js; do
  printf "%-26s " "$p"; curl -ksSI --tlsv1.2 "$BASE$p" | head -n1
done

say "Reportes JSON con API key (sanity)"
curl -ksS --tlsv1.2 "$BASE/reports/kpis?from=2025-09&to=2025-09"              -H "x-api-key: $KEY" | jq .totals
curl -ksS --tlsv1.2 "$BASE/reports/sales-vs-purchases?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | jq .totals

say "CSV headers (Content-Type y filename)"
curl -ksSI --tlsv1.2 "$BASE/reports/top-clients.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | grep -Ei 'content-type|content-disposition'

say "CSV primeros renglones"
curl -ksS  --tlsv1.2 "$BASE/reports/top-clients.csv?from=2025-09&to=2025-09"       -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/margin-by-product.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/sales-vs-purchases.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/productions.csv?from=2025-09&to=2025-09"       -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/inventory-moves.csv?from=2025-09&to=2025-09"   -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/inventory-value.csv?from=2025-09&to=2025-09"   -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/orders.csv?from=2025-09&to=2025-09"            -H "x-api-key: $KEY" | head -n1

say "OPS /productions (orden y filtros)"
curl -ksS --tlsv1.2 "$BASE/ops/productions?take=5"                         -H "x-api-key: $KEY" | jq '.items | map({sku,date})' | head
curl -ksS --tlsv1.2 "$BASE/ops/productions?order=sku:asc,date:desc&take=5" -H "x-api-key: $KEY" | jq '.items | map({sku,date})' | head
curl -ksS --tlsv1.2 "$BASE/ops/productions?sku=PT-CAPRESE-001&direction=IN&from=2025-09&to=2025-09&order=date:asc" \
  -H "x-api-key: $KEY" | jq '.items | map({dir:.direction, sku, date})' | head

say "Cache TTL (dos llamadas a KPIs; la 2da debería ser más rápida)"
time curl -ksS --tlsv1.2 "$BASE/reports/kpis?from=2025-09&to=2025-09" -H "x-api-key: $KEY" >/dev/null
time curl -ksS --tlsv1.2 "$BASE/reports/kpis?from=2025-09&to=2025-09" -H "x-api-key: $KEY" >/dev/null

rm -f "$TMP"
echo -e "\n✅ QA dashboard/csv OK si todo lo anterior dio 200/valores correctos."
