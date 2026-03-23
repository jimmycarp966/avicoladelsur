-- =========================================
-- PRODUCCIÓN INCREMENTAL (MEMORY BANK)
-- =========================================
-- Fecha: 2026-01-24
-- Descripción: Sistema de producción incremental para trackear progreso de producción
-- Skill: erp-produccion-stock

-- Agregar columna de cantidad a las entradas de producción
-- para poder trackear unidades producidas (ej: 10/30 cajones)
ALTER TABLE orden_produccion_entradas
ADD COLUMN IF NOT EXISTS cantidad_unidades INTEGER DEFAULT 1;

-- Comentario explicativo
COMMENT ON COLUMN orden_produccion_entradas.cantidad_unidades IS 'Número de unidades producidas en esta entrada (ej: cajones). Para producción incremental.';

-- Tabla de progreso de producción incremental (Memory Bank)
-- Esto permite guardar cuántas unidades se planean producir vs cuántas van saliendo
CREATE TABLE IF NOT EXISTS produccion_progreso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id UUID NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    destino_id UUID NOT NULL REFERENCES destinos_produccion(id),
    -- Objetivo
    cantidad_objetivo INTEGER NOT NULL DEFAULT 0, -- Cuántas unidades se planean producir
    peso_objetivo_kg DECIMAL(10,3) DEFAULT 0,
    -- Progreso actual (se actualiza con cada entrada)
    cantidad_producida INTEGER NOT NULL DEFAULT 0, -- Cuántas van saliendo
    peso_producido_kg DECIMAL(10,3) DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Solo un registro por combinación
    UNIQUE(orden_id, producto_id, destino_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produccion_progreso_orden ON produccion_progreso(orden_id);
CREATE INDEX IF NOT EXISTS idx_produccion_progreso_producto ON produccion_progreso(producto_id);

-- RLS
ALTER TABLE produccion_progreso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produccion_progreso_all_authenticated"
    ON produccion_progreso FOR ALL TO authenticated USING (true);

-- =========================================
-- FUNCIÓN PARA ACTUALIZAR PROGRESO
-- =========================================

-- Trigger que actualiza el progreso cuando se agrega una entrada
CREATE OR REPLACE FUNCTION fn_actualizar_progreso_produccion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Actualizar o crear registro de progreso
    INSERT INTO produccion_progreso (
        orden_id,
        producto_id,
        destino_id,
        cantidad_producida,
        peso_producido_kg
    ) VALUES (
        NEW.orden_id,
        NEW.producto_id,
        NEW.destino_id,
        COALESCE(NEW.cantidad_unidades, 1),
        COALESCE(NEW.peso_kg, 0)
    )
    ON CONFLICT (orden_id, producto_id, destino_id) 
    DO UPDATE SET
        cantidad_producida = produccion_progreso.cantidad_producida + COALESCE(NEW.cantidad_unidades, 1),
        peso_producido_kg = produccion_progreso.peso_producido_kg + COALESCE(NEW.peso_kg, 0),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_actualizar_progreso_produccion ON orden_produccion_entradas;
CREATE TRIGGER trg_actualizar_progreso_produccion
    AFTER INSERT ON orden_produccion_entradas
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_progreso_produccion();

-- =========================================
-- FUNCIÓN PARA ESTABLECER OBJETIVO
-- =========================================

CREATE OR REPLACE FUNCTION fn_establecer_objetivo_produccion(
    p_orden_id UUID,
    p_producto_id UUID,
    p_destino_id UUID,
    p_cantidad_objetivo INTEGER,
    p_peso_objetivo_kg DECIMAL(10,3) DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_progreso_id UUID;
BEGIN
    INSERT INTO produccion_progreso (
        orden_id,
        producto_id,
        destino_id,
        cantidad_objetivo,
        peso_objetivo_kg
    ) VALUES (
        p_orden_id,
        p_producto_id,
        p_destino_id,
        p_cantidad_objetivo,
        COALESCE(p_peso_objetivo_kg, 0)
    )
    ON CONFLICT (orden_id, producto_id, destino_id)
    DO UPDATE SET
        cantidad_objetivo = p_cantidad_objetivo,
        peso_objetivo_kg = COALESCE(p_peso_objetivo_kg, produccion_progreso.peso_objetivo_kg),
        updated_at = NOW()
    RETURNING id INTO v_progreso_id;

    RETURN json_build_object(
        'success', true,
        'progreso_id', v_progreso_id
    );
END;
$$;

-- =========================================
-- FUNCIÓN PARA OBTENER PROGRESO DE ORDEN
-- =========================================

CREATE OR REPLACE FUNCTION fn_obtener_progreso_produccion(
    p_orden_id UUID
)
RETURNS TABLE (
    producto_id UUID,
    producto_nombre TEXT,
    producto_codigo TEXT,
    destino_id UUID,
    destino_nombre TEXT,
    cantidad_objetivo INTEGER,
    cantidad_producida INTEGER,
    peso_objetivo_kg DECIMAL(10,3),
    peso_producido_kg DECIMAL(10,3),
    porcentaje_completado DECIMAL(5,2),
    completado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pp.producto_id,
        p.nombre::TEXT as producto_nombre,
        p.codigo::TEXT as producto_codigo,
        pp.destino_id,
        d.nombre::TEXT as destino_nombre,
        pp.cantidad_objetivo,
        pp.cantidad_producida,
        pp.peso_objetivo_kg,
        pp.peso_producido_kg,
        CASE 
            WHEN pp.cantidad_objetivo > 0 THEN 
                ROUND((pp.cantidad_producida::DECIMAL / pp.cantidad_objetivo) * 100, 2)
            ELSE 0 
        END as porcentaje_completado,
        pp.cantidad_producida >= pp.cantidad_objetivo as completado
    FROM produccion_progreso pp
    JOIN productos p ON p.id = pp.producto_id
    JOIN destinos_produccion d ON d.id = pp.destino_id
    WHERE pp.orden_id = p_orden_id
    ORDER BY d.nombre, p.nombre;
END;
$$;
