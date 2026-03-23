-- Migration: Upselling Analysis - Tabla y análisis de productos complementarios
-- Fecha: 2026-01-24
-- Propósito: Crear estructura para sugerencias de upselling basadas en análisis de ventas reales

BEGIN;

-- 1. Crear tabla productos_complementarios
CREATE TABLE IF NOT EXISTS productos_complementarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    complementario_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    mensaje_sugerencia TEXT, -- Opcional: mensaje personalizado
    frecuencia_conjunta INTEGER DEFAULT 0, -- Cuántas veces se compraron juntos
    prioridad INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- No repetir la misma relación
    CONSTRAINT unique_producto_complementario UNIQUE (producto_id, complementario_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prod_comp_producto_id ON productos_complementarios(producto_id);
CREATE INDEX IF NOT EXISTS idx_prod_comp_frecuencia ON productos_complementarios(frecuencia_conjunta DESC);

-- 2. Función RPC: fn_analizar_y_poblar_complementarios
-- Analiza tendencias de los últimos 6 meses y puebla la tabla
CREATE OR REPLACE FUNCTION fn_analizar_y_poblar_complementarios()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Limpiar tabla actual (o podrías hacer un merge más complejo)
    TRUNCATE TABLE productos_complementarios;

    -- Insertar nuevas relaciones basadas en análisis
    INSERT INTO productos_complementarios (producto_id, complementario_id, frecuencia_conjunta, prioridad)
    WITH pedidos_recientes AS (
        SELECT id, created_at
        FROM presupuestos
        WHERE estado != 'anulado'
        AND created_at > NOW() - INTERVAL '6 months'
    ),
    pares_productos AS (
        SELECT 
            pi1.producto_id as p1_id,
            pi2.producto_id as p2_id,
            COUNT(*) as frecuencia
        FROM presupuesto_items pi1
        JOIN presupuesto_items pi2 ON pi1.presupuesto_id = pi2.presupuesto_id
        JOIN pedidos_recientes pr ON pi1.presupuesto_id = pr.id
        WHERE pi1.producto_id != pi2.producto_id
        GROUP BY pi1.producto_id, pi2.producto_id
    ),
    top_pares AS (
        -- Quedarse con los top 3 por cada producto
        SELECT 
            p1_id,
            p2_id,
            frecuencia,
            ROW_NUMBER() OVER(PARTITION BY p1_id ORDER BY frecuencia DESC) as ranking
        FROM pares_productos
    )
    SELECT 
        p1_id,
        p2_id,
        frecuencia,
        (10 - ranking) as prioridad -- Ranking 1 tiene prioridad 9, ranking 2 prioridad 8...
    FROM top_pares
    WHERE ranking <= 3;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Tabla de productos complementarios actualizada',
        'relaciones_creadas', v_count
    );
END;
$$;

-- 3. Función RPC: get_productos_complementarios
-- Consulta rápida de sugerencias para un producto
CREATE OR REPLACE FUNCTION get_productos_complementarios(p_producto_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT 
        jsonb_build_object(
            'success', true,
            'producto_id_base', p_producto_id,
            'sugerencias', COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'producto_id', p.id,
                        'nombre', p.nombre,
                        'codigo', p.codigo,
                        'precio', p.precio_venta,
                        'unidad', p.unidad_medida,
                        'frecuencia', pc.frecuencia_conjunta
                    )
                ),
                '[]'::jsonb
            )
        ) INTO v_result
    FROM productos_complementarios pc
    JOIN productos p ON pc.complementario_id = p.id
    WHERE pc.producto_id = p_producto_id
    AND p.activo = true
    ORDER BY pc.prioridad DESC, pc.frecuencia_conjunta DESC;

    IF v_result IS NULL THEN
        v_result := jsonb_build_object(
            'success', true,
            'producto_id_base', p_producto_id,
            'sugerencias', '[]'::jsonb
        );
    END IF;

    RETURN v_result;
END;
$$;

COMMIT;

-- Verificación y población inicial
DO $$
BEGIN
    -- Verificar tabla
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'productos_complementarios') THEN
        RAISE NOTICE '✓ Tabla productos_complementarios creada';
    END IF;

    -- Intentar población inicial
    PERFORM fn_analizar_y_poblar_complementarios();
    RAISE NOTICE '✓ Población inicial completada';
END $$;
