---
name: erp-ventas-chatbot
description: Gestión de preventa, presupuestos y Bot WhatsApp con Vertex AI. Usar al modificar módulo de Ventas/CRM/Bot.
---

# ERP Ventas y Chatbot

Optimiza captación y cierre de ventas.

## WhatsApp Bot
1. **Provider**: Respetar `WHATSAPP_PROVIDER=twilio` (no Meta)
2. **Bypass RLS**: Usar `createAdminClient()` con `fn_crear_presupuesto_desde_bot`
3. **Memory Bank**: Persistir en `bot_sessions.customer_context`
   - productos_frecuentes, preferencias, metadata

## Presupuestos → Pedidos
- **Bloqueo Pesaje**: "Pasar a Pedidos" deshabilitado si hay pesables sin peso
- **Listas de Precios**: Validar asignación correcta (ej. "MAYORISTA")
- **Conversión**: `fn_convertir_presupuesto_a_pedido` respeta `peso_final`

## Tablas Clave
- `presupuestos`: Cotizaciones activas
- `presupuesto_items`: Detalle con indicadores de stock
- `clientes`: CRM completo
- `listas_precios`: Precios dinámicos con vigencia

## Bot Tools (Vertex AI)
- crear-presupuesto
- consultar-stock
- consultar-estado
- consultar-saldo
- crear-reclamo
