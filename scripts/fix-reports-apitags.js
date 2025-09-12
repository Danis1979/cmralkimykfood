const fs = require('fs');

function fixFile(p){
  let s = fs.readFileSync(p,'utf8');
  const o = s;

  // 1) Remover líneas basura tipo: ('Reports') o ('Reports');
  s = s.replace(/^\s*\('Reports'\)\s*;?\s*$/mg, '');

  // 2) Levantar TODOS los imports desde @nestjs/swagger y colapsarlos a uno
  const reImp = /import\s*\{([^}]*)\}\s*from\s*['"]@nestjs\/swagger['"]\s*;?/g;
  let names = new Set();
  let anySwagger = false;
  s = s.replace(reImp, (_, inside) => {
    anySwagger = true;
    inside.split(',').forEach(x=>{
      const name = x.trim().split(/\s+as\s+/)[0];
      if(name) names.add(name);
    });
    return ''; // los saco, reinsertamos uno solo luego
  });
  names.add('ApiTags'); // asegurar ApiTags

  // 3) Insertar un único import { ... } from '@nestjs/swagger'; al tope
  if(anySwagger || /@ApiTags\(/.test(s)){
    const imp = `import { ${Array.from(names).sort().join(', ')} } from '@nestjs/swagger';\n`;
    // evitar duplicar si ya quedó exactamente igual arriba
    if(!s.startsWith(imp)) s = imp + s;
  }

  // 4) Normalizar cualquier @ApiTags(...) a @ApiTags('Reports')
  s = s.replace(/@ApiTags\([^)]*\)/g, "@ApiTags('Reports')");

  // 5) Si es un controller de 'reports' y aún no tiene ApiTags, insertarlo debajo de @Controller('reports')
  if (/@Controller\(\s*['"]reports['"]\s*\)/.test(s) && !/@ApiTags\('Reports'\)/.test(s)) {
    s = s.replace(/(@Controller\(\s*['"]reports['"]\s*\))/,
                  "$1\n@ApiTags('Reports')");
  }

  // 6) Compactar saltos de línea excesivos
  s = s.replace(/\n{3,}/g, '\n\n');

  if(s !== o){
    fs.writeFileSync(p, s);
    console.log('patched', p);
  }
}

function isBackup(path){ return /\.bak\./.test(path); }
function isTs(path){ return path.endsWith('.ts'); }

function walk(dir){
  for (const e of fs.readdirSync(dir)) {
    const p = dir + '/' + e;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (isTs(p) && !isBackup(p)) {
      // Sólo tocar archivos que parecen controllers de reports
      const txt = fs.readFileSync(p,'utf8');
      if(/@Controller\(\s*['"]reports['"]\s*\)/.test(txt)) fixFile(p);
    }
  }
}

walk('src/reports');
