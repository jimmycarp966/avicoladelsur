-- ===========================================
-- MIGRACIÓN: Desactivar precios manuales
-- Fecha: 11/12/2024
-- Descripción: Desactivar todos los precios manuales en precios_productos
--   ya que ahora el precio se calcula siempre desde margen de ganancia
--   Se mantienen como inactivos para referencia histórica
-- ===========================================

BEGIN;

-- Marcar como inactivos todos los precios manuales
-- Esto permite mantenerlos para referencia histórica pero no se usarán en cálculos
UPDATE precios_productos 
SET activo = false,
    updated_at = NOW()
WHERE activo = true;

-- Nota: Si en el futuro se quiere eliminar completamente, ejecutar:
-- DELETE FROM precios_productos;

COMMIT;

