import { useQuery } from '@tanstack/react-query';
import { http } from '../lib/http';
import { fmtCurrency } from '../lib/format';

export default function Cxc() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['kpis-cxc'],
    queryFn: async ()=> (await http.get('/reports/kpis')).data,
  });

  return (
    <div style={{ fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding:16, maxWidth:900, margin:'0 auto' }}>
      <h2 style={{marginTop:0}}>CxC</h2>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button onClick={()=>refetch()} disabled={isFetching}>
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {isLoading && <div style={{marginTop:12}}>Cargando…</div>}
      {isError   && <div style={{marginTop:12,color:'crimson'}}>Error: {String(error?.message||'')}</div>}

      {!isLoading && !isError && (
        <div style={{marginTop:12, border:'1px solid #e5e7eb', borderRadius:8, padding:12}}>
          <div style={{fontSize:12,color:'#6b7280'}}>Pendiente</div>
          <div style={{fontSize:22,fontWeight:600}}>{fmtCurrency(data?.receivablesPending || 0)}</div>
        </div>
      )}
    </div>
  );
}
