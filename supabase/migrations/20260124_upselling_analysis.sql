-- Migration: Upselling Analysis - Análisis de productos complementarios
-- Fecha: 2026-01-24
-- Propósito: Identificar productos que se suelen comprar juntos para sugerencias de upselling

BEGIN;

-- Función RPC: fn_analizar_productos_complementarios
-- Analiza tendencias de compra de los últimos 6 meses para un producto dado
CREATE OR REPLACE FUNCTION fn_analizar_productos_complementarios(
    p_producto_id UUID,
    p_limit INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH pedidos_con_producto AS (
        -- Encontrar presupuestos que contienen el producto base (excluyendo anulados)
        SELECT DISTINCT presupuesto_id
        FROM presupuesto_items pi
        JOIN presupuestos p ON pi.presupuesto_id = p.id
        WHERE pi.producto_id = p_producto_id
        AND p.estado != 'anulado'
        AND p.created_at > NOW() - INTERVAL '6 months'
    ),
    productos_relacionados AS (
        -- Encontrar otros productos en esos mismos presupuestos
        SELECT 
            pi.producto_id,
            COUNT(*) as frecuencia
        FROM presupuesto_items pi
        WHERE pi.presupuesto_id IN (SELECT presupuesto_id FROM pedidos_con_producto)
        AND pi.producto_id != p_producto_id -- Excluir el producto base
        GROUP BY pi.producto_id
    ),
    top_productos AS (
        -- Obtener los más frecuentes con detalles
        SELECT 
            pr.producto_id,
            p.nombre,
            p.codigo,
            p.precio_venta,
            p.unidad_medida,
            pr.frecuencia
        FROM productos_relacionados pr
        JOIN productos p ON pr.producto_id = p.id
        WHERE p.activo = true
        ORDER BY pr.frecuencia DESC, p.nombre ASC
        LIMIT p_limit
    )
    SELECT 
        jsonb_build_object(
            'success', true,
            'producto_id_base', p_producto_id,
            'sugerencias', COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'producto_id', producto_id,
                        'nombre', nombre,
                        'codigo', codigo,
                        'precio', precio_venta,
                        'unidad', unidad_medida,
                        'frecuencia', frecuencia
                    )
                ),
                '[]'::jsonb
            )
        ) INTO v_result
    FROM top_productos;

    -- Si no hay resultados, retornar éxito con lista vacía
    IF v_result IS NULL THEN
        v_result := jsonb_build_object(
            'success', true,
            'producto_id_base', p_producto_id,
            'sugerencias', '[]'::jsonb,
            'message', 'No hay suficientes datos para sugerencias'
        );
    END IF;

    RETURN v_result;
END;
$$;

-- Comentario de documentación
COMMENT ON FUNCTION fn_analizar_productos_complementarios IS 'Analiza presupuestos de los últimos 6 meses para encontrar productos que se suelen comprar junto al producto dado.';

COMMIT;

-- Verificación de la migración
DO $$
BEGIN
    -- Verificar que la función existe
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'fn_analizar_productos_complementarios'
    ) THEN
        RAISE NOTICE '✓ Función fn_analizar_productos_complementarios creada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Función fn_analizar_productos_complementarios no creada';
    END IF;

    RAISE NOTICE '✓ Migración 20260124_upselling_analysis completada';
END $$;
