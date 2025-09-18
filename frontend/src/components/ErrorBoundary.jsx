import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(err){ return { hasError: true, error: err }; }
  componentDidCatch(err, info){ console.error('ErrorBoundary:', err, info); }
  render(){
    if (this.state.hasError) {
      return (
        <div style={{fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',padding:24}}>
          <h2 style={{margin:0}}>Ocurrió un error en la UI</h2>
          <p style={{color:'#6b7280'}}>Probá recargar. Si persiste, avisame.</p>
          <pre style={{background:'#f9fafb',padding:12,borderRadius:8,overflow:'auto'}}>
            {String(this.state.error?.message || this.state.error || 'Error desconocido')}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
