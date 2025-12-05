-- ===========================================
-- MIGRACIÓN: Función para finalizar pesaje sin convertir a pedido
-- Fecha: 16/12/2025
-- Objetivo:
--   Crear función que solo recalcule total_final del presupuesto
--   sin cambiar el estado ni convertirlo a pedido
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_finalizar_pesaje_presupuesto
-- Solo recalcula totales, NO convierte a pedido
-- ===========================================
CREATE OR REPLACE FUNCTION fn_finalizar_pesaje_presupuesto(
    p_presupuesto_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_total_final DECIMAL(12,2);
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
BEGIN
    -- Obtener datos del presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;
    
    -- Solo permitir si está en estado 'en_almacen' o 'pendiente'
    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no está en un estado válido para finalizar pesaje');
    END IF;
    
    -- Validar que todos los productos pesables estén pesados
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true;
    
    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true
      AND peso_final IS NOT NULL;
    
    IF v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 
            'No se puede finalizar: todos los productos pesables deben estar pesados. Faltan ' || 
            (v_total_pesables - v_pesables_pesados) || ' producto(s) por pesar.'
        );
    END IF;
    
    -- Recalcular total_final sumando todos los subtotales (finales si existen, sino estimados)
    SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
    INTO v_total_final
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id;
    
    -- Agregar recargos si existen
    v_total_final := v_total_final + COALESCE(v_presupuesto.recargo_total, 0);
    
    -- Actualizar presupuesto: solo recalcular total_final, mantener estado actual
    UPDATE presupuestos
    SET total_final = v_total_final,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pesaje finalizado correctamente. El presupuesto seguirá disponible en Presupuestos del Día.',
        'total_final', v_total_final,
        'estado', v_presupuesto.estado
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al finalizar pesaje: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_finalizar_pesaje_presupuesto(UUID) IS 
'Finaliza el pesaje de un presupuesto recalculando total_final sin convertir a pedido. Mantiene el estado actual (en_almacen).';

COMMIT;

