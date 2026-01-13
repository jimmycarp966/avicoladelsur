# Última Actualización de Documentación

**Fecha**: 2026-01-12 18:55
**Archivos modificados detectados**:
- src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/page.tsx
- src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/presupuesto-form.tsx
- src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/producto-item-row.tsx
- supabase/migrations/20260113_get_products_with_stock_details.sql

**Resumen Técnico**:
Se implementó `fn_obtener_productos_con_stock_detalle` y se actualizó el formulario de presupuestos para mostrar Stock Real y Preventivo en el selector de productos, mejorando la visibilidad del inventario para vendedores. Impacto: DB Schema (nueva función), Frontend.

**Diagrama**: No se requieren cambios en el diagrama de arquitectura para esta funcionalidad de UI/DB interna.
