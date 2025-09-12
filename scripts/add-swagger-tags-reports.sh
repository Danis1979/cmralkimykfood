#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE:-https://localhost:3000}"
SRC_DIR="${SRC_DIR:-src/reports}"

say(){ echo; echo "== $* =="; }

if [ ! -d "$SRC_DIR" ]; then
  echo "✖ No existe $SRC_DIR (¿estás en backend/api?)"
  exit 1
fi

say "Buscando controllers @Controller('reports') en $SRC_DIR"
FILES="$(find "$SRC_DIR" -type f -name '*.ts' -print0 | xargs -0 grep -l "@Controller('reports')" 2>/dev/null || true)"
[ -n "${FILES}" ] || { echo "ℹ No hay controllers con @Controller('reports')"; exit 0; }

echo "$FILES" | while IFS= read -r f; do
  [ -n "$f" ] || continue
  echo "— — —"
  echo "Archivo: $f"

  # A) Asegurar import de ApiTags (idempotente)
  if ! grep -q "from '@nestjs/swagger'" "$f"; then
    tmp="$(mktemp)"; { echo "import { ApiTags } from '@nestjs/swagger';"; cat "$f"; } > "$tmp" && mv "$tmp" "$f"
    echo "  ＋ Añadido import de ApiTags (no había ningún import de swagger)"
  else
    if ! grep -Eq 'import\s*\{[^}]*ApiTags[^}]*\}\s*from\s*["'"'"']@nestjs/swagger["'"'"']\s*;' "$f"; then
      if ! grep -q "^import { ApiTags } from '@nestjs/swagger';" "$f"; then
        tmp="$(mktemp)"; { echo "import { ApiTags } from '@nestjs/swagger';"; cat "$f"; } > "$tmp" && mv "$tmp" "$f"
        echo "  ＋ Añadido import de ApiTags (línea separada)"
      else
        echo "  ✓ Ya tenía import independiente de ApiTags"
      fi
    else
      echo "  ✓ ApiTags ya estaba en el import existente"
    fi
  fi

  # B) Decorador @ApiTags('Reports') debajo de @Controller('reports')
  if ! grep -q "@ApiTags('Reports')" "$f"; then
    perl -0777 -i -pe 's/(@Controller\(\s*["\x27]reports["\x27]\s*\)\s*)/$1\n@ApiTags(\x27Reports\x27)\n/s' "$f"
    echo "  ＋ Añadido @ApiTags('Reports')"
  else
    echo "  ✓ Ya tenía @ApiTags('Reports')"
  fi
done

say "Verificando Swagger"
if curl -ksS --tlsv1.2 "$BASE_URL/docs-json" >/dev/null; then
  echo "✔ /docs-json OK"

  echo; echo "Paths /reports/*:"
  curl -ksS --tlsv1.2 "$BASE_URL/docs-json" | jq -r '.paths | keys[]?' | grep "^/reports/" | sort

  echo; echo "Tags (debería incluir 'Reports'):"
  curl -ksS --tlsv1.2 "$BASE_URL/docs-json" | jq -r '.tags[]?.name' | sort -u || true
else
  echo "ℹ No pude acceder a $BASE_URL/docs-json (¿servidor caído?)."
fi

echo; echo "✔ Listo."
