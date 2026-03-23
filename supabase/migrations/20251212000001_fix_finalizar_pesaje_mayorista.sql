-- ===========================================
-- MIGRACIÓN: Fix validación pesables en fn_finalizar_pesaje_presupuesto
-- Fecha: 12/12/2025
-- Problema: La función fn_finalizar_pesaje_presupuesto tiene la misma
--           validación vieja que cuenta items mayoristas como pesables.
-- Solución: Aplicar la misma lógica que fn_convertir_presupuesto_a_pedido
-- ===========================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_finalizar_pesaje_presupuesto(
    p_presupuesto_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_total_final DECIMAL(12,2);
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_lista_tipo VARCHAR(50);
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
    
    -- Obtener tipo de lista del presupuesto
    SELECT lp.tipo INTO v_lista_tipo
    FROM listas_precios lp
    WHERE lp.id = v_presupuesto.lista_precio_id;

    IF v_lista_tipo IS NULL THEN
        SELECT lp.tipo INTO v_lista_tipo
        FROM clientes_listas_precios clp
        INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
        WHERE clp.cliente_id = v_presupuesto.cliente_id
          AND lp.activa = true
        ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
        LIMIT 1;
    END IF;
    
    -- =====================================================
    -- VALIDAR PESABLES PENDIENTES
    -- Excluir items mayoristas (no requieren pesaje)
    -- =====================================================
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id
      AND pi.pesable = true
      -- Excluir si es venta mayorista
      AND NOT (
          COALESCE(p.venta_mayor_habilitada, false) = true
          AND (
              COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor')
          )
      );
    
    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id
      AND pi.pesable = true
      AND pi.peso_final IS NOT NULL
      -- Excluir si es venta mayorista
      AND NOT (
          COALESCE(p.venta_mayor_habilitada, false) = true
          AND (
              COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor')
          )
      );
    
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
'Finaliza el pesaje de un presupuesto recalculando total_final sin convertir a pedido. 
Mantiene el estado actual (en_almacen).
FIX 12/12/2025: Los items mayoristas NO se cuentan como pesables pendientes.';

COMMIT;
