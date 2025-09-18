import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Inventory from './pages/Inventory.jsx';
import Receivables from './pages/Receivables.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', minHeight:'100dvh', background:'#fff'}}>
        <NavBar />
        <main style={{maxWidth:1200, margin:'0 auto', padding:16}}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />

            <Route path="/inventory" element={<Inventory />} />
            <Route path="/cxc" element={<Receivables />} />

            <Route path="*" element={<div style={{padding:16}}>Página no encontrada.</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
