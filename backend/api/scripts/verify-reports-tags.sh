#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"

say(){ echo; echo "== $* =="; }

say "Swagger /docs-json reachability"
curl -ksS --tlsv1.2 "$BASE/docs-json" >/dev/null && echo "✔ reachable"

say "Root tags include 'Reports'?"
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq '([.tags // [] | .[]?.name] | any(. == "Reports"))'

say "All /reports/* endpoints tagged exactly 'Reports'?"
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq '[.paths
       | to_entries[]
       | select(.key|startswith("/reports/"))
       | .value
       | to_entries[]
       | (.value.tags // [])[]] 
       | unique == ["Reports"]'

say "Per-path tags (manual glance)"
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq -r '.paths
         | to_entries[]
         | select(.key|startswith("/reports/"))
         | .key as $p
         | .value
         | to_entries[]
         | "\($p) \(.key) -> \((.value.tags // [])|join(","))"' \
| sort

say "Code-level: controllers missing @ApiTags('Reports')"
missing=0
while IFS= read -r f; do
  if ! grep -q "@ApiTags('Reports')" "$f"; then
    echo "✖ Falta @ApiTags('Reports') en $f"
    missing=1
  fi
done < <(grep -RIl "@Controller('reports')" src/reports || true)
[[ $missing -eq 0 ]] && echo "✔ Todos los controllers de /reports tienen @ApiTags('Reports')"

say "inventory-moves.csv Content-Disposition filename"
curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/inventory-moves.csv" \
| grep -Ei '^Content-(Type|Disposition)'
echo '→ Esperado: Content-Disposition: attachment; filename="inventory-moves.csv"'
