export default function StatCard({ label, value, hint, loading }) {
  return (
    <div style={{
      border:'1px solid #e5e7eb', borderRadius:8, padding:12,
      display:'flex', flexDirection:'column', gap:4, minWidth:160
    }}>
      <div style={{fontSize:12, color:'#6b7280'}}>{label}</div>
      <div style={{fontSize:22, fontWeight:600}}>
        {loading ? '…' : value}
      </div>
      {hint ? <div style={{fontSize:12, color:'#9ca3af'}}>{hint}</div> : null}
    </div>
  );
}
