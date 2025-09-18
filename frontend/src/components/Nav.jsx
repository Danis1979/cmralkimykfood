import { NavLink } from 'react-router-dom';

export default function Nav() {
  const sty = ({ isActive }) => ({
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: 8,
    fontWeight: 600,
    background: isActive ? '#111827' : 'transparent',
    color: isActive ? 'white' : '#111827',
  });
  return (
    <nav style={{display:'flex',gap:8,padding:12,borderBottom:'1px solid #e5e7eb',position:'sticky',top:0,background:'white',zIndex:10}}>
      <NavLink to="/dashboard" style={sty}>Dashboard</NavLink>
      <NavLink to="/orders"    style={sty}>Pedidos</NavLink>
      <NavLink to="/inventory" style={sty}>Inventario</NavLink>
      <NavLink to="/cxc"       style={sty}>CxC</NavLink>
    </nav>
  );
}
