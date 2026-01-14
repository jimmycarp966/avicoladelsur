---
name: erp-produccion-stock
description: Control estricto de Stock FIFO, Merma Líquida y Producción. Usar al modificar módulo de Almacén/Producción.
---

# ERP Producción y Stock

Gestiona el ciclo de vida de productos desde entrada hasta venta.

## Stock FIFO (Critical)
- **Obligatorio**: Usar `fn_descontar_stock_fifo` para descuentos
- **Lotes**: Siempre descontar del más antiguo primero

## Producción y Merma
1. **Merma Líquida Proporcional**: En `fn_completar_orden_produccion`
   - Factor = merma_total / peso_productos
   - Distribuir usando `merma_real_kg`
2. **Pesaje Cajones**: Si `venta_mayor_habilitada` = true
   - Peso = cantidad × `kg_por_unidad_mayor` (default 20kg)

## Tablas Clave
- `lotes`: Kernel FIFO con fecha_ingreso
- `movimientos_stock`: Historial de cambios
- `produccion_ordenes`: Órdenes de desposte
- `produccion_config`: Rendimientos teóricos

## Validaciones
- Sectores válidos: Cámara 1 → Producción → Despacho
- Merma sólida vs líquida: Categorías separadas
