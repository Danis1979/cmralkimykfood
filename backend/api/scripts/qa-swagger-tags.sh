#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://localhost:3000}"

echo "== /docs-json =="
curl -ksS --tlsv1.2 "$BASE/docs-json" >/dev/null && echo "✔ reachable"

echo; echo "== Tags raíz (OpenAPI.tags) =="
curl -ksS --tlsv1.2 "$BASE/docs-json" | jq -r '.tags // [] | .[]?.name' | sort -u

echo; echo "== Tags por paths (derivados de @ApiTags) =="
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq -r '
  .paths
  | to_entries[]
  | .value
  | to_entries[]
  | .value.tags // []
  | .[]
' | sort -u

echo; echo "== Paths /reports/* con sus tags =="
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq -r '
  .paths
  | to_entries[]
  | select(.key|startswith("/reports/"))
  | .key as $p
  | .value
  | to_entries[]
  | "\($p) \(.key) -> \((.value.tags // [])|join(","))"
' | sort
