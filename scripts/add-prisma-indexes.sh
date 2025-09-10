#!/usr/bin/env bash
set -euo pipefail

# Detectar ruta del schema
ROOT="backend/api"
[[ -f "$ROOT/prisma/schema.prisma" ]] && SCHEMA="$ROOT/prisma/schema.prisma" || SCHEMA="prisma/schema.prisma"
[[ -f "$SCHEMA" ]] || { echo "❌ No encuentro $SCHEMA"; exit 1; }

backup="$SCHEMA.bak.$(date +%Y%m%d%H%M%S)"
cp "$SCHEMA" "$backup"
echo "🗂  Backup: $backup"

# Helpers
model_block(){ # model_block <ModelName>
  awk -v M="$1" '
    $0 ~ "^model[[:space:]]+" M "[[:space:]]*\\{" {on=1}
    on {print}
    on && $0 ~ /^}/ {exit}
  ' "$SCHEMA"
}

has_model(){ grep -qE "^model[[:space:]]+$1[[:space:]]*{" "$SCHEMA"; }

has_field(){ # has_field <Model> <fieldName>
  model_block "$1" | grep -qE "^[[:space:]]*$2[[:space:]]+"
}

has_index_line(){ # has_index_line <Model> <literal line>
  model_block "$1" | grep -Fq "$2"
}

add_index(){ # add_index <Model> "<@@index(...)|@@unique(...)|@@id(...)>"
  local m="$1" idx="$2"
  has_model "$m" || { echo "↷  (skip) model $m no existe"; return; }
  has_index_line "$m" "$idx" && { echo "•  $m ya tiene: $idx"; return; }

  MODEL="$m" IDX="$idx" perl -0777 -i -pe '
    BEGIN { $m=$ENV{MODEL}; $i=$ENV{IDX}; }
    s/(model\s+\Q$m\E\s*\{)([\s\S]*?)(\n\})/$1$2\n  $i$3/s;
  ' "$SCHEMA"
  echo "＋ $m :: $idx"
}

# Elige timestamp disponible (createdAt o date)
ts_field(){ # ts_field <Model>
  has_field "$1" createdAt && { echo createdAt; return; }
  has_field "$1" date && { echo date; return; }
  echo ""
}

# ===== Índices por modelo =====

# InventoryMove: muy consultado por producto, rango temporal y filtros
if has_model InventoryMove; then
  TS="$(ts_field InventoryMove)"
  has_field InventoryMove productId && add_index InventoryMove "@@index([productId])"
  [[ -n "$TS" ]] && add_index InventoryMove "@@index([$TS])"
  has_field InventoryMove reason    && add_index InventoryMove "@@index([reason])"
  has_field InventoryMove direction && add_index InventoryMove "@@index([direction])"
  if [[ -n "$TS" ]] && has_field InventoryMove productId; then
    add_index InventoryMove "@@index([productId, $TS])"
  fi
  if [[ -n "$TS" ]] && has_field InventoryMove direction; then
    add_index InventoryMove "@@index([direction, $TS])"
  fi
fi

# Sale / SaleItem para KPIs, margen por producto, top clientes
if has_model Sale; then
  TS="$(ts_field Sale)"
  [[ -n "$TS" ]] && add_index Sale "@@index([$TS])"
  has_field Sale clientId && add_index Sale "@@index([clientId])"
  if [[ -n "$TS" ]] && has_field Sale clientId; then
    add_index Sale "@@index([clientId, $TS])"
  fi
fi

if has_model SaleItem; then
  has_field SaleItem saleId    && add_index SaleItem "@@index([saleId])"
  has_field SaleItem productId && add_index SaleItem "@@index([productId])"
  if has_field SaleItem productId && has_field SaleItem saleId; then
    add_index SaleItem "@@index([productId, saleId])"
  fi
fi

# Receivable (aging, pendientes)
if has_model Receivable; then
  TS="$(ts_field Receivable)"
  has_field Receivable status    && add_index Receivable "@@index([status])"
  has_field Receivable clientId  && add_index Receivable "@@index([clientId])"
  has_field Receivable dueDate   && add_index Receivable "@@index([dueDate])"
  [[ -n "$TS" ]] && add_index Receivable "@@index([$TS])"
  if has_field Receivable clientId && has_field Receivable status; then
    add_index Receivable "@@index([clientId, status])"
  fi
fi

# Cheque (búsquedas por tipo/vence/estado)
if has_model Cheque; then
  has_field Cheque type    && add_index Cheque "@@index([type])"
  has_field Cheque status  && add_index Cheque "@@index([status])"
  has_field Cheque dueDate && add_index Cheque "@@index([dueDate])"
  if has_field Cheque type && has_field Cheque dueDate; then
    add_index Cheque "@@index([type, dueDate])"
  fi
fi

# LedgerEntry (balances, movimientos)
if has_model LedgerEntry; then
  TS="$(ts_field LedgerEntry)"
  has_field LedgerEntry account && add_index LedgerEntry "@@index([account])"
  [[ -n "$TS" ]] && add_index LedgerEntry "@@index([$TS])"
fi

# Purchase / PurchaseItem (reporte svp)
if has_model Purchase; then
  TS="$(ts_field Purchase)"
  [[ -n "$TS" ]] && add_index Purchase "@@index([$TS])"
  has_field Purchase supplierId && add_index Purchase "@@index([supplierId])"
  if [[ -n "$TS" ]] && has_field Purchase supplierId; then
    add_index Purchase "@@index([supplierId, $TS])"
  fi
fi

if has_model PurchaseItem; then
  has_field PurchaseItem purchaseId && add_index PurchaseItem "@@index([purchaseId])"
  has_field PurchaseItem productId  && add_index PurchaseItem "@@index([productId])"
  if has_field PurchaseItem productId && has_field PurchaseItem purchaseId; then
    add_index PurchaseItem "@@index([productId, purchaseId])"
  fi
fi

# Order / Delivery por si consultás estados/fechas
if has_model "Order"; then
  TS="$(ts_field Order)"
  has_field Order status   && add_index Order "@@index([status])"
  has_field Order clientId && add_index Order "@@index([clientId])"
  [[ -n "$TS" ]] && add_index Order "@@index([$TS])"
  if [[ -n "$TS" ]] && has_field Order clientId; then
    add_index Order "@@index([clientId, $TS])"
  fi
fi

if has_model Delivery; then
  TS="$(ts_field Delivery)"
  has_field Delivery status && add_index Delivery "@@index([status])"
  [[ -n "$TS" ]] && add_index Delivery "@@index([$TS])"
fi

echo "✅ Índices agregados si hacían falta."
echo "→ Ejecutá:  npx prisma format"
echo "→ Luego:    npx prisma migrate dev -n add_indexes   # (o: npx prisma db push)"
