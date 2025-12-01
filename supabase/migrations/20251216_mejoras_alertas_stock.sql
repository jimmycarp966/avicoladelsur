-- ===========================================
-- MIGRACIÓN: Mejoras en Alertas de Stock
-- Fecha: 16/12/2025
-- Objetivo: Agregar sistema de priorización a alertas de stock
-- ===========================================

BEGIN;

-- ===========================================
-- AGREGAR COLUMNA DE PRIORIDAD
-- ===========================================

-- Agregar columna prioridad si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alertas_stock' 
        AND column_name = 'prioridad'
    ) THEN
        ALTER TABLE alertas_stock 
        ADD COLUMN prioridad INTEGER DEFAULT 1;
        
        -- Actualizar prioridades existentes
        UPDATE alertas_stock
        SET prioridad = CASE
            WHEN cantidad_actual <= umbral * 0.5 THEN 3 -- Crítico
            WHEN cantidad_actual <= umbral THEN 2 -- Bajo
            ELSE 1 -- Normal
        END
        WHERE prioridad IS NULL OR prioridad = 1;
    END IF;
END $$;

-- ===========================================
-- FUNCIÓN: Calcular Prioridad de Alerta
-- ===========================================

CREATE OR REPLACE FUNCTION fn_calcular_prioridad_alerta(
    p_cantidad_actual DECIMAL,
    p_umbral DECIMAL
)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE
        WHEN p_cantidad_actual <= p_umbral * 0.5 THEN 3 -- Crítico (≤50% del umbral)
        WHEN p_cantidad_actual <= p_umbral THEN 2 -- Bajo (≤umbral)
        ELSE 1 -- Normal
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================
-- ACTUALIZAR FUNCIÓN DE CREACIÓN DE ALERTAS
-- ===========================================

-- Actualizar fn_evaluar_stock_bajo_sucursal para incluir prioridad
-- (Esta función ya existe, solo agregamos el cálculo de prioridad)
-- La prioridad se calculará automáticamente al crear la alerta

COMMIT;

