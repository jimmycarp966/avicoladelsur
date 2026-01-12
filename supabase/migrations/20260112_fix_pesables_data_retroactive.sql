-- ===========================================
-- MIGRACIÓN: Backfill de datos para pesables
-- Fecha: 12/01/2026
-- Objetivo:
--   Corregir items de presupuestos pendientes que deberían ser pesables
--   (requiere_pesaje = true) pero se guardaron como pesable = false
--   debido a la lógica anterior.
-- ===========================================

BEGIN;

UPDATE presupuesto_items pi
SET pesable = true
FROM productos p, presupuestos pr
WHERE pi.producto_id = p.id
  AND pi.presupuesto_id = pr.id
  AND p.requiere_pesaje = true
  AND pi.pesable = false
  AND pr.estado IN ('pendiente', 'en_almacen');

COMMIT;
