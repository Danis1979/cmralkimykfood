#!/usr/bin/env bash
set -euo pipefail

BASE=${BASE:-https://localhost:3000}
KEY=${KEY:-supersecreta-123}

say(){ echo -e "\n== $* =="; }

say "Health & Version"
curl -ksS "$BASE/health"  | jq -r .status
curl -ksS "$BASE/version" | jq -r .version

say "Reports protegidos (401 sin API Key)"
curl -ksSi "$BASE/reports/kpis?from=2025-09&to=2025-09" | head -n1

say "Reports con API Key"
curl -ksS "$BASE/reports/kpis?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | jq .totals
curl -ksS "$BASE/reports/sales-vs-purchases?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | jq '{items,totals}'
curl -ksS "$BASE/reports/margin-by-product?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | jq '{items,totals}'
curl -ksS "$BASE/reports/top-clients?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | jq '{items,totals}'

say "CSV headers (Content-Type + filename)"
curl -ksSI "$BASE/reports/top-clients.csv?from=2025-09&to=2025-09" -H "x-api-key: $KEY" | grep -Ei 'content-type|content-disposition'

say "Ops /productions (orden y filtros)"
curl -ksS "$BASE/ops/productions?take=5" -H "x-api-key: $KEY" | jq '.items | map({sku,date})'
curl -ksS "$BASE/ops/productions?order=sku:asc,date:desc&take=5" -H "x-api-key: $KEY" | jq '.items | map({sku,date})'

say "Cache TTL (dos llamadas seguidas)"
time curl -ksS "$BASE/reports/kpis?from=2025-09&to=2025-09" -H "x-api-key: $KEY" >/dev/null
time curl -ksS "$BASE/reports/kpis?from=2025-09&to=2025-09" -H "x-api-key: $KEY" >/dev/null

echo -e "\n✅ Smoke + cache OK"
