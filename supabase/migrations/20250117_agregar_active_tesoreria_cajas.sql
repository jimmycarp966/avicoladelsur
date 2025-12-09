-- ===========================================
-- Agregar campo 'active' a tesoreria_cajas
-- Fecha: 17/01/2025
-- Objetivo: Permitir filtrar cajas activas/inactivas
-- ===========================================

BEGIN;

-- Agregar columna 'active' a tesoreria_cajas si no existe
ALTER TABLE tesoreria_cajas 
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Actualizar todas las cajas existentes para que sean activas por defecto
UPDATE tesoreria_cajas 
SET active = true 
WHERE active IS NULL;

-- Crear índice para mejorar el rendimiento de consultas por active
CREATE INDEX IF NOT EXISTS idx_tesoreria_cajas_active ON tesoreria_cajas(active);

-- Crear índice compuesto para consultas por sucursal y active
CREATE INDEX IF NOT EXISTS idx_tesoreria_cajas_sucursal_active ON tesoreria_cajas(sucursal_id, active) 
WHERE sucursal_id IS NOT NULL;

COMMENT ON COLUMN tesoreria_cajas.active IS 'Indica si la caja está activa (true) o inactiva (false). Las cajas inactivas no aparecen en las consultas normales.';

COMMIT;

