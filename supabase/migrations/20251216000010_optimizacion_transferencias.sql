-- ===========================================
-- MIGRACIÓN: Optimización Transferencias entre Sucursales
-- Fecha: 16/12/2025
-- Objetivo: Crear funciones RPC para validación batch y aprobación masiva
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_validar_stock_batch_transferencia
-- Valida stock de múltiples productos para transferencia
-- ===========================================

CREATE OR REPLACE FUNCTION fn_validar_stock_batch_transferencia(
    p_items JSONB,
    p_sucursal_origen_id UUID
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

        -- Calcular stock disponible en sucursal origen
        SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes
        WHERE producto_id = v_producto_id
            AND sucursal_id = p_sucursal_origen_id
            AND estado = 'disponible'
            AND cantidad_disponible > 0
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
-- FUNCIÓN: fn_aprobar_transferencias_masivo
-- Aprueba múltiples transferencias simultáneamente
-- ===========================================

CREATE OR REPLACE FUNCTION fn_aprobar_transferencias_masivo(
    p_transferencias_ids UUID[],
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_transferencia_id UUID;
    v_result JSONB := '[]'::JSONB;
    v_transferencia_result JSONB;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    -- Iterar sobre cada transferencia
    FOREACH v_transferencia_id IN ARRAY p_transferencias_ids
    LOOP
        BEGIN
            -- Aprobar transferencia usando la función existente
            SELECT fn_aprobar_transferencia(v_transferencia_id, p_user_id) INTO v_transferencia_result;

            IF v_transferencia_result->>'success' = 'true' THEN
                v_success_count := v_success_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'transferencia_id', v_transferencia_id,
                    'success', true
                ));
            ELSE
                v_error_count := v_error_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'transferencia_id', v_transferencia_id,
                    'success', false,
                    'error', v_transferencia_result->>'error'
                ));
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'transferencia_id', v_transferencia_id,
                    'success', false,
                    'error', SQLERRM
                ));
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total', array_length(p_transferencias_ids, 1),
        'success_count', v_success_count,
        'error_count', v_error_count,
        'results', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

