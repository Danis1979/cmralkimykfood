# API v1 — Contratos (Resumen)
> Autenticación: Firebase ID Token (`Authorization: Bearer <token>`).  
> Idempotencia: `Idempotency-Key` en POST/PUT críticos.  
> Tiempos: UTC ISO8601. Moneda: ARS.

## Pedidos (Orders)
- POST /orders — crear (BORRADOR)
- POST /orders/:id/confirm — CONFIRMADO (crea reservas)
- POST /orders/:id/cancel — cancela y libera reservas
- GET /orders …

## Ventas / Entregas
- POST /sales/issue — emitir venta/factura (no mueve stock)
- POST /deliveries/confirm — descuenta PT (OUT) y libera reservas consumidas
- POST /sales/:id/returns — IN PT (devolución)

## AR / AP
- GET /receivables … · POST /receivables/:id/payments
- GET /payables …    · POST /payables/:id/payments

## Compras
- POST /purchases — IN Insumos y AP/ledger según forma de pago

## Cheques
- POST /cheques/:id/deposit · /accredit · /sell
- POST /cheques/:id/deliver · /debit · /reject

## Inventario
- GET /inventory/stock — onHand, reservado, disponible
- GET /inventory/moves — kárdex
- POST /inventory/adjustments — IN/OUT motivo ajuste

## Producción
- POST /production/orders — PLANIFICADA
- POST /production/orders/:id/start — EN_PROCESO
- POST /production/orders/:id/close — CERRADA (OUT insumos + IN PT)

## Ledger & KPIs
- GET /ledger/balances?fecha=ISO
- GET /reports/kpis
