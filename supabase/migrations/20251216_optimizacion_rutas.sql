-- ===========================================
-- MIGRACIÓN: Optimización de Asignación de Rutas
-- Fecha: 16/12/2025
-- Objetivo: Crear función RPC para validación batch de capacidad de rutas
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_validar_capacidad_ruta_batch
-- Valida capacidad de múltiples pedidos de una vez
-- ===========================================

CREATE OR REPLACE FUNCTION fn_validar_capacidad_ruta_batch(
    p_ruta_id UUID,
    p_pedidos_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
    v_pedido_id UUID;
    v_peso_total DECIMAL := 0;
    v_capacidad_ruta DECIMAL;
    v_result JSONB := '[]'::JSONB;
    v_pedido_result JSONB;
    v_peso_pedido DECIMAL;
BEGIN
    -- Obtener capacidad de la ruta
    SELECT COALESCE(v.capacidad_kg, 0) INTO v_capacidad_ruta
    FROM rutas_reparto r
    JOIN vehiculos v ON v.id = r.vehiculo_id
    WHERE r.id = p_ruta_id;

    -- Calcular peso total de pedidos existentes en la ruta
    SELECT COALESCE(SUM(p.peso_total_kg), 0) INTO v_peso_total
    FROM pedidos p
    JOIN detalles_ruta dr ON dr.pedido_id = p.id
    WHERE dr.ruta_id = p_ruta_id;

    -- Iterar sobre cada pedido a agregar
    FOREACH v_pedido_id IN ARRAY p_pedidos_ids
    LOOP
        -- Obtener peso del pedido
        SELECT COALESCE(peso_total_kg, 0) INTO v_peso_pedido
        FROM pedidos
        WHERE id = v_pedido_id;

        -- Verificar si cabe en la ruta
        DECLARE
            v_peso_final DECIMAL := v_peso_total + v_peso_pedido;
            v_cabe BOOLEAN := v_peso_final <= v_capacidad_ruta;
        BEGIN
            v_pedido_result := jsonb_build_object(
                'pedido_id', v_pedido_id,
                'peso_kg', v_peso_pedido,
                'peso_total_ruta', v_peso_final,
                'capacidad_ruta', v_capacidad_ruta,
                'cabe', v_cabe,
                'espacio_disponible', GREATEST(0, v_capacidad_ruta - v_peso_final)
            );

            v_result := v_result || jsonb_build_array(v_pedido_result);

            -- Si cabe, agregar al peso total
            IF v_cabe THEN
                v_peso_total := v_peso_final;
            END IF;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'ruta_id', p_ruta_id,
        'capacidad_ruta', v_capacidad_ruta,
        'peso_inicial', v_peso_total - (
            SELECT COALESCE(SUM(p.peso_total_kg), 0)
            FROM pedidos p
            JOIN detalles_ruta dr ON dr.pedido_id = p.id
            WHERE dr.ruta_id = p_ruta_id
        ),
        'peso_final', v_peso_total,
        'items', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

