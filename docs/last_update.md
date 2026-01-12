# Última Actualización del Sistema

**Fecha:** 2026-01-12 15:30:00 (Aprox)
**Autor:** Antigravity

## Resumen del Cambio
Se ajustó la lógica de productos pesables (Frontend/Backend/SQL) para respetar el flag `requiere_pesaje` en ventas mayoristas, corrigiendo validaciones en UI de preparación. Backfill de datos aplicado.

## Archivos Afectados
- src/actions/almacen.actions.ts
- src/actions/presupuestos-dia.actions.ts
- src/components/almacen/PresupuestosDiaAcciones.tsx
- src/app/(admin)/(dominios)/almacen/presupuesto/[id]/pesaje/page.tsx
- supabase/migrations/20260112_fix_logica_pesable_con_requiere_pesaje.sql

## Diagrama de Arquitectura
No hubo cambios estructurales mayores, solo lógica de negocio y validación.
