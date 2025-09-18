import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchOrders } from '../services/orders.service.js';
import { fmtCurrency, fmtNumber } from '../lib/format.js';

function Input({ label, name, type='text', defaultValue='' }) {
  return (
    <label style={{ display:'grid', gap:4, fontSize:12 }}>
      <span style={{ color:'#6b7280' }}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:6 }}
        placeholder={type==='month' ? 'YYYY-MM' : ''}
      />
    </label>
  );
}

function Select({ label, name, defaultValue }) {
  return (
    <label style={{ display:'grid', gap:4, fontSize:12 }}>
      <span style={{ color:'#6b7280' }}>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        style={{ padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:6 }}
      >
        {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}

export default function Orders() {
  const [sp, setSp] = useSearchParams();

  const params = useMemo(() => ({
    q: sp.get('q') || '',
    from: sp.get('from') || '',
    to: sp.get('to') || '',
    page: Number(sp.get('page') || 1),
    limit: Number(sp.get('limit') || 10),
  }), [sp]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['orders', params],
    queryFn: () => fetchOrders(params),
    keepPreviousData: true,
    staleTime: 20_000,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / (params.limit || 10)));

  const apply = (next) => {
    const merged = new URLSearchParams(sp);
    Object.entries(next).forEach(([k, v]) => {
      if (v === '' || v == null) merged.delete(k);
      else merged.set(k, String(v));
    });
    // Si cambian filtros, reseteamos page a 1
    if ('q' in next || 'from' in next || 'to' in next || 'limit' in next) merged.set('page', '1');
    setSp(merged, { replace: true });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    apply({
      q: (f.get('q') || '').toString().trim(),
      from: (f.get('from') || '').toString().trim(),
      to: (f.get('to') || '').toString().trim(),
      limit: Number(f.get('limit') || 10),
    });
  };

  const gotoPage = (p) => {
    if (p < 1 || p > pages) return;
    apply({ page: p });
  };

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Pedidos</h1>
        <small style={{ color:'#6b7280' }}>
          {isFetching ? 'actualizando…' : (isLoading ? 'cargando…' : `${fmtNumber(total)} resultados`)}
        </small>
      </header>

      <form onSubmit={onSubmit} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 100px', gap:8, alignItems:'end', marginBottom:12 }}>
        <Input  label="Buscar"     name="q"     defaultValue={params.q} />
        <Input  label="Desde"      name="from"  type="month" defaultValue={params.from} />
        <Input  label="Hasta"      name="to"    type="month" defaultValue={params.to} />
        <Select label="Por página" name="limit" defaultValue={params.limit} />
        <button type="submit" style={{ height:36, border:'1px solid #e5e7eb', borderRadius:6, background:'#111827', color:'white' }}>Aplicar</button>
      </form>

      {isError && (
        <div style={{ color:'crimson', marginBottom:8 }}>
          Error cargando pedidos: {String(error?.message || 'desconocido')}
        </div>
      )}

      <div style={{ overflowX:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ background:'#f3f4f6', textAlign:'left' }}>
            <tr>
              <th style={{ padding:8, borderBottom:'1px solid #e5e7eb' }}>ID</th>
              <th style={{ padding:8, borderBottom:'1px solid #e5e7eb' }}>Fecha</th>
              <th style={{ padding:8, borderBottom:'1px solid #e5e7eb' }}>Cliente</th>
              <th style={{ padding:8, borderBottom:'1px solid #e5e7eb' }}>Total</th>
              <th style={{ padding:8, borderBottom:'1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ padding:12, color:'#6b7280' }}>(Sin resultados)</td></tr>
            )}
            {items.map((o) => {
              const d = o.date ? new Date(o.date) : null;
              const fecha = d ? d.toLocaleDateString('es-AR') : '—';
              return (
                <tr key={o.id}>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{o.id}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{fecha}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{o.client || '—'}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>{fmtCurrency(o.total || 0)}</td>
                  <td style={{ padding:8, borderBottom:'1px solid #f3f4f6' }}>
                    <Link to={`/orders/${o.id}`} style={{ color:'#2563eb' }}>Ver</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'flex-end', marginTop:12 }}>
        <button onClick={() => gotoPage(params.page - 1)} disabled={params.page <= 1}
          style={{ border:'1px solid #e5e7eb', background:'white', borderRadius:6, padding:'6px 8px' }}>
          ◀ Anterior
        </button>
        <span style={{ fontSize:12, color:'#6b7280' }}>
          Página {params.page} de {pages} ({fmtNumber(total)} resultados)
        </span>
        <button onClick={() => gotoPage(params.page + 1)} disabled={params.page >= pages}
          style={{ border:'1px solid #e5e7eb', background:'white', borderRadius:6, padding:'6px 8px' }}>
          Siguiente ▶
        </button>
      </div>
    </div>
  );
}
