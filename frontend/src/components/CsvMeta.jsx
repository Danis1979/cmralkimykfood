import { useEffect, useState } from 'react';

function formatBytes(n){
  if(n == null) return '—';
  const u=['B','KB','MB','GB']; let i=0, v=Number(n);
  while(v>=1024 && i<u.length-1){ v/=1024; i++; }
  const dec = v<10 && i>0 ? 1 : 0;
  return `${v.toFixed(dec)} ${u[i]}`;
}
function formatDT(s){
  if(!s) return '—';
  return new Intl.DateTimeFormat('es-AR',{ dateStyle:'medium', timeStyle:'short' })
    .format(new Date(s));
}

export default function CsvMeta(){
  const [meta,setMeta] = useState({ size:null, last:null });
  useEffect(()=>{ (async ()=>{
    try{
      const API = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API}/reports/stock.csv`, { method:'HEAD' });
      const size = res.headers.get('content-length');   // requiere Expose-Headers
      const last = res.headers.get('last-modified');    // simple header
      setMeta({ size: size? Number(size): null, last });
    }catch(e){ setMeta({ size:null, last:null }); }
  })(); }, []);

  return (
    <div className="text-sm text-slate-600 mt-2">
      stock.csv • {formatBytes(meta.size)} • {formatDT(meta.last)}
    </div>
  );
}
