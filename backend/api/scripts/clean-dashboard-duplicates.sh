#!/usr/bin/env bash
set -euo pipefail

HTML="public/dashboard.html"
[[ -f "$HTML" ]] || { echo "No existe $HTML"; exit 1; }

cp -a "$HTML" "$HTML.bak.$(date +%Y%m%d%H%M%S)"

# 1) Eliminar scripts duplicados de fetch.apikey y prefs.api dejando el primero
awk '
  /<script src="\/js\/fetch\.apikey\.js">/ { if (seen1++) next }
  /<script src="\/js\/prefs\.api\.js">/    { if (seen2++) next }
  { print }
' "$HTML" > "$HTML.tmp1"

# 2) Eliminar el segundo bloque que redefine window.base() (si está duplicado)
awk '
  BEGIN{copy=1}
  /<script>/ && $0 ~ /if \(window\.base\) return/ {
    if (seenBase++) { skip=1 } else { skip=0 }
  }
  /<\/script>/ { if (skip) { print ""; next } }
  { if (!skip) print }
' "$HTML.tmp1" > "$HTML.tmp2"

# 3) Eliminar la toolbar duplicada (#toolbar), conservar la sticky #filters_toolbar
awk '
  BEGIN{del=0}
  /<div id="toolbar"/ { del=1 }
  del && /<\/div>/    { del=0; next }
  del { next }
  { print }
' "$HTML.tmp2" > "$HTML.tmp3"

# 4) Mantener un solo bloque de "Ventas vs Compras & Margen"
#    (si tenés dos, quitamos el que contiene id="tbl_svp" para evitar IDs duplicadas de tbl_margin)
awk '
  BEGIN{drop=0}
/<section class="card" style="margin:16px;">/ { insec=1; buf=$0; next }
insec{
  buf=buf ORS $0
  if ($0 ~ /id="tbl_svp"/) drop=1
  if ($0 ~ /<\/section>/){
    if (!drop) print buf
    insec=0; drop=0; buf=""
  }
  next
}
{ print }
' "$HTML.tmp3" > "$HTML.tmp4"

mv "$HTML.tmp4" "$HTML"
rm -f "$HTML.tmp1" "$HTML.tmp2" "$HTML.tmp3"

echo "✅ Limpieza aplicada. Backup en $(ls -1t $HTML.bak.* | head -n1)"
