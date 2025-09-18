import { useState, useEffect } from 'react';

export default function RangeControls({ initialFrom = '', initialTo = '', onChange }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo]     = useState(initialTo);

  useEffect(() => { if (onChange) onChange({ from, to }); /* dispara 1a vez */ // eslint-disable-next-line
  }, []);

  const submit = (e) => {
    e.preventDefault();
    onChange?.({ from, to });
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Desde (YYYY-MM)</span>
        <input type="month" value={from} onChange={e => setFrom(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Hasta (YYYY-MM)</span>
        <input type="month" value={to} onChange={e => setTo(e.target.value)} />
      </label>
      <button type="submit" style={{
        padding: '8px 12px', borderRadius: 8, border: '1px solid #111827',
        background: '#111827', color: '#fff', cursor: 'pointer'
      }}>
        Aplicar
      </button>
      <button type="button" onClick={() => { setFrom(''); setTo(''); onChange?.({ from: '', to: '' }); }}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}>
        Año en curso
      </button>
    </form>
  );
}
