---
name: erp-tesoreria
description: Gestión de cajas, conciliación bancaria y precisión financiera. Usar al modificar módulo de Tesorería/Finanzas.
---

# ERP Tesorería

Garantiza que cada centavo sea rastreado y conciliado correctamente.

## Reglas Financieras
1. **Limpieza de Montos**: Siempre usar `limpiarMonto()` antes de operar
2. **Acreditación Atómica**: Solo vía RPC `fn_acreditar_saldo_cliente_v2`
3. **Sesión de Caja**: Todo movimiento vinculado a `cajas_diarias` abierta
4. **Arqueos**: Usar billetes argentinos (100, 200, 500, 1000, 2000, 10000, 20000)

## Tablas Clave
- `tesoreria_cajas`: Cajas físicas
- `movimientos_caja`: Transacciones diarias
- `cuentas_corrientes`: Saldos de clientes
- `conciliacion_bancaria_items`: Matching banco vs sistema

## Conciliación IA
- Parser robusto para locales regionales (puntos/comas)
- Gemini 3.0 Pro para matching difuso
- Estados: pendiente → matched → acreditado

## Validaciones
- No actualizar saldo manualmente (usar RPC)
- Mantener audit log de ajustes
