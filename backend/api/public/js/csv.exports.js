// /public/js/csv.exports.js
(function(){
  function qs(obj){
    const q=[]; for(const k in obj){ if(obj[k]) q.push(encodeURIComponent(k)+'='+encodeURIComponent(obj[k])) }
    return q.length?('?'+q.join('&')):'';
  }
  function span(){
    return {
      from: document.getElementById('global_from')?.value || '',
      to:   document.getElementById('global_to')?.value   || ''
    };
  }
  function parseFilename(contentDisposition){
    if(!contentDisposition) return null;
    // ej: attachment; filename="top-clients.csv"
    const m = /filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i.exec(contentDisposition);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function downloadCsv(path){
    const {from,to} = span();
    const url = base()+path+qs({from,to});
    const res = await fetch(url, { headers: { 'x-api-key': key() } });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const blob = await res.blob();
    let fname = parseFilename(res.headers.get('Content-Disposition')) || 'report.csv';

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const bind=(id, path)=> document.getElementById(id)?.addEventListener('click', ()=>downloadCsv(path));
    bind('csv_top_clients',        '/reports/top-clients.csv');
    bind('csv_margin_by_product',  '/reports/margin-by-product.csv');
    bind('csv_svp',                '/reports/sales-vs-purchases.csv');
    bind('csv_inventory_value',    '/reports/inventory-value.csv');
    bind('csv_productions',        '/reports/productions.csv');
    bind('csv_inventory_moves',    '/reports/inventory-moves.csv');
    bind('csv_orders',             '/reports/orders.csv');
  });
})();