-- ===========================================
-- MIGRACIÓN: Optimización Validación de Cobros
-- Fecha: 16/12/2025
-- Objetivo: Crear función RPC para validación masiva de rutas
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_validar_rutas_masivo
-- Valida múltiples rutas de una vez con comparación automática
-- ===========================================

CREATE OR REPLACE FUNCTION fn_validar_rutas_masivo(
    p_rutas_data JSONB,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_ruta_data JSONB;
    v_ruta_id UUID;
    v_monto_recibido DECIMAL;
    v_monto_registrado DECIMAL;
    v_result JSONB := '[]'::JSONB;
    v_ruta_result JSONB;
    v_diferencias JSONB := '[]'::JSONB;
    v_total_diferencia DECIMAL := 0;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    -- Iterar sobre cada ruta
    FOR v_ruta_data IN SELECT * FROM jsonb_array_elements(p_rutas_data)
    LOOP
        v_ruta_id := (v_ruta_data->>'ruta_id')::UUID;
        v_monto_recibido := (v_ruta_data->>'monto_recibido')::DECIMAL;
        
        -- Obtener monto registrado de la ruta
        SELECT COALESCE(SUM(monto), 0) INTO v_monto_registrado
        FROM tesoreria_movimientos
        WHERE origen_tipo = 'ruta'
            AND origen_id = v_ruta_id
            AND tipo = 'ingreso';

        -- Calcular diferencia
        DECLARE
            v_diferencia DECIMAL := v_monto_recibido - v_monto_registrado;
        BEGIN
            -- Agregar a diferencias
            v_diferencias := v_diferencias || jsonb_build_array(jsonb_build_object(
                'ruta_id', v_ruta_id,
                'monto_registrado', v_monto_registrado,
                'monto_recibido', v_monto_recibido,
                'diferencia', v_diferencia
            ));

            v_total_diferencia := v_total_diferencia + ABS(v_diferencia);

            -- Si no hay diferencia significativa (menos de 0.01), validar automáticamente
            IF ABS(v_diferencia) < 0.01 THEN
                -- Aquí se podría llamar a la función de validación existente
                -- Por ahora solo registramos el resultado
                v_success_count := v_success_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'ruta_id', v_ruta_id,
                    'success', true,
                    'validada', true
                ));
            ELSE
                v_error_count := v_error_count + 1;
                v_result := v_result || jsonb_build_array(jsonb_build_object(
                    'ruta_id', v_ruta_id,
                    'success', false,
                    'validada', false,
                    'diferencia', v_diferencia
                ));
            END IF;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total', jsonb_array_length(p_rutas_data),
        'success_count', v_success_count,
        'error_count', v_error_count,
        'total_diferencia', v_total_diferencia,
        'diferencias', v_diferencias,
        'results', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

