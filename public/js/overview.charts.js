(function(){
  const $ = (id)=>document.getElementById(id);
  const base = (window.base || function(){ const i=$('api_base'); return (i&&i.value?i.value:location.origin).trim(); });
  const key  = (window.key  || function(){ const i=$('api_key');  return (i&&i.value?i.value:'').trim(); });
  const gf   = ()=> ($('global_from')?.value || '').trim();
  const gt   = ()=> ($('global_to')?.value   || '').trim();

  const qs = (q)=> {
    const p = Object.entries(q).filter(([,v])=>v!=null && v!=='')
      .map(([k,v])=>k+'='+encodeURIComponent(v));
    return p.length ? ('?'+p.join('&')) : '';
  };
  const get = async (url)=>{
    const r = await fetch(url, { headers: { 'x-api-key': key() }});
    if(!r.ok) throw new Error(r.status+' '+r.statusText);
    return r.json();
  };

  let svpChart, marginChart, topClientsChart;
  async function loadCharts(){
    const params = { from: gf(), to: gt(), limit: 5 };

    // Ventas vs Compras
    const svp = await get(base()+"/reports/sales-vs-purchases"+qs({from:params.from,to:params.to}));
    const labels1 = svp.items.map(x=>x.month);
    const sales   = svp.items.map(x=>x.sales);
    const purch   = svp.items.map(x=>x.purchases);
    svpChart && svpChart.destroy();
    svpChart = new Chart(document.getElementById('chart_svp'), {
      type: 'bar',
      data: { labels: labels1, datasets: [{label:'Ventas',data:sales},{label:'Compras',data:purch}] },
      options: { responsive:true, plugins:{ legend:{position:'bottom'}, title:{display:true,text:'Ventas vs Compras'} }, scales:{ y:{beginAtZero:true} } }
    });

    // Margen por producto (Top 5)
    const mbp = await get(base()+"/reports/margin-by-product"+qs(params));
    const topP = mbp.items.slice(0,5);
    marginChart && marginChart.destroy();
    marginChart = new Chart(document.getElementById('chart_margin'), {
      type: 'bar',
      data: { labels: topP.map(x=>x.name), datasets:[{ label:'Margen', data: topP.map(x=>x.margin) }] },
      options: { indexAxis:'y', plugins:{ legend:{display:false}, title:{display:true,text:'Margen por producto (Top 5)'} }, scales:{ x:{beginAtZero:true} } }
    });

    // Top clientes (Top 5)
    const tc = await get(base()+"/reports/top-clients"+qs(params));
    const topC = tc.items.slice(0,5);
    topClientsChart && topClientsChart.destroy();
    topClientsChart = new Chart(document.getElementById('chart_topclients'), {
      type: 'bar',
      data: { labels: topC.map(x=>x.client), datasets:[{ label:'Ingresos', data: topC.map(x=>x.revenue) }] },
      options: { plugins:{ legend:{display:false}, title:{display:true,text:'Top clientes (Top 5)'} }, scales:{ y:{beginAtZero:true} } }
    });
  }

  window.loadOverviewCharts = loadCharts; // por si querés refrescar desde otro botón
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('qa_refresh_all')?.addEventListener('click', loadCharts);
    loadCharts();
  });
})();
