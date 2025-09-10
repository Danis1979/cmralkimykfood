#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"

say(){ echo; echo "== $* =="; }

# 1) Helper Node para parchear un controller:
mkdir -p scripts
cat > scripts/_patch-apitags.js <<'NODE'
const fs=require('fs');
const f=process.argv[2];
let s=fs.readFileSync(f,'utf8'); const o=s;

function ensureSwaggerImport(str){
  if(/from\s+['"]@nestjs\/swagger['"]/.test(str)){
    // Unificar import con ApiTags
    return str.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]@nestjs\/swagger['"]\s*;?/,
      (m,inside)=>{
        const names = inside.split(',').map(x=>x.trim()).filter(Boolean);
        if(!names.includes('ApiTags')) names.push('ApiTags');
        return `import { ${Array.from(new Set(names)).join(', ')} } from '@nestjs/swagger';`;
      }
    );
  } else {
    return `import { ApiTags } from '@nestjs/swagger';\n` + str;
  }
}

// Aseguro import y normalizo @ApiTags(...)
s = ensureSwaggerImport(s);
s = s.replace(/@ApiTags\([^)]*\)/g, "@ApiTags('Reports')");

// Si no quedó @ApiTags y es controller de 'reports', lo inserto debajo del @Controller
if(!/@ApiTags\(/.test(s) && /@Controller\(\s*['"]reports['"]\s*\)/.test(s)){
  s = s.replace(/(@Controller\(\s*['"]reports['"]\s*\))/,
                "$1\n@ApiTags('Reports')");
}

if(s !== o){
  fs.writeFileSync(f, s);
  console.log("patched", f);
}
NODE

# 2) Helper Node para agregar .addTag('Reports') en src/main.ts
cat > scripts/_patch-root-tag.js <<'NODE'
const fs=require('fs');
const f='src/main.ts';
if(!fs.existsSync(f)){ console.log('skip main.ts (no existe)'); process.exit(0); }
let s=fs.readFileSync(f,'utf8'); const o=s;
// Si falta .addTag('Reports'), lo inserto antes de .build()
if(!/\.addTag\(\s*['"]Reports['"]\s*\)/.test(s) && /new\s+DocumentBuilder\(/.test(s)){
  s = s.replace(/(\.build\s*\(\s*\))/m, `.addTag('Reports')\n  $1`);
}
if(s !== o){
  fs.writeFileSync(f, s);
  console.log("patched", f);
}
NODE

say "Parcheando controllers reales @Controller('reports') (ignorando backups .bak.*)"
# Recorro SOLO .ts reales (no .bak.*)
grep -RIl "@Controller('reports')" src/reports \
  | grep -v '\.bak\.' \
  | while read -r f; do
      node scripts/_patch-apitags.js "$f" || true
    done

say "Parcheando tag raíz en Swagger (src/main.ts)"
node scripts/_patch-root-tag.js || true

# 3) Verificación
say "Swagger /docs-json reachable"
curl -ksS --tlsv1.2 "$BASE/docs-json" >/dev/null && echo "✔ reachable"

say "Root tags include 'Reports'?"
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq '([.tags // [] | .[]?.name] | any(. == "Reports"))'

say "Todos los /reports/* con tag EXACTO ['Reports']?"
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq '[.paths
       | to_entries[]
       | select(.key|startswith("/reports/"))
       | .value
       | to_entries[]
       | ((.value.tags // []) == ["Reports"])]
       | all'

say "Listado por path/método → tags"
curl -ksS --tlsv1.2 "$BASE/docs-json" \
| jq -r '.paths
         | to_entries[]
         | select(.key|startswith("/reports/"))
         | .key as $p
         | .value
         | to_entries[]
         | "\($p) \(.key) -> \((.value.tags // [])|join(","))"' \
| sort

say "Controllers REALES sin @ApiTags('Reports') (excluyendo .bak.*)"
missing=0
while IFS= read -r f; do
  if ! grep -q "@ApiTags('Reports')" "$f"; then
    echo "✖ Falta @ApiTags('Reports') en $f"
    missing=1
  fi
done < <(grep -RIl "@Controller('reports')" src/reports | grep -v '\.bak\.' || true)
[[ $missing -eq 0 ]] && echo "✔ Todos los controllers reales de /reports tienen @ApiTags('Reports')"

say "HEAD inventory-moves.csv (filename esperado)"
curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE/reports/inventory-moves.csv" \
| grep -Ei '^Content-(Type|Disposition)'
echo '→ Esperado: Content-Disposition: attachment; filename="inventory-moves.csv"'

echo; echo "✅ Done"
