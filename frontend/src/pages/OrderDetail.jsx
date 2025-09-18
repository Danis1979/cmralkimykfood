import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchOrderById } from '../services/orders.service';
import { fmtCurrency } from '../lib/format';

export default function OrderDetail() {
  const { id } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrderById(id),
  });

  if (isLoading) return <div style={{padding:16}}>Cargando pedido…</div>;
  if (isError)   return <div style={{padding:16,color:'crimson'}}>No se pudo cargar el pedido. {String(error?.message||'')}</div>;
  if (!data)     return <div style={{padding:16,color:'#6b7280'}}>Detalle no disponible.</div>;

  const raw = data._raw || data;
  return (
    <div style={{ fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding:16, maxWidth:900, margin:'0 auto' }}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h2 style={{margin:0}}>Pedido #{data.id}</h2>
        <Link to="/orders" style={{textDecoration:'none'}}>← Volver</Link>
      </header>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3, minmax(0,1fr))',gap:12}}>
        <Card label="Fecha" value={new Date(raw.date || raw.created_at || raw.fecha).toLocaleDateString('es-AR')} />
        <Card label="Cliente" value={raw.client || raw.cliente || '(s/d)'} />
        <Card label="Total" value={fmtCurrency(raw.total || 0)} />
      </div>

      <details style={{marginTop:16}}>
        <summary style={{cursor:'pointer'}}>Debug crudo</summary>
        <pre style={{marginTop:8, background:'#f9fafb', padding:12, borderRadius:8, overflow:'auto'}}>
{JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Card({label, value}) {
  return (
    <div style={{border:'1px solid #e5e7eb',borderRadius:8,padding:12}}>
      <div style={{fontSize:12,color:'#6b7280'}}>{label}</div>
      <div style={{fontSize:18,fontWeight:600}}>{value}</div>
    </div>
  );
}
