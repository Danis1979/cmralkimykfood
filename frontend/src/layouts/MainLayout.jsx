// src/layouts/MainLayout.jsx
import { Link, NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/orders", label: "Ventas" },
  { to: "/inventory", label: "Inventario" },
  { to: "/ops", label: "Producción" },
  { to: "/reports", label: "Reportes" },
];

export default function MainLayout() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #eee", padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>
          <Link to="/">Alkimyk</Link>
        </div>
        <nav style={{ display: "grid", gap: 8 }}>
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: "8px 10px",
                borderRadius: 8,
                textDecoration: "none",
                color: isActive ? "#111827" : "#374151",
                background: isActive ? "#e5e7eb" : "transparent",
              })}
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main style={{ padding: 20 }}>
        <Outlet />
      </main>
    </div>
  );
}