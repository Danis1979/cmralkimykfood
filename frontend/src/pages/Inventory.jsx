import CsvMeta from '../components/CsvMeta';
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const href = `${apiBase}/reports/stock.csv`;

export default function Inventory() {
  const openNewTab = () => window.open(href, '_blank', 'noopener,noreferrer');

  return (
    <div style={{ fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding:16, maxWidth:900, margin:'0 auto' }}>
      <h2 style={{marginTop:0}}>Inventario</h2>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <a href={href} download style={{textDecoration:'none'}}>
          <button>⬇ Descargar stock.csv</button>
        </a>
        <button onClick={openNewTab}>Abrir en pestaña</button>
      </div>
      <p style={{marginTop:12,color:'#6b7280'}}>Exporta el stock actual en CSV para análisis rápido.</p>
    </div>
  );
}
