#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://localhost:3000}"
KEY="${KEY:-supersecreta-123}"

say(){ echo -e "\n== $* =="; }

paths=(
  "/reports/top-clients.csv"
  "/reports/margin-by-product.csv"
  "/reports/sales-vs-purchases.csv"
  "/reports/inventory-value.csv"
  "/reports/productions.csv"
  "/reports/inventory-moves.csv"
  "/reports/orders.csv"
)

say "HEAD / Content-Disposition"
for p in "${paths[@]}"; do
  printf "%-32s " "$p"
  curl -ksSI --tlsv1.2 -H "x-api-key: $KEY" "$BASE$p" | \
    awk 'BEGIN{ct=cd=""} 
         tolower($0) ~ /^content-type:/ {ct=$0} 
         tolower($0) ~ /^content-disposition:/ {cd=$0}
         END{ if(ct!="")print ct; if(cd!="")print cd; }' | sed 's/\r$//'
done

say "Primeras filas (sanity)"
for p in "${paths[@]}"; do
  echo "-- $p"
  curl -ksS  --tlsv1.2 -H "x-api-key: $KEY" "$BASE$p" | head -n 2
done

echo -e "\n✅ CSV endpoints OK si ves Content-Type/Disposition y headers correctos"
