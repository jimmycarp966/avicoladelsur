# Última Actualización del Sistema

**Fecha:** 2026-01-12 (Hotfix)
**Autor:** Antigravity

## Resumen Técnico
Se ajustó `fn_convertir_presupuesto_a_pedido` para corregir la conversión de items mayoristas pesables (evitando la sobrescritura del peso real por bultos estándar) y se mejoró `fn_obtener_pedido_completo` para una correcta visualización del resumen de pedido.

**Impacto:**
- **Corrección Crítica**: Los pedidos mayoristas ahora reflejan el peso exacto cobrado.
- **DB Schema**: Nuevas funciones SQL (migraciones).

## Archivos Modificados
- `supabase/migrations/20260112_fix_conversion_mayorista_pesable.sql`
- `supabase/migrations/20260112_fix_obtener_pedido_completo_v2.sql`
- `ARCHITECTURE_SUMMARY.md`
- `docs/CHANGELOG.md`
