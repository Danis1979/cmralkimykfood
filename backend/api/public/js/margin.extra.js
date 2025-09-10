(function(){
  // Utilidades locales (no dependemos de otros scripts)
  const get = (sel, root=document)=>root.querySelector(sel);
  const gets = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
  const K = ()=> (get('#api_key')?.value||'').trim();
  const base = ()=> (typeof window.base==='function' ? window.base() : location.origin);
  const F = ()=> (get('#global_from')?.value||'').trim();
  const T = ()=> (get('#global_to')?.value||'').trim();
  const qsFromTo = ()=>{
    const q=[]; if(F()) q.push('from='+encodeURIComponent(F())); if(T()) q.push('to='+encodeURIComponent(T()));
    return q.length ? '?'+q.join('&') : '';
  };
  const fmt = (n)=>{ try{ return Number(n).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2}); }catch{ return n; } };
  const fmt0 = (n)=>{ try{ return Number(n).toLocaleString('es-AR'); }catch{ return n; } };

  async function fetchJson(url){
    const r = await fetch(url, { headers: { accept:'application/json', ...(K()? {'x-api-key':K()} : {}) }});
    if (r.status === 401) throw new Error('🔑 Falta API key');
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  async function fillAllMarginTables(){
    // buscar todos los bloques cuyo título diga “Top margen por producto”
    const headers = gets('h2, h3').filter(h => /top margen por producto/i.test(h.textContent || ''));
    if (!headers.length) return;

    // setear "Cargando…" en cada tabla detectada
    const tables = headers.map(h => h.closest('.card')?.querySelector('table')).filter(Boolean);
    tables.forEach(t => t.querySelector('tbody')?.insertAdjacentHTML('afterbegin',''));

    for (const t of tables) {
      try {
        t.querySelector('tbody').innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
      } catch {}
    }

    try{
      const data = await fetchJson(base()+'/reports/margin-by-product'+qsFromTo());
      const rows = (data.items||[]).map(p =>
        `<tr>
           <td>${p.sku||''}</td>
           <td>${p.name||''}</td>
           <td style="text-align:right">${fmt0(p.qty||0)}</td>
           <td style="text-align:right">${fmt(p.revenue||0)}</td>
           <td style="text-align:right">${fmt(p.cost||0)}</td>
           <td style="text-align:right">${fmt(p.margin||0)}</td>
         </tr>`
      ).join('');

      for (const t of tables) {
        const tbody = t.querySelector('tbody');
        if (!tbody) continue;
        tbody.innerHTML = rows || '<tr><td colspan="6">Sin datos</td></tr>';
      }
    }catch(e){
      for (const t of tables) {
        const tbody = t.querySelector('tbody');
        if (!tbody) continue;
        tbody.innerHTML = `<tr><td colspan="6">${e.message||'Error'}</td></tr>`;
      }
    }
  }

  // Hookear al flujo de refresco global si existe
  const wrap = (orig)=> async function(){
    try{ await orig?.(); }catch{}
    await fillAllMarginTables();
  };

  document.addEventListener('DOMContentLoaded', ()=>{
    // primer llenado
    fillAllMarginTables();
    // re-llenar al cambiar filtros o API key
    ['#qa_refresh_all','#api_key','#global_from','#global_to']
      .forEach(id => get(id)?.addEventListener('change', fillAllMarginTables));
    get('#qa_refresh_all')?.addEventListener('click', fillAllMarginTables);

    // si existe window.loadReportsAll, lo envolvemos para que también refresque estos bloques
    if (window.loadReportsAll) window.loadReportsAll = wrap(window.loadReportsAll);
  });
})();
