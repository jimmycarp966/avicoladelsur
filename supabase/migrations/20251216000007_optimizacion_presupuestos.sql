-- ===========================================
-- MIGRACIÓN: Optimización Flujo Presupuestos → Pedidos
-- Fecha: 16/12/2025
-- Objetivo: Crear funciones RPC para validación batch y conversión masiva
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_validar_stock_batch
-- Valida stock de múltiples productos en una sola query
-- ===========================================

CREATE OR REPLACE FUNCTION fn_validar_stock_batch(
    p_items JSONB,
    p_sucursal_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_item JSONB;
    v_producto_id UUID;
    v_cantidad DECIMAL;
    v_stock_disponible DECIMAL;
    v_result JSONB := '[]'::JSONB;
    v_item_result JSONB;
BEGIN
    -- Iterar sobre cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_producto_id := (v_item->>'producto_id')::UUID;
        v_cantidad := (v_item->>'cantidad')::DECIMAL;

        -- Calcular stock disponible (FIFO)
        SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes
        WHERE producto_id = v_producto_id
            AND estado = 'disponible'
            AND cantidad_disponible > 0
            AND (p_sucursal_id IS NULL OR sucursal_id = p_sucursal_id)
        ORDER BY fecha_vencimiento NULLS LAST, fecha_ingreso ASC;

        -- Construir resultado del item
        v_item_result := jsonb_build_object(
            'producto_id', v_producto_id,
            'cantidad_solicitada', v_cantidad,
            'stock_disponible', v_stock_disponible,
            'suficiente', v_stock_disponible >= v_cantidad
        );

        -- Agregar al resultado
        v_result := v_result || jsonb_build_array(v_item_result);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'items', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_convertir_presupuestos_masivo
-- Convierte múltiples presupuestos en una sola transacción
-- ===========================================

CREATE OR REPLACE FUNCTION fn_convertir_presupuestos_masivo(
    p_presupuestos_ids UUID[],
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_presupuesto_id UUID;
    v_result JSONB := '[]'::JSONB;
    v_presupuesto_result JSONB;
    v_pedido_id UUID;
    v_numero_pedido TEXT;
    v_error_count INTEGER := 0;
    v_success_count INTEGER := 0;
BEGIN
    -- Iterar sobre cada presupuesto
    FOREACH v_presupuesto_id IN ARRAY p_presupuestos_ids
    LOOP
        BEGIN
            -- Convertir presupuesto usando la función existente
            SELECT fn_convertir_presupuesto_a_pedido(v_presupuesto_id, p_user_id) INTO v_presupuesto_result;

            IF v_presupuesto_result->>'success' = 'true' THEN
                v_success_count := v_success_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'presupuesto_id', v_presupuesto_id,
                    'success', true,
                    'pedido_id', v_presupuesto_result->>'pedido_id',
                    'numero_pedido', v_presupuesto_result->>'numero_pedido'
                ));
            ELSE
                v_error_count := v_error_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'presupuesto_id', v_presupuesto_id,
                    'success', false,
                    'error', v_presupuesto_result->>'error'
                ));
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'presupuesto_id', v_presupuesto_id,
                    'success', false,
                    'error', SQLERRM
                ));
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total', array_length(p_presupuestos_ids, 1),
        'success_count', v_success_count,
        'error_count', v_error_count,
        'results', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

