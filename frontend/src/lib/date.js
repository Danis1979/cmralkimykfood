export function yyyymm(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function lastMonthYYYYMM() {
  const d = new Date();
  // mover a primer día del mes actual en UTC
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  // retroceder un mes
  utc.setUTCMonth(utc.getUTCMonth() - 1);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Calcula los params from/to para el backend según modo.
 * - "year": backend ya usa año en curso por defecto → sin params
 * - "last-month": from=YYYY-MM (mes pasado), to=YYYY-MM (mes actual)
 */
export function kpiParamsFor(mode) {
  if (mode === 'last-month') {
    const from = lastMonthYYYYMM();
    const to = yyyymm(new Date()); // mes actual (end exclusivo)
    return { from, to };
  }
  // "year" → sin params (usa default del backend)
  return {};
}
