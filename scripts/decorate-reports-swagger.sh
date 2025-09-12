#!/usr/bin/env bash
set -euo pipefail

# Detecta ruta (raíz del repo o backend/api)
ROOT="backend/api"
[[ -d "$ROOT/src" ]] || ROOT="."
GLOB="$ROOT/src/reports/*csv*.controller.ts"

green(){ printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
blue(){ printf "\033[34m%s\033[0m\n" "$*"; }

add_swagger_import(){
  local f="$1"
  if ! grep -q "@nestjs/swagger" "$f"; then
    sed -i '' '1i\
import { ApiTags, ApiOperation, ApiProduces, ApiQuery, ApiSecurity } from "@nestjs/swagger";
' "$f"
    blue "＋ import Swagger → $f"
  else
    yellow "• import Swagger ya presente → $f"
  fi
}

add_class_decorators(){
  local f="$1"
  if ! grep -q "@ApiTags('Reports / CSV')" "$f"; then
    perl -0777 -i -pe "s/(\n\s*)@Controller\('reports'\)/\1@ApiTags('Reports \/ CSV')\n\1@ApiSecurity('apiKey')\n\1@Controller('reports')/s" "$f" \
      && blue "＋ Class decorators → $f" \
      || yellow "• No se pudo insertar class decorators (ya estarán) → $f"
  else
    yellow "• Class decorators ya presentes → $f"
  fi
}

csv_route_to_summary(){
  local route="$1" name
  name="${route%.csv}"
  name="$(echo "$name" | sed -E 's/(^|-)([a-z])/\U\2/g; s/-/ /g')"
  printf "%s (CSV)" "$name"
}

apiquery_line_for(){
  local q="$1"
  case "$q" in
    from|date_from)    echo '@ApiQuery({ name: "from", required: false, example: "2025-09", description: "YYYY-MM o fecha" })' ;;
    to|date_to)        echo '@ApiQuery({ name: "to", required: false, example: "2025-09", description: "YYYY-MM o fecha" })' ;;
    as_of)             echo '@ApiQuery({ name: "as_of", required: false, example: "2025-09-09", description: "Fecha de corte (YYYY-MM-DD)" })' ;;
    limit)             echo '@ApiQuery({ name: "limit", required: false, example: 100, description: "Límite de filas" })' ;;
    take)              echo '@ApiQuery({ name: "take", required: false, example: 20, description: "Cantidad (paginación)" })' ;;
    skip)              echo '@ApiQuery({ name: "skip", required: false, example: 0, description: "Offset (paginación)" })' ;;
    order)             echo '@ApiQuery({ name: "order", required: false, example: "field:asc,field2:desc", description: "Orden múltiple campo:asc|desc" })' ;;
    sku)               echo '@ApiQuery({ name: "sku", required: false, example: "PT-CAPRESE-001", description: "Filtrar por SKU" })' ;;
    direction)         echo '@ApiQuery({ name: "direction", required: false, example: "IN", description: "IN | OUT" })' ;;
    clientEmail)       echo '@ApiQuery({ name: "clientEmail", required: false, example: "demo@cliente.com", description: "Filtrar por email de cliente" })' ;;
    status)            echo '@ApiQuery({ name: "status", required: false, example: "Pendiente", description: "Estado" })' ;;
    *)                 echo "@ApiQuery({ name: \"$q\", required: false })" ;;
  esac
}

decorate_methods(){
  local f="$1"
  local routes
  routes=$(grep -oE "@Get\('([^']+\.csv)'\)" "$f" | sed -E "s/.*'([^']+)'.*/\1/" | sort -u || true)
  [[ -z "${routes}" ]] && { yellow "• Sin rutas CSV en $f"; return; }

  while IFS= read -r route; do
    [[ -z "$route" ]] && continue

    # Si ya tiene ApiProduces cerca de esa ruta, saltar
    if awk -v r="$route" '
      $0 ~ "@Get\x27" r "\x27" { get=1; next }
      get && $0 ~ /@ApiProduces/ { print "HIT"; exit }
      get && $0 ~ /^\s*async\b/ { exit }' "$f" | grep -q HIT; then
      yellow "• Método $route ya decorado → $f"
      continue
    fi

    # Detectar @Query('...') usados en la firma para documentarlos
    local qlist
    qlist=$(awk -v r="$route" '
      $0 ~ "@Get\x27" r "\x27" { c=1; next }
      c && /@Query\(\x27[^'\''"]+\x27\)/ {
        while (match($0, /@Query\(\x27([^'\'']+)\x27\)/, a)) {
          print a[1]; $0=substr($0, RSTART+RLENGTH);
        }
      }
      c && /async[[:space:]]+[a-zA-Z0-9_]+\(/ { exit }
    ' "$f" | sort -u)

    # Bloque a inyectar
    local summary desc block
    summary="$(csv_route_to_summary "$route")"
    desc="Exporta CSV del reporte."
    block="  @ApiOperation({ summary: \"$summary\", description: \"$desc\" })\n  @ApiProduces('text/csv')"
    if [[ -n "$qlist" ]]; then
      while IFS= read -r q; do
        [[ -z "$q" ]] && continue
        block="${block}\n  $(apiquery_line_for "$q")"
      done <<< "$qlist"
    fi
    block="${block}\n"

    # Inyectar justo después del @Get('route')
    ROUTE="$route" BLOCK="$block" perl -0777 -i -pe '
      BEGIN {
        $r = $ENV{ROUTE} // "";
        $ins = $ENV{BLOCK} // "";
      }
      s/(\@Get\(\x27\Q$r\E\x27\)\s*)/$1.$ins/s;
    ' "$f" \
      && blue "＋ Decorado método $route → $f" \
      || yellow "• No se pudo decorar $route (revisá formato) → $f"
  done <<< "$routes"
}

main(){
  local any=0
  for f in $GLOB; do
    [[ -f "$f" ]] || continue
    any=1
    echo "— — —"
    echo "Archivo: $f"
    add_swagger_import "$f"
    add_class_decorators "$f"
    decorate_methods "$f"
  done
  [[ "$any" -eq 1 ]] || yellow "No se encontraron controllers CSV en $GLOB"
  echo "Listo. Abrí https://localhost:3000/docs y verificá los endpoints CSV."
}

main
