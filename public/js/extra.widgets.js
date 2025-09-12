(function(){
  const fmt = (n)=> new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(n||0);
  const money = (n)=> '$ ' + fmt(n||0);

  function monthSpan(){
    const f=(document.getElementById('global_from')||{}).value||'';
    const t=(document.getElementById('global_to')||{}).value||'';
    if (f && t) return {from:f, to:t};
    const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0');
    return {from:`${y}-${m}`, to:`${y}-${m}`};
  }
  function qs(obj){ const q=[]; for(const k in obj){ if(obj[k]) q.push(encodeURIComponent(k)+'='+encodeURIComponent(obj[k])) } return q.length?('?'+q.join('&')):'' }
  async function get(path){
    const url = base()+path;
    const res = await fetch(url, { headers:{ 'x-api-key': key() }});
    if(!res.ok) throw new Error('HTTP '+res.status+' on '+path);
    return res.json();
  }

  // ===== Ventas vs Compras (chart) =====
  async function loadSvp(){
    const c = document.getElementById('chart_svp');
    if(!c || !window.Chart) return;
    const {from,to} = monthSpan();
    const j = await get('/reports/sales-vs-purchases'+qs({from,to}));
    const items = j.items||[];
    const labels = items.map(i=>i.month);
    const sales = items.map(i=>i.sales);
    const purchases = items.map(i=>i.purchases);
    if (c._chart) { c._chart.destroy(); }
    c._chart = new Chart(c, {
      type:'line',
      data:{ labels, datasets:[
        { label:'Ventas', data:sales, tension:.25 },
        { label:'Compras', data:purchases, tension:.25 }
      ]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
    });
  }

  // ===== Margen por producto (tabla) =====
  async function loadMargin(){
    const t = document.getElementById('tbl_margin');
    if(!t) return;
    const {from,to} = monthSpan();
    const j = await get('/reports/margin-by-product'+qs({from,to,limit:10}));
    const rows = (j.items||[]).map(r=>{
      return `<tr>
        <td>${r.sku}</td>
        <td>${r.name}</td>
        <td class="right">${fmt(r.qty)}</td>
        <td class="right">${money(r.revenue)}</td>
        <td class="right">${money(r.cost)}</td>
        <td class="right">${money(r.margin)} (${fmt(r.marginPct)}%)</td>
      </tr>`;
    }).join('');
    t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="6">Sin datos</td></tr>';
  }

  // ===== Top clientes (tabla) =====
  async function loadTopClients(){
    const t = document.getElementById('tbl_top_clients');
    if(!t) return;
    const {from,to} = monthSpan();
    const j = await get('/reports/top-clients'+qs({from,to,limit:10}));
    const rows = (j.items||[]).map(r=>{
      return `<tr>
        <td>${r.client}</td>
        <td>${r.email||''}</td>
        <td class="right">${fmt(r.salesCount)}</td>
        <td class="right">${money(r.revenue)}</td>
        <td class="right">${money(r.avgTicket)}</td>
      </tr>`;
    }).join('');
    t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">Sin datos</td></tr>';
  }

  // ===== Valor de inventario (tabla) =====
  async function loadInventoryValue(){
    const t = document.getElementById('tbl_inventory_value');
    if(!t) return;
    const j = await get('/reports/inventory-value');
    const rows = (j.items||[]).map(r=>{
      return `<tr>
        <td>${r.sku}</td>
        <td>${r.name}</td>
        <td class="right">${fmt(r.onHand)}</td>
        <td class="right">${money(r.costStd)}</td>
        <td class="right">${money(r.value)}</td>
      </tr>`;
    }).join('');
    const totals = j.totals||{totalQty:0,totalValue:0};
    const totalRow = `<tr><th colspan="2">TOTAL</th><th class="right">${fmt(totals.totalQty)}</th><th></th><th class="right">${money(totals.totalValue)}</th></tr>`;
    t.querySelector('tbody').innerHTML = (rows?rows:'') + totalRow;
  }

  // ===== Stock bajo (tabla simple) =====
  async function loadLowStock(){
    const t = document.getElementById('tbl_low_stock');
    if(!t) return;
    try{
      const j = await get('/inventory/stock');
      const items = (j.items||j||[]).slice(); // soportar {items:[...]} o array directo
      items.sort((a,b)=>(a.onHand||0)-(b.onHand||0));
      const rows = items.slice(0,10).map(r=>{
        return `<tr><td>${r.sku||''}</td><td>${r.name||''}</td><td class="right">${fmt(r.onHand||0)}</td></tr>`;
      }).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="3">Sin datos</td></tr>';
    }catch{ t.querySelector('tbody').innerHTML = '<tr><td colspan="3">Sin datos</td></tr>'; }
  }

  // ===== Cheques del mes (tabla) =====
  async function loadChequesMes(){
    const t = document.getElementById('tbl_cheques_mes');
    if(!t) return;
    const {from,to} = monthSpan();
    function monthEdges(ym){
      // convierte YYYY-MM => YYYY-MM-01 y fin de mes
      const [Y,M]=ym.split('-').map(Number);
      const d1 = `${Y}-${String(M).padStart(2,'0')}-01`;
      const d2 = new Date(Y, M, 0); // último día del mes
      const d2s = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`;
      return {from: d1, to: d2s};
    }
    const {from:df} = monthEdges(from);
    const {to:dt}   = monthEdges(to);
    try{
      const j = await get('/cheques-search'+qs({date_from:df, date_to:dt}));
      const arr = j.items||j||[];
      const rows = arr.slice(0,10).map(c=>{
        return `<tr>
          <td>${c.date || c.issued_at || c.due_date || ''}</td>
          <td>${(c.type||'').toUpperCase()}</td>
          <td>${c.client || c.vendor || ''}</td>
          <td class="right">${money(c.amount||0)}</td>
          <td>${c.status||''}</td>
        </tr>`;
      }).join('');
      t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">Sin datos</td></tr>';
    }catch{
      t.querySelector('tbody').innerHTML = '<tr><td colspan="5">Sin datos</td></tr>';
    }
  }

  async function loadAll(){
    await Promise.allSettled([
      loadSvp(), loadMargin(), loadTopClients(),
      loadInventoryValue(), loadLowStock(), loadChequesMes()
    ]);
  }

  window.loadExtras = loadAll;
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('qa_refresh_all')?.addEventListener('click', ()=>loadAll());
    // primera carga
    loadAll();
  });
})();
