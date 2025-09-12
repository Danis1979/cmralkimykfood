#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"

say(){ echo -e "\n== $* =="; }

# 1) Obtener una sola vez el JSON de Swagger
if ! SWAGGER_JSON="$(curl -ksS --tlsv1.2 "$BASE/docs-json")"; then
  echo "✖ No pude obtener $BASE/docs-json"; exit 1
fi
if [[ -z "$SWAGGER_JSON" ]] || ! echo "$SWAGGER_JSON" | jq -e '.openapi' >/dev/null 2>&1; then
  echo "✖ Respuesta inválida de /docs-json (¿Swagger habilitado?)"; exit 1
fi

say "/docs-json reachable"
echo "✔ OK"

# 2) Listar paths /reports/*
say "Paths con /reports (esperados CSV)"
echo "$SWAGGER_JSON" | jq -r '.paths | keys[]?' | grep '^/reports/' | sort || true

# 3) Security schemes (API Key)
say "Seguridad: securitySchemes"
echo "$SWAGGER_JSON" | jq '.components.securitySchemes // {}'

say "¿Existe un apiKey en header llamado x-api-key?"
echo "$SWAGGER_JSON" | jq -r '
  (.components.securitySchemes // {}) | to_entries
  | map({key:.key, type:.value.type, in:(.value.in // ""), name:(.value.name // "")})
  | {
      found: ( any(.type=="apiKey" and (.in|ascii_downcase)=="header" and (.name|ascii_downcase)=="x-api-key") ),
      entries: .
    }
'

# 4) Tags disponibles
say "Tags útiles (Reports)"
TAGS=$(echo "$SWAGGER_JSON" | jq -r '.tags[]?.name' 2>/dev/null | sort -u || true)
if [[ -n "$TAGS" ]]; then
  echo "$TAGS"
else
  echo "ℹ No hay tags definidos en el Swagger (podés agregar @ApiTags('Reports') en los controllers)."
fi
