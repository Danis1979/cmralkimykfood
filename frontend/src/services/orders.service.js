import { http } from '../lib/http';

// Lista/búsqueda con filtros: page, limit, from (YYYY-MM), to (YYYY-MM), q
export async function fetchOrders({ page = 1, limit = 10, from, to, q } = {}) {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('limit', String(limit));
  if (from) p.set('from', from);
  if (to)   p.set('to', to);
  if (q)    p.set('q', q);

  const { data } = await http.get(`/orders/search?${p.toString()}`);

  const items = (data?.items || []).map((x) => ({
    id: x.id ?? x.ID ?? x._raw?.id,
    date: x.date || x.created_at || x.fecha || x.issuedAt || x._raw?.date,
    client: x.client || x.cliente || x.customer || x._raw?.client,
    total: x.total ?? x._raw?.total ?? 0,
    _raw: x._raw || x,
  }));

  return { ...data, items };
}

export async function fetchOrderById(id) {
  const { data } = await http.get(`/orders/${id}`);
  if (!data) return null;
  const raw = data._raw || data;
  return {
    id: raw.id,
    date: raw.date || raw.created_at || raw.fecha || raw.issuedAt,
    client: raw.client || raw.cliente || raw.customer,
    total: raw.total || 0,
    _raw: raw,
  };
}
