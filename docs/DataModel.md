# Modelo de Datos (síntesis)
Claves primarias UUID, timestamps (`created_at`, `updated_at`).

- products(id, sku, nombre, tipo, uom, costo_std, precio_lista, activo)
- clients(id, nombre, cuit, direccion, condiciones_pago, lista_precio)
- suppliers(id, nombre, cuit, direccion)
- orders(id, client_id, fecha, estado) · order_items(order_id, product_id, qty, price)
- sales(id, order_id?, client_id, fecha, estado, subtotal, iva, total, pm, afip_tipo, cae, cae_vto) · sale_items
- receivables(id, sale_id, client_id, vence, saldo, estado)
- purchases(id, supplier_id, fecha, estado, total, pm) · purchase_items
- payables(id, purchase_id, supplier_id, vence, saldo, estado)
- cheques(id, tipo rec/emi, banco, numero, emision, pago, importe, estado, ref_tipo, ref_id)
- inventory_moves(id, fecha, product_id, qty, direction IN/OUT, motivo, ref_tipo, ref_id, on_hand_after, location_from?, location_to?)
- stock_reservations(id, order_id, product_id, qty, vence_at, estado)
- production_orders(id, fecha, estado) · po_inputs · po_outputs
- ledger(id, fecha, cuenta, tipo DEBE/HABER, importe, ref_tipo, ref_id, descripcion)
- recipes(product_id, componente_id, qty_por_unidad)
- snapshots (mensuales): stock_snapshot, ledger_balances_snapshot, ar_snapshot, ap_snapshot
