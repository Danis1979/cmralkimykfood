#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"

say(){ echo -e "\n== $* =="; }
need(){ grep -Eq "$2" <<<"$1" || { echo "✖ Falta: $3"; exit 1; }; echo "✔ $3"; }

say "Descargando /dashboard.html"
HTML="$(curl -ksS --tlsv1.2 "$BASE/dashboard.html")" || { echo "No se pudo descargar dashboard.html"; exit 1; }

say "Scripts requeridos"
need "$HTML" 'src="/js/prefs\.api\.js"'           "prefs.api.js"
need "$HTML" 'src="/js/kpis\.widgets\.js"'        "kpis.widgets.js"
need "$HTML" 'src="/js/activity\.tables\.js"'     "activity.tables.js"
need "$HTML" 'src="/js/csv\.exports\.js"'         "csv.exports.js"
need "$HTML" 'src="/vendor/chart\.umd\.js"'       "chart.umd.js"

say "IDs de widgets/tablas"
need "$HTML" 'id="kpi_sales"'                     "#kpi_sales"
need "$HTML" 'id="tbl_productions"'               "#tbl_productions"
need "$HTML" 'id="tbl_receivables"'               "#tbl_receivables"

say "Rango global (desde/hasta + botón aplicar si existe)"
need "$HTML" 'id="global_from"'                   "#global_from"
need "$HTML" 'id="global_to"'                     "#global_to"
grep -q 'id="apply_range"' <<<"$HTML" && echo "✔ #apply_range (opcional presente)" || echo "ℹ #apply_range no encontrado (opcional)"

say "Botones CSV esperados"
for id in csv_top_clients csv_margin_by_product csv_svp csv_inventory_value csv_productions csv_inventory_moves csv_orders; do
  grep -q "id=\"$id\"" <<<"$HTML" && echo "✔ #$id" || { echo "✖ Falta botón #$id"; exit 1; }
done

echo -e "\n✅ QA DOM dashboard OK"
