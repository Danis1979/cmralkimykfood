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
