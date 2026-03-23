-- ===========================================
-- MIGRACIÓN: Agregar campo vigencia_activa a listas_precios
-- Fecha: 07/12/2025
-- ===========================================

BEGIN;

-- ===========================================
-- AGREGAR CAMPO vigencia_activa
-- ===========================================

-- Agregar columna vigencia_activa con valor por defecto false
-- Por defecto, las listas NO validarán vigencia (comportamiento esperado)
ALTER TABLE listas_precios
ADD COLUMN IF NOT EXISTS vigencia_activa BOOLEAN DEFAULT false;

-- Agregar comentario para documentar el campo
COMMENT ON COLUMN listas_precios.vigencia_activa IS 
'Si es true, valida las fechas de vigencia. Si es false, la lista está vigente desde que se modifica hasta que se actualice (sin validar fechas)';

COMMIT;

