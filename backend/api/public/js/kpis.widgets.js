(function(){
  const $  = (id)=>document.getElementById(id);
  const base = (window.base || function(){ const i=$('api_base'); return (i&&i.value?i.value:location.origin).trim(); });
  const key  = (window.key  || function(){ const i=$('api_key');  return (i&&i.value?i.value:'').trim(); });
  const gf   = ()=> ($('global_from')?.value || '').trim();
  const gt   = ()=> ($('global_to')?.value   || '').trim();

  const qs = (q)=>Object.entries(q).filter(([,v])=>v!=null && v!=='')
    .map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');
  const get = async (url)=>{
    const r = await fetch(url, { headers:{'x-api-key': key()}});
    if(!r.ok) throw new Error(r.status+' '+r.statusText);
    return r.json();
  };

  function parseYm(s){ const m=/^(\d{4})-(\d{2})$/.exec(s||''); if(!m) return null; return {y:+m[1], M:+m[2]}; }
  function ymToString(y,M){ return y+'-'+String(M).padStart(2,'0'); }
  function prevYm(y,M){ if(M===1) return {y:y-1,M:12}; return {y,M:M-1}; }

  function computePrevRange(from,to){
    // Caso simple: YYYY-MM a YYYY-MM (mismo)
    const a=parseYm(from), b=parseYm(to);
    if(a && b){
      const p1=prevYm(a.y,a.M), p2=prevYm(b.y,b.M);
      return { from: ymToString(p1.y,p1.M), to: ymToString(p2.y,p2.M) };
    }
    // Fallback: si falta, no comparamos
    return null;
  }

  function pctChange(curr, prev){
    const c=+curr||0, p=+prev||0;
    if(p===0) return c===0 ? 0 : 100;
    return ((c-p)/p)*100;
  }

  function paintKpi(id, label, value, delta){
    const el=$(id); if(!el) return;
    const v = (value==null ? '-' : value);
    const d = (delta==null ? null : Math.round(delta*10)/10);
    const arrow = d==null ? '' : (d>0?'▲':(d<0?'▼':'■'));
    const color = d==null ? '#999' : (d>0?'#166534':(d<0?'#991b1b':'#6b7280'));
    el.innerHTML = `
      <div style="font-size:12px;color:#6b7280">${label}</div>
      <div style="font-size:22px;font-weight:700;margin:2px 0">${v.toLocaleString ? v.toLocaleString() : v}</div>
      <div style="font-size:12px;color:${color}">${arrow} ${d==null?'':(d+'%')} vs prev</div>
    `;
  }

  async function loadKpis(){
    const from=gf(), to=gt();
    const url = base()+"/reports/kpis"+(qs({from,to})?("?"+qs({from,to})):'');
    const cur = await get(url);
    const prevRange = computePrevRange(from,to);
    let prv=null;
    if(prevRange){
      const url2 = base()+"/reports/kpis?"+qs(prevRange);
      try{ prv = await get(url2); }catch{}
    }

    const cT = cur.totals||{};
    const pT = (prv&&prv.totals)||{};
    paintKpi('kpi_sales',      'Ventas',            cT.sales,      pctChange(cT.sales,      pT.sales));
    paintKpi('kpi_purchases',  'Compras',           cT.purchases,  pctChange(cT.purchases,  pT.purchases));
    paintKpi('kpi_net',        'Neto',              cT.net,        pctChange(cT.net,        pT.net));
    paintKpi('kpi_recv',       'Ctas por cobrar',   cur.receivablesPending, pctChange(cur.receivablesPending, prv?prv.receivablesPending:0));

    const tc = cur.topClient;
    const topEl = $('kpi_top_client');
    if(topEl){
      if(tc){
        topEl.innerHTML = `<div style="font-size:12px;color:#6b7280">Top cliente</div>
          <div style="font-size:14px;font-weight:600">${tc.client}</div>
          <div style="font-size:12px;color:#6b7280">${tc.email||''}</div>
          <div style="font-size:12px;margin-top:4px">Ingresos: <b>${tc.revenue?.toLocaleString?.()||tc.revenue||'-'}</b> | Tickets: ${tc.salesCount}</div>`;
      }else{
        topEl.textContent='Sin datos';
      }
    }
  }

  window.loadKpis = loadKpis;
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('qa_refresh_all')?.addEventListener('click', loadKpis);
    loadKpis();
  });
})();
