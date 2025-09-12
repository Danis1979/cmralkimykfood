export type OrderPair = [string, 'asc'|'desc'];
export function parseOrder(input: string|undefined, allowed: string[], fallback: OrderPair[]): OrderPair[] {
  if (!input) return fallback;
  const out: OrderPair[] = [];
  for (const tok of input.split(',').map(s=>s.trim()).filter(Boolean)) {
    const [f, dRaw] = tok.split(':').map(s=>s.trim());
    if (!f || !allowed.includes(f)) continue;
    const d = (dRaw?.toLowerCase()==='asc' ? 'asc' : 'desc') as 'asc'|'desc';
    out.push([f, d]);
  }
  return out.length ? out : fallback;
}
