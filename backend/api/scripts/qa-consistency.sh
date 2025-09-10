#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"
FROM="${FROM:-2025-09}"
TO="${TO:-2025-09}"
RANGE="from=${FROM}&to=${TO}"

say(){ echo -e "\n== $* =="; }
ok(){ echo "✔ $1"; }
ko(){ echo "✖ $1"; exit 1; }

fmt2(){ awk -v n="$1" 'BEGIN{printf "%.2f", n+0}'; }

get_json(){ curl -ksS --tlsv1.2 -H "x-api-key: $KEY" "$1"; }
get_csv(){  curl -ksS --tlsv1.2 -H "x-api-key: $KEY" "$1"; }

# --- 1) Sales vs Purchases (JSON vs CSV) ---
say "Consistencia: sales-vs-purchases (JSON vs CSV)"
JSON_SVP=$(get_json "$BASE/reports/sales-vs-purchases?$RANGE")
CSV_SVP=$( get_csv  "$BASE/reports/sales-vs-purchases.csv?$RANGE")

J_SALES=$(echo "$JSON_SVP" | jq -r '.totals.sales')
J_PURCH=$(echo "$JSON_SVP" | jq -r '.totals.purchases')
J_NET=$(  echo "$JSON_SVP" | jq -r '.totals.net')

ROW_SVP=$(echo "$CSV_SVP" | awk 'NR==2{print; exit}')
IFS=',' read -r _MONTH C_SALES C_PURCH C_NET <<<"$ROW_SVP"

[[ "$(fmt2 "$J_SALES")" == "$(fmt2 "$C_SALES")" ]] && ok "sales iguales ($(fmt2 "$J_SALES"))" || ko "sales difieren ($J_SALES vs $C_SALES)"
[[ "$(fmt2 "$J_PURCH")" == "$(fmt2 "$C_PURCH")" ]] && ok "purchases iguales ($(fmt2 "$J_PURCH"))" || ko "purchases difieren ($J_PURCH vs $C_PURCH)"
[[ "$(fmt2 "$J_NET")"   == "$(fmt2 "$C_NET")"   ]] && ok "net iguales ($(fmt2 "$J_NET"))"         || ko "net difieren ($J_NET vs $C_NET)"

# --- 2) Margin by product (sum CSV vs JSON.totals) ---
say "Consistencia: margin-by-product (sum CSV vs JSON.totals)"
JSON_MB=$(get_json "$BASE/reports/margin-by-product?$RANGE")
CSV_MB=$( get_csv  "$BASE/reports/margin-by-product.csv?$RANGE")

JT_QTY=$(echo "$JSON_MB" | jq -r '.totals.qty')
JT_REV=$(echo "$JSON_MB" | jq -r '.totals.revenue')
JT_COST=$(echo "$JSON_MB" | jq -r '.totals.cost')
JT_MAR=$(echo "$JSON_MB" | jq -r '.totals.margin')

SUM_Q=0; SUM_R="0"; SUM_C="0"; SUM_M="0"
# CSV: Sku,Name,Qty,Revenue,Cost,Margin,MarginPct
while IFS=',' read -r _SKU _NAME Q R C M _MP; do
  [[ "$_SKU" == "Sku" ]] && continue
  [[ -z "${Q:-}" ]] && continue
  SUM_Q=$(( SUM_Q + ${Q%.*} ))
  SUM_R=$(awk -v a="$SUM_R" -v b="$R" 'BEGIN{printf "%.2f", a+b}')
  SUM_C=$(awk -v a="$SUM_C" -v b="$C" 'BEGIN{printf "%.2f", a+b}')
  SUM_M=$(awk -v a="$SUM_M" -v b="$M" 'BEGIN{printf "%.2f", a+b}')
done < <(echo "$CSV_MB")

[[ "$JT_QTY" -eq "$SUM_Q" ]] && ok "qty iguales ($JT_QTY)" || ko "qty difiere ($JT_QTY vs $SUM_Q)"
[[ "$(fmt2 "$JT_REV")" == "$(fmt2 "$SUM_R")" ]] && ok "revenue iguales ($(fmt2 "$JT_REV"))" || ko "revenue difiere ($JT_REV vs $SUM_R)"
[[ "$(fmt2 "$JT_COST")" == "$(fmt2 "$SUM_C")" ]] && ok "cost iguales ($(fmt2 "$JT_COST"))"   || ko "cost difiere ($JT_COST vs $SUM_C)"
[[ "$(fmt2 "$JT_MAR")" == "$(fmt2 "$SUM_M")" ]] && ok "margin iguales ($(fmt2 "$JT_MAR"))"  || ko "margin difiere ($JT_MAR vs $SUM_M)"

# --- 3) Top clients (JSON.totals vs CSV fila) ---
say "Consistencia: top-clients (JSON.totals vs CSV fila única)"
JSON_TC=$(get_json "$BASE/reports/top-clients?$RANGE")
CSV_TC=$( get_csv  "$BASE/reports/top-clients.csv?$RANGE")

J_REV=$(echo "$JSON_TC" | jq -r '.totals.revenue')
J_CNT=$(echo "$JSON_TC" | jq -r '.totals.salesCount')
J_AVG=$(echo "$JSON_TC" | jq -r '.totals.avgTicket')

ROW_TC=$(echo "$CSV_TC" | awk 'NR==2{print; exit}')
# Campos: ClientId,Client,Email,Revenue,SalesCount,AvgTicket
IFS=',' read -r _ID _CL _EM C_REV C_CNT C_AVG <<<"$ROW_TC"

[[ "$(fmt2 "$J_REV")" == "$(fmt2 "$C_REV")" ]] && ok "revenue iguales ($(fmt2 "$J_REV"))" || ko "revenue difiere ($J_REV vs $C_REV)"
[[ "$J_CNT" == "$C_CNT" ]] && ok "salesCount iguales ($J_CNT)" || ko "salesCount difiere ($J_CNT vs $C_CNT)"
[[ "$(fmt2 "$J_AVG")" == "$(fmt2 "$C_AVG")" ]] && ok "avgTicket iguales ($(fmt2 "$J_AVG"))" || ko "avgTicket difiere ($J_AVG vs $C_AVG)"

echo -e "\n✅ Consistencia JSON/CSV OK"
