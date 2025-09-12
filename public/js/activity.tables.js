(function(){
  const $  = (id)=>document.getElementById(id);
  const base = (window.base || function(){ const i=$('api_base'); return (i&&i.value?i.value:location.origin).trim(); });
  const key  = (window.key  || function(){ const i=$('api_key');  return (i&&i.value?i.value:'').trim(); });

  const get = async (url)=>{
    const r = await fetch(url, { headers:{'x-api-key': key()}});
    if(!r.ok) throw new Error(r.status+' '+r.statusText);
    return r.json();
  };

  async function loadProductions(){
    const t = $('tbl_productions'); if(!t) return;
    const data = await get(base()+"/ops/productions?skip=0&take=10");
    const rows = (data.items||[]).map(x=>`
      <tr>
        <td>${new Date(x.date).toLocaleString()}</td>
        <td>${x.direction}</td>
        <td>${x.sku}</td>
        <td>${x.name||''}</td>
        <td style="text-align:right">${x.qty}</td>
      </tr>`).join('');
    t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">Sin datos</td></tr>';
  }

  async function loadReceivables(){
    const t = $('tbl_receivables'); if(!t) return;
    const data = await get(base()+"/receivables-search?status=Pendiente&take=10&skip=0");
    const rows = (data.items||[]).map(x=>`
      <tr>
        <td>${new Date(x.dueDate||x.createdAt).toLocaleDateString()}</td>
        <td>${x.client||''}</td>
        <td>${x.status}</td>
        <td style="text-align:right">${x.balance}</td>
        <td>${x.notes||''}</td>
      </tr>`).join('');
    t.querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">Sin datos</td></tr>';
  }

  async function loadAll(){
    await Promise.allSettled([loadProductions(), loadReceivables()]);
  }

  window.loadActivity = loadAll;
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('qa_refresh_all')?.addEventListener('click', loadAll);
    loadAll();
  });
})();
