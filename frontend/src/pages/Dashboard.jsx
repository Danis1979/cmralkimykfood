import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { http } from '../lib/http.js';
import { fmtCurrency } from '../lib/format.js';

// ---------- helpers de fechas ----------
const ym = (d) => d.toISOString().slice(0,7);
const monthStartUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonthsUTC = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
const parseYYYYMM = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mm = Number(m[2]);
  if (mm < 1 || mm > 12) return null;
  return new Date(Date.UTC(y, mm - 1, 1));
};

// ---------- MiniBars (barras compactas, altura fija) ----------
function MiniBars({ series, height = 120 }) {
  const safe = Array.isArray(series) ? series : [];
  const max = Math.max(0, ...safe.map(s => Number(s.net || 0)));
  const barHeight = (v) => {
    if (max <= 0) return 6;
    // 16px de margen superior para labels; 8px de resguardo abajo
    const usable = Math.max(24, height - 16);
    return Math.max(6, Math.round((Number(v||0) / max) * usable));
  };

  return (
    <div style={{
      height,
      display: 'grid',
      gridAutoFlow: 'column',
      gridAutoColumns: 'minmax(0,1fr)',
      alignItems: 'end',
      gap: 10,
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 12,
      background: '#fff'
    }}>
      {safe.length === 0 ? (
        <div style={{color:'#6b7280', alignSelf:'center'}}>Sin datos para graficar</div>
      ) : safe.map((it) => (
        <div key={it.month} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
          <div
            title={`${it.month}: ${fmtCurrency(it.net||0)}`}
            style={{
              height: barHeight(it.net),
              width: 14,
              borderRadius: 4,
              background: '#4f46e5'
            }}
          />
          <div style={{fontSize:10, color:'#6b7280'}}>{String(it.month).slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- UI de período ----------
function PeriodBar({ value, onChange, onRefresh }) {
  const [mode, setMode] = useState(value?.mode || '6m');
  const [from, setFrom] = useState(value?.from || '');
  const [to, setTo] = useState(value?.to || '');

  useEffect(() => {
    onChange?.({ mode, from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div style={{
      display:'flex', flexWrap:'wrap', gap:8, alignItems:'center',
      background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:10
    }}>
      <span style={{fontSize:12,color:'#6b7280'}}>Período:</span>
      <div style={{
        display:'inline-flex', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden'
      }}>
        {[
          {id:'6m', label:'Últ. 6 meses'},
          {id:'ytd', label:'Año en curso'},
          {id:'1y', label:'Últ. 12 meses'},
          {id:'custom', label:'Personalizado'}
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            style={{
              padding:'6px 10px',
              fontSize:12,
              background: mode === opt.id ? '#111827' : '#fff',
              color: mode === opt.id ? '#fff' : '#111827',
              border:'none',
              borderRight:'1px solid #e5e7eb',
              cursor:'pointer'
            }}
          >{opt.label}</button>
        ))}
      </div>

      {mode === 'custom' && (
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:12,color:'#374151'}}>Desde
            <input type="month" value={from} onChange={e=>setFrom(e.target.value)}
              style={{marginLeft:6, padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8}}/>
          </label>
          <label style={{fontSize:12,color:'#374151'}}>Hasta
            <input type="month" value={to} onChange={e=>setTo(e.target.value)}
              style={{marginLeft:6, padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8}}/>
          </label>
          <button
            onClick={()=>onChange?.({ mode, from, to })}
            style={{padding:'6px 10px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', cursor:'pointer'}}
          >Aplicar</button>
        </div>
      )}

      <div style={{flex:1}} />
      <button
        onClick={onRefresh}
        style={{padding:'6px 10px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', cursor:'pointer'}}
        title="Forzar actualización"
      >Actualizar</button>
    </div>
  );
}

// ---------- Dashboard ----------
export default function Dashboard() {
  const [sp, setSp] = useSearchParams();
  const qsFrom = sp.get('from') || '';
  const qsTo   = sp.get('to')   || '';
  const qsMode = sp.get('mode') || (qsFrom || qsTo ? 'custom' : '6m');

  const [period, setPeriod] = useState({ mode: qsMode, from: qsFrom, to: qsTo });
  const [lastUpdated, setLastUpdated] = useState(null);

  // sincronizar URL al cambiar período
  useEffect(() => {
    const n = new URLSearchParams();
    if (period.mode) n.set('mode', period.mode);
    if (period.from) n.set('from', period.from);
    if (period.to)   n.set('to',   period.to);
    setSp(n, { replace:true });
    localStorage.setItem('dash.period', JSON.stringify(period));
  }, [period, setSp]);

  // resolver rango real (from/to) según preset
  const range = useMemo(() => {
    const base = monthStartUTC(new Date());
    if (period.mode === '6m') {
      return { from: ym(addMonthsUTC(base,-5)), to: ym(base) };
    }
    if (period.mode === 'ytd') {
      const jan = new Date(Date.UTC(base.getUTCFullYear(), 0, 1));
      return { from: ym(jan), to: ym(base) };
    }
    if (period.mode === '1y') {
      return { from: ym(addMonthsUTC(base,-11)), to: ym(base) };
    }
    // custom
    return { from: period.from || '', to: period.to || '' };
  }, [period]);

  const qp = useMemo(() => {
    const p = {};
    if (range.from) p.from = range.from;
    if (range.to)   p.to   = range.to;
    return p;
  }, [range]);

  // KPIs (totales + top cliente)
  const kpisQuery = useQuery({
    queryKey: ['kpis', qp.from||null, qp.to||null],
    queryFn: async () => {
      const { data } = await http.get('/reports/kpis', { params: qp });
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Series mensuales para barras
  const monthlyQuery = useQuery({
    queryKey: ['sales.monthly', qp.from||null, qp.to||null],
    queryFn: async () => {
      const { data } = await http.get('/reports/sales.monthly', { params: qp });
      return data?.series || [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!kpisQuery.isFetching && !monthlyQuery.isFetching) {
      setLastUpdated(new Date().toLocaleString('es-AR'));
    }
  }, [kpisQuery.isFetching, monthlyQuery.isFetching]);

  const totals = kpisQuery.data?.totals || {};
  const top    = kpisQuery.data?.topClient || null;

  return (
    <div className="container" style={{ maxWidth:1100, margin:'0 auto', padding:16, fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <h1 style={{fontSize:20, fontWeight:700, marginBottom:12}}>Dashboard</h1>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <PeriodBar
          value={period}
          onChange={setPeriod}
          onRefresh={() => { kpisQuery.refetch(); monthlyQuery.refetch(); }}
        />
        <div style={{fontSize:12, color:'#6b7280', marginLeft:12}}>Actualizado: {lastUpdated ?? '—'}</div>
      </div>

      {/* Cards totales */}
      <section style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, marginBottom:12}}>
        <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff'}}>
          <div style={{fontSize:12, color:'#6b7280'}}>Ventas</div>
          <div style={{fontSize:22, fontWeight:700}}>{fmtCurrency(totals.sales||0)}</div>
        </div>
        <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff'}}>
          <div style={{fontSize:12, color:'#6b7280'}}>Compras</div>
          <div style={{fontSize:22, fontWeight:700}}>{fmtCurrency(totals.purchases||0)}</div>
        </div>
        <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff'}}>
          <div style={{fontSize:12, color:'#6b7280'}}>Neto</div>
          <div style={{fontSize:22, fontWeight:700}}>{fmtCurrency((totals.net ?? (Number(totals.sales||0)-Number(totals.purchases||0)))||0)}</div>
        </div>
      </section>

      {/* Top cliente */}
      <section style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:12, marginBottom:12}}>
        <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff'}}>
          <div style={{fontSize:12, color:'#6b7280'}}>Top cliente</div>
          {top ? (
            <div>
              <div style={{fontSize:16, fontWeight:600}}>{top.client}</div>
              <div style={{fontSize:14, color:'#374151', marginTop:4}}>Ingresos: {fmtCurrency(top.revenue||0)}</div>
              <div style={{fontSize:12, color:'#6b7280', marginTop:2}}>Ventas: {top.salesCount || 0} · Ticket prom.: {fmtCurrency(top.avgTicket||0)}</div>
            </div>
          ) : <div style={{color:'#6b7280'}}>—</div>}
        </div>

        {/* Serie mensual (barras compactas, altura fija) */}
        <div>
          <div style={{fontSize:12, color:'#6b7280', marginBottom:6}}>Ventas mensuales</div>
          <MiniBars series={monthlyQuery.data || []} height={120} />
        </div>
      </section>

      {/* Estados / errores */}
      {(kpisQuery.isError || monthlyQuery.isError) && (
        <div style={{marginTop:8, color:'crimson'}}>
          No se pudieron cargar algunos datos. {String(kpisQuery.error?.message || monthlyQuery.error?.message || '')}
        </div>
      )}
    </div>
  );
}
