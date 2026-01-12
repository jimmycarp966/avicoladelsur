# Evidencia de Actualización
**Fecha:** 12 de Enero de 2026, 14:55 (Local)
**Autor:** Antigravity

## Cambios Detectados
- **Lógica de Formulario**: Simplificación de `presupuesto-form.tsx` para auto-selección de cliente.
- **Base de Datos**: Migración masiva de 204 clientes a la lista de precios MAYORISTA.
- **Documentación**: Actualización de `ARCHITECTURE.MD`, `ARCHITECTURE_SUMMARY.md` y `CHANGELOG.md`.

## Resumen Técnico
Se ajustó el dominio de Ventas para automatizar la selección de Zona y Lista de Precios, impacto: Migración de datos exitosa para unificar todos los clientes bajo la lista MAYORISTA.

## Archivos Afectados
- `src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/presupuesto-form.tsx`
- `supabase/migrations/20260112_unificar_listas_mayorista.sql`
- `ARCHITECTURE_SUMMARY.md`
- `ARCHITECTURE.MD`
- `docs/CHANGELOG.md`
- `docs/diagrams/architecture.mmd`

## Diagrama
- `docs/diagrams/architecture.mmd`
