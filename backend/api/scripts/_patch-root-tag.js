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
