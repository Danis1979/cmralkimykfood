(function(){
  function el(id){ return document.getElementById(id); }
  function b(){
    const i=document.getElementById('api_base');
    let v=(i&&i.value?i.value:location.origin).trim();
    try{
      const u=new URL(v);
      if(location.protocol==="https:" && u.protocol==="http:" && (u.hostname==="localhost"||u.hostname==="127.0.0.1")){
        u.protocol="https:"; v=u.origin; if(i) i.value=v;
      }
    }catch(e){}
    return v;
  }
  function k(){ return (document.getElementById('api_key')||{}).value||''; }
  function qsFromTo(){ return (window.getGlobalRange? window.getGlobalRange(): ''); }
  function asOf(){ return (window.getAsOf? window.getAsOf(): ''); }

  async function testKey(){
    const s=el('qa_status'); if(s){ s.textContent='…'; s.style.color='#444'; }
    try{
      const r = await fetch(b()+'/reports/kpis'+qsFromTo(), { headers:{'x-api-key':k()} });
      if(r.ok){ if(s){ s.textContent='OK'; s.style.color='#15803d'; } }
      else    { if(s){ s.textContent='Auth? '+r.status; s.style.color='#b91c1c'; } }
    }catch{ if(s){ s.textContent='Error'; s.style.color='#b91c1c'; } }
    setTimeout(()=>{ if(s) s.textContent=''; }, 4000);
  }

  async function downloadCsv(path){
    try{
      let url=b()+path;
      if (/sales-vs-purchases|margin-by-product|top-clients|orders|productions|inventory-moves/.test(path)) url += qsFromTo();
      if (/receivables-aging/.test(path)) url += asOf();
      const resp = await fetch(url, { headers:{ 'x-api-key': k() }});
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const cd = resp.headers.get('Content-Disposition')||'';
      const m  = /filename="?([^"]+)"?/i.exec(cd);
      const name = m? m[1] : (path.split('/').pop()||'export.csv');
      const blob = await resp.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
    }catch(e){ const s=el('qa_status'); if(s){ s.textContent='Err CSV'; s.style.color='#b91c1c'; setTimeout(()=>s.textContent='',2500); } }
  }

  function bind(){
    el('qa_test_key')?.addEventListener('click', testKey);
    el('qa_refresh_all')?.addEventListener('click', ()=> (window.loadAll?window.loadAll():location.reload()));
    el('csv_top_clients')?.addEventListener('click', ()=>downloadCsv('/reports/top-clients.csv'));
    el('csv_margin_by_product')?.addEventListener('click', ()=>downloadCsv('/reports/margin-by-product.csv'));
    el('csv_svp')?.addEventListener('click', ()=>downloadCsv('/reports/sales-vs-purchases.csv'));
    el('csv_inventory_value')?.addEventListener('click', ()=>downloadCsv('/reports/inventory-value.csv'));
    el('csv_productions')?.addEventListener('click', ()=>downloadCsv('/reports/productions.csv'));
    el('csv_inventory_moves')?.addEventListener('click', ()=>downloadCsv('/reports/inventory-moves.csv'));
    el('csv_receivables_aging')?.addEventListener('click', ()=>downloadCsv('/reports/receivables-aging.csv'));
    el('csv_orders')?.addEventListener('click', ()=>downloadCsv('/reports/orders.csv'));
  }
  document.addEventListener('DOMContentLoaded', bind);
})();
