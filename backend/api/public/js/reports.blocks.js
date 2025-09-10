(function(){
  const $ = (id)=>document.getElementById(id);
  const F = ()=> ($('#global_from')||{}).value || '';
  const T = ()=> ($('#global_to')||{}).value || '';
  const K = ()=> ($('#api_key')||{}).value?.trim() || '';

  // usa la función base() ya existente en el dashboard
  const B = ()=> (typeof window.base==='function' ? window.base() : location.origin);

  const qsFromTo = ()=>{
    const q=[]; if(F()) q.push('from='+encodeURIComponent(F())); if(T()) q.push('to='+encodeURIComponent(T()));
    return q.length ? '?'+q.join('&') : '';
  };

  async function fetchJson(url){
    const r = await fetch(url, { headers: { 'accept':'application/json', ...(K()? {'x-api-key':K()} : {}) }});
    if (r.status === 401) throw new Error('401 Unauthorized');
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  function fmt(n){ try{ return Number(n).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2}); }catch{ return n; } }
  function fmt0(n){ try{ return Number(n).toLocaleString('es-AR'); }catch{ return n; } }

  async function loadSvp(){
    const t = $('tbl_svp'); if(!t) return;
    t.querySelector('tbody').innerHTML = '<tr><td colspan="4">Cargando…</td></tr>';
    try{
      const data = await fetchJson(B()+'/reports/sales-vs-purchases'+qsFromTo());
      const rows = (data.items||[]).map(it =>
        `<tr><td>${it.month||'-'}</td><td style="text-align:right">${fmt(it.sales||0)}</td><td style="text-align:right">${fmt(it.purchases||0)}</td><td style="text-align:right">${fmt(it.net||0)}</td></tr>`
      ).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="4">Sin datos</td></tr>';
    }catch(e){
      t.querySelector('tbody').innerHTML = `<tr><td colspan="4">${e.message.includes('401')?'🔑 Falta API key':'Error '+e.message}</td></tr>`;
    }
  }

  async function loadMargin(){
    const t = $('tbl_margin'); if(!t) return;
    t.querySelector('tbody').innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
    try{
      const data = await fetchJson(B()+'/reports/margin-by-product'+qsFromTo());
      const rows = (data.items||[]).map(p =>
        `<tr><td>${p.sku}</td><td>${p.name}</td><td style="text-align:right">${fmt0(p.qty||0)}</td><td style="text-align:right">${fmt(p.revenue||0)}</td><td style="text-align:right">${fmt(p.cost||0)}</td><td style="text-align:right">${fmt(p.margin||0)}</td></tr>`
      ).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="6">Sin datos</td></tr>';
    }catch(e){
      t.querySelector('tbody').innerHTML = `<tr><td colspan="6">${e.message.includes('401')?'🔑 Falta API key':'Error '+e.message}</td></tr>`;
    }
  }

  async function loadTopClients(){
    const t = $('tbl_top_clients'); if(!t) return;
    t.querySelector('tbody').innerHTML = '<tr><td colspan="5">Cargando…</td></tr>';
    try{
      const q = qsFromTo();
      const data = await fetchJson(B()+'/reports/top-clients'+(q?(q+'&limit=5'):'?limit=5'));
      const rows = (data.items||[]).map(c =>
        `<tr><td>${c.client}</td><td>${c.email||''}</td><td style="text-align:right">${fmt0(c.salesCount||0)}</td><td style="text-align:right">${fmt(c.revenue||0)}</td><td style="text-align:right">${fmt(c.avgTicket||0)}</td></tr>`
      ).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">Sin datos</td></tr>';
    }catch(e){
      t.querySelector('tbody').innerHTML = `<tr><td colspan="5">${e.message.includes('401')?'🔑 Falta API key':'Error '+e.message}</td></tr>`;
    }
  }

  async function loadInventoryValue(){
    const t = $('tbl_inventory_value'); if(!t) return;
    t.querySelector('tbody').innerHTML = '<tr><td colspan="5">Cargando…</td></tr>';
    try{
      const data = await fetchJson(B()+'/reports/inventory-value');
      const rows = (data.items||[]).map(i =>
        `<tr><td>${i.sku}</td><td>${i.name}</td><td style="text-align:right">${fmt0(i.onHand||0)}</td><td style="text-align:right">${fmt(i.costStd||0)}</td><td style="text-align:right">${fmt(i.value||0)}</td></tr>`
      ).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">Sin datos</td></tr>';
    }catch(e){
      t.querySelector('tbody').innerHTML = `<tr><td colspan="5">${e.message.includes('401')?'🔑 Falta API key':'Error '+e.message}</td></tr>`;
    }
  }

  async function loadLowStock(){
    const t = $('tbl_low_stock'); if(!t) return;
    t.querySelector('tbody').innerHTML = '<tr><td colspan="3">Cargando…</td></tr>';
    try{
      let data = await fetchJson(B()+'/inventory/stock');
      data = (data.items||data||[]).slice().sort((a,b)=>(a.onHand||0)-(b.onHand||0)).slice(0,10);
      const rows = data.map(x =>
        `<tr><td>${x.sku}</td><td>${x.name}</td><td style="text-align:right">${fmt0(x.onHand||0)}</td></tr>`
      ).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="3">Sin datos</td></tr>';
    }catch(e){
      t.querySelector('tbody').innerHTML = `<tr><td colspan="3">${e.message.includes('401')?'🔑 Falta API key':'Error '+e.message}</td></tr>`;
    }
  }

  function monthRange(){
    const d = new Date();
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0,10);
    const to   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1)).toISOString().slice(0,10);
    return {from, to};
  }

  async function loadChequesMes(){
    const t = $('tbl_cheques_mes'); if(!t) return;
    t.querySelector('tbody').innerHTML = '<tr><td colspan="5">Cargando…</td></tr>';
    try{
      const f=F(), tt=T(); const {from,to} = (f&&tt) ? {from:f+'-01', to:tt+'-01'} : monthRange();
      const data = await fetchJson(B()+`/cheques-search?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`);
      const items = data.items || data || [];
      const rows = items.slice(0,10).map(ch =>
        `<tr><td>${(ch.date||ch.dueDate||'').slice(0,10)}</td><td>${ch.type||''}</td><td>${ch.person||''}</td><td style="text-align:right">${fmt(ch.amount||0)}</td><td>${ch.status||''}</td></tr>`
      ).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">Sin datos</td></tr>';
    }catch(e){
      t.querySelector('tbody').innerHTML = `<tr><td colspan="5">${e.message.includes('401')?'🔑 Falta API key':'Error '+e.message}</td></tr>`;
    }
  }

  async function loadAll(){
    await Promise.allSettled([loadSvp(), loadMargin(), loadTopClients(), loadInventoryValue(), loadLowStock(), loadChequesMes()]);
  }

  window.loadReportsAll = loadAll;
  document.addEventListener('DOMContentLoaded', ()=>{
    loadAll();
    // refrescar si cambiás la key o el rango
    $('#qa_refresh_all')?.addEventListener('click', loadAll);
    $('#api_key')?.addEventListener('change', loadAll);
    $('#global_from')?.addEventListener('change', loadAll);
    $('#global_to')?.addEventListener('change', loadAll);
  });
})();
