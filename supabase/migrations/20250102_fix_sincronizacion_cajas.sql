-- ===========================================
-- MIGRACIÓN: Corrección Automática de Sincronización de Cajas
-- Fecha: 2025-01-02
-- Descripción: Corrige automáticamente los saldos de las cajas basándose en los movimientos
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: Recalcular saldo de una caja desde movimientos
-- ===========================================

CREATE OR REPLACE FUNCTION fn_recalcular_saldo_caja(
    p_caja_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caja RECORD;
    v_saldo_calculado NUMERIC(14,2);
    v_saldo_anterior NUMERIC(14,2);
    v_diferencia NUMERIC(14,2);
BEGIN
    -- Obtener información de la caja
    SELECT * INTO v_caja
    FROM tesoreria_cajas
    WHERE id = p_caja_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Caja no encontrada'
        );
    END IF;
    
    v_saldo_anterior := v_caja.saldo_actual;
    
    -- Calcular saldo desde movimientos
    SELECT COALESCE(
        v_caja.saldo_inicial + 
        SUM(CASE 
            WHEN tm.tipo = 'ingreso' THEN tm.monto 
            WHEN tm.tipo = 'egreso' THEN -tm.monto 
            ELSE 0 
        END),
        v_caja.saldo_inicial
    ) INTO v_saldo_calculado
    FROM tesoreria_movimientos tm
    WHERE tm.caja_id = p_caja_id;
    
    -- Si no hay movimientos, el saldo debe ser el inicial
    IF v_saldo_calculado IS NULL THEN
        v_saldo_calculado := v_caja.saldo_inicial;
    END IF;
    
    v_diferencia := v_saldo_calculado - v_saldo_anterior;
    
    -- Actualizar saldo de la caja
    UPDATE tesoreria_cajas
    SET saldo_actual = v_saldo_calculado,
        updated_at = NOW()
    WHERE id = p_caja_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'caja_id', p_caja_id,
        'saldo_anterior', v_saldo_anterior,
        'saldo_calculado', v_saldo_calculado,
        'diferencia', v_diferencia
    );
END;
$$;

-- ===========================================
-- FUNCIÓN: Corregir todas las cajas desincronizadas
-- ===========================================

CREATE OR REPLACE FUNCTION fn_corregir_sincronizacion_cajas()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caja RECORD;
    v_resultado JSONB;
    v_resultados JSONB[] := '{}';
    v_total_corregidas INTEGER := 0;
    v_total_errores INTEGER := 0;
BEGIN
    -- Recorrer todas las cajas y recalcular sus saldos
    FOR v_caja IN
        SELECT tc.id, tc.nombre, tc.saldo_actual,
               COALESCE(
                   tc.saldo_inicial + 
                   SUM(CASE 
                       WHEN tm.tipo = 'ingreso' THEN tm.monto 
                       WHEN tm.tipo = 'egreso' THEN -tm.monto 
                       ELSE 0 
                   END),
                   tc.saldo_inicial
               ) as saldo_calculado
        FROM tesoreria_cajas tc
        LEFT JOIN tesoreria_movimientos tm ON tm.caja_id = tc.id
        GROUP BY tc.id, tc.nombre, tc.saldo_inicial, tc.saldo_actual
        HAVING ABS(tc.saldo_actual - COALESCE(
            tc.saldo_inicial + 
            SUM(CASE 
                WHEN tm.tipo = 'ingreso' THEN tm.monto 
                WHEN tm.tipo = 'egreso' THEN -tm.monto 
                ELSE 0 
            END),
            tc.saldo_inicial
        )) >= 0.01
    LOOP
        v_resultado := fn_recalcular_saldo_caja(v_caja.id);
        
        IF v_resultado->>'success' = 'true' THEN
            v_total_corregidas := v_total_corregidas + 1;
        ELSE
            v_total_errores := v_total_errores + 1;
        END IF;
        
        v_resultados := array_append(v_resultados, v_resultado);
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'total_corregidas', v_total_corregidas,
        'total_errores', v_total_errores,
        'resultados', array_to_json(v_resultados)
    );
END;
$$;

-- ===========================================
-- ASIGNAR SUCURSAL_ID A CAJAS SIN SUCURSAL
-- ===========================================

-- Asignar a Casa Central las cajas que no tienen sucursal
UPDATE tesoreria_cajas
SET sucursal_id = '00000000-0000-0000-0000-000000000001'
WHERE sucursal_id IS NULL
  AND id NOT IN (
      -- Excluir cajas que ya tienen sucursal asignada
      SELECT id FROM tesoreria_cajas WHERE sucursal_id IS NOT NULL
  );

-- ===========================================
-- CORREGIR MOVIMIENTOS HUÉRFANOS
-- ===========================================

-- Opción 1: Eliminar movimientos huérfanos (si la caja fue eliminada)
-- Opción 2: Asignar a una caja por defecto
-- Por ahora, solo marcamos para revisión manual
-- Los movimientos huérfanos se pueden manejar manualmente o asignar a Casa Central

-- Crear tabla de auditoría para movimientos huérfanos
CREATE TABLE IF NOT EXISTS tesoreria_movimientos_huerfanos_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id UUID NOT NULL,
    caja_id_original UUID,
    accion TEXT,
    fecha_auditoria TIMESTAMPTZ DEFAULT NOW()
);

-- Registrar movimientos huérfanos para revisión
INSERT INTO tesoreria_movimientos_huerfanos_audit (movimiento_id, caja_id_original, accion)
SELECT 
    tm.id,
    tm.caja_id,
    'Movimiento huérfano detectado - requiere revisión manual'
FROM tesoreria_movimientos tm
LEFT JOIN tesoreria_cajas tc ON tc.id = tm.caja_id
WHERE tc.id IS NULL
ON CONFLICT DO NOTHING;

-- ===========================================
-- EJECUTAR CORRECCIÓN AUTOMÁTICA
-- ===========================================

-- Recalcular todos los saldos
SELECT fn_corregir_sincronizacion_cajas();

COMMIT;

-- Comentarios para documentación
COMMENT ON FUNCTION fn_recalcular_saldo_caja IS 'Recalcula el saldo de una caja específica basándose en sus movimientos';
COMMENT ON FUNCTION fn_corregir_sincronizacion_cajas IS 'Corrige automáticamente todos los saldos de cajas desincronizadas';
COMMENT ON TABLE tesoreria_movimientos_huerfanos_audit IS 'Auditoría de movimientos huérfanos para revisión manual';

