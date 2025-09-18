import { Link, useSearchParams } from 'react-router-dom';
function useSortParamLocal(){
  const [sp,setSp] = (typeof ReactRouterDOM!=='undefined' && ReactRouterDOM.useSearchParams)
    ? ReactRouterDOM.useSearchParams()
    : (window._dummySP || [new URLSearchParams(window.location.search), ()=>{}]);
  const sort = sp.get('sort') || '';
  const toggle = (key)=>{
    const asc = key, desc = `-${key}`;
    const next = sort === '' ? asc : (sort === asc ? desc : '');
    const nsp = new URLSearchParams(sp);
    if (next) nsp.set('sort', next); else nsp.delete('sort');
    if (setSp) setSp(nsp, { replace:true });
    const u = new URL(window.location.href); u.search = nsp.toString(); history.replaceState({}, '', u);
  };
  return { sort, toggle };
}





import { useQuery } from '@tanstack/react-query';
import { fetchOrders } from '../services/orders.service';
import { fmtCurrency } from '../lib/format';

export default function Orders() {
  const [sp, setSp] = useSearchParams();
  const page  = Number(sp.get('page')  || 1);
  const limit = Number(sp.get('limit') || 10);
  const q     = sp.get('q')    || '';
  const from  = sp.get('from') || '';
  const to    = sp.get('to')   || '';

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['orders', { page, limit, from, to, q }],
    queryFn:  () => fetchOrders({ page, limit, from, to, q }),
    keepPreviousData: true,
  });

  const onApply = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSp((s) => {
      s.set('page', '1'); // reinicia paginación
      s.set('limit', String(fd.get('limit') || 10));
      const setOrDel = (k) => {
        const v = String(fd.get(k) || '').trim();
        if (v) s.set(k, v); else s.delete(k);
      };
      setOrDel('q'); setOrDel('from'); setOrDel('to');
      return s;
    });
  };

  const { sort, toggle } = useSortParamLocal();
  const icon = (k) => (sort === k ? " \u2191" : (sort === ("-" + k) ? " \u2193" : ""));
  const { data: ordersData } = useQuery({
    queryKey: ["orders.search", { sort }],
    queryFn: () => fetchOrdersSearch({ page: 1, limit: 20, sort }),
    keepPreviousData: true,
  });
  const items = ordersData?.items ?? [];
  return (
    <div style={{fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',padding:16,maxWidth:1200,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <h2 style={{margin:0}}>Pedidos</h2>
        <button onClick={()=>refetch()} disabled={isFetching}>{isFetching ? 'Actualizando…' : 'Actualizar'}</button>
      </header>

      <form onSubmit={onApply} style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:8,alignItems:'end'}}>
        <label>Buscar
          <input name="q" defaultValue={q} placeholder="Cliente o ID" />
        </label>
        <label>Desde
          <input name="from" defaultValue={from} placeholder="YYYY-MM" />
        </label>
        <label>Hasta
          <input name="to" defaultValue={to} placeholder="YYYY-MM" />
        </label>
        <label>Por página
          <input name="limit" type="number" min="5" step="5" defaultValue={limit} />
        </label>
        <div>
          <button type="submit">Aplicar</button>
        </div>
      </form>

      {isLoading && <div style={{marginTop:12}}>Cargando…</div>}
      {isError   && <div style={{marginTop:12,color:'crimson'}}>Error: {String(error?.message||'')}</div>}

      {data && (
        <>
          <table style={{width:'100%',marginTop:12,borderCollapse:'collapse'}}>
            <thead>
              <tr style={{textAlign:'left',borderBottom:'1px solid #e5e7eb'}}>
                <th>ID</th><th><button type="button" className="underline" onClick={() => toggle("date")}><button type="button" className="underline" onClick={() => toggle("date")}>Fecha{icon("date")}</button></button></th><th><button type="button" className="underline" onClick={() => toggle("client")}><button type="button" className="underline" onClick={() => toggle("client")}>Cliente{icon("client")}</button></button></th><th><button type="button" className="underline" onClick={() => toggle("total")}><button type="button" className="underline" onClick={() => toggle("total")}>Total{icon("total")}</button></button></th><th></th>
              </tr>
            </thead>
            <tbody>
              {(data.items||[]).map(row => {
                const d = row.date ? new Date(row.date).toLocaleDateString('es-AR') : '';
                return (
                  <tr key={row.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td>{row.id}</td>
                    <td>{d}</td>
                    <td>{row.client || '(s/d)'}</td>
                    <td>{fmtCurrency(row.total || 0)}</td>
                    <td><Link to={`/orders/${row.id}`}>Ver</Link></td>
                  </tr>
                );
              })}
              {(!data.items || data.items.length === 0) && (
                <tr><td colSpan={5} style={{color:'#6b7280',padding:8}}>(Sin resultados)</td></tr>
              )}
            </tbody>
          </table>

          <div style={{display:'flex',justifyContent:'space-between',marginTop:12}}>
            <div>Total: {data.total ?? 0}</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button
                disabled={page <= 1}
                onClick={()=>setSp(s => { s.set('page', String(Math.max(1, page - 1))); return s; })}
              >← Anterior</button>
              <span>Página {page}</span>
              <button
                disabled={(data.items||[]).length < limit}
                onClick={()=>setSp(s => { s.set('page', String(page + 1)); return s; })}
              >Siguiente →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
