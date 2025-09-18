export const fmtCurrency = (n) =>
  new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(n||0));
export const fmtNumber = (n) =>
  new Intl.NumberFormat('es-AR').format(Number(n||0));
