#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"

say(){ echo -e "\n== $* =="; }

say "Health/Version (HTTPS)"
curl -ksS --tlsv1.2 "$BASE/health"  | jq -r .status
curl -ksS --tlsv1.2 "$BASE/version" | jq -r .version

say "JS estáticos (HEAD 200)"
for p in /js/prefs.api.js /js/kpis.widgets.js /js/activity.tables.js /vendor/chart.umd.js; do
  printf "%-28s " "$p"; curl -ksSI --tlsv1.2 "$BASE$p" | head -n1
done

say "CSV headers (se esperan Content-Type y filename)"
curl -ksSI --tlsv1.2 "$BASE/reports/top-clients.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | \
  grep -Ei 'content-type|content-disposition'

say "Endpoints CSV (muestra 1ra línea)"
curl -ksS  --tlsv1.2 "$BASE/reports/top-clients.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/margin-by-product.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | head -n1
curl -ksS  --tlsv1.2 "$BASE/reports/sales-vs-purchases.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | head -n1

say "OPS /productions (orden y filtros)"
curl -ksS --tlsv1.2 "$BASE/ops/productions?take=5" -H "x-api-key: $KEY" | jq '.items | map({sku,date})' | head
curl -ksS --tlsv1.2 "$BASE/ops/productions?order=sku:asc,date:desc&take=5" -H "x-api-key: $KEY" | jq '.items | map({sku,date})' | head

say "Cache TTL (dos llamadas seguidas a KPIs)"
time curl -ksS --tlsv1.2 "$BASE/reports/kpis?from=2025-09&to=2025-09" -H "x-api-key: $KEY" >/dev/null
time curl -ksS --tlsv1.2 "$BASE/reports/kpis?from=2025-09&to=2025-09" -H "x-api-key: $KEY" >/dev/null

echo -e "\n✅ Dashboard OK (si todo arriba dio 200/valores correctos)."
