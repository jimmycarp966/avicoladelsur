-- =====================================================
-- 20260113_merma_liquida_proporcional.sql
-- Mejora: Distribuir merma líquida por producto y activar cajones mayoristas
-- =====================================================

-- ===========================================
-- 1) fn_completar_orden_produccion
--    - Calcula merma líquida (merma total - desperdicio sólido)
--    - Distribuye merma proporcional a cada producto generado (merma_real_kg)
-- ===========================================
CREATE OR REPLACE FUNCTION fn_completar_orden_produccion(
    p_orden_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_orden RECORD;
    v_entrada RECORD;
    v_lote_id UUID;
    v_numero_lote VARCHAR(50);
    v_lotes_generados JSONB := '[]'::JSONB;
    v_fecha TEXT;
    v_secuencia INTEGER;
    v_merma_total DECIMAL;
    v_merma_pct DECIMAL;
    v_desperdicio_solido DECIMAL := 0;
    v_merma_liquida DECIMAL;
    v_peso_productos DECIMAL := 0;
    v_factor_merma DECIMAL := NULL;
    v_merma_producto DECIMAL := 0;
BEGIN
    -- Obtener orden
    SELECT * INTO v_orden FROM ordenes_produccion WHERE id = p_orden_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
    END IF;
    
    IF v_orden.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La orden ya fue procesada');
    END IF;
    
    -- Calcular desperdicio sólido (piel, etc.)
    SELECT COALESCE(SUM(ope.peso_kg), 0) INTO v_desperdicio_solido
    FROM orden_produccion_entradas ope
    WHERE ope.orden_id = p_orden_id
      AND ope.es_desperdicio_solido = true;
    
    -- Calcular merma total (salida_stock - entrada_stock)
    -- peso_total_entrada = lo que SALIÓ del stock (consumido)
    -- peso_total_salida = lo que ENTRÓ al stock (generado)
    v_merma_total := v_orden.peso_total_entrada - v_orden.peso_total_salida;
    
    -- Merma líquida = merma total - desperdicio sólido
    -- (La piel es desperdicio pero no es "pérdida líquida")
    v_merma_liquida := v_merma_total - v_desperdicio_solido;
    
    -- Peso total de productos generados (excluye desperdicio sólido)
    SELECT COALESCE(SUM(ope.peso_kg), 0) INTO v_peso_productos
    FROM orden_produccion_entradas ope
    WHERE ope.orden_id = p_orden_id
      AND COALESCE(ope.es_desperdicio_solido, false) = false;

    -- Factor de merma proporcional (kg merma por kg producto)
    IF v_peso_productos > 0 THEN
        v_factor_merma := v_merma_liquida / v_peso_productos;
    END IF;
    
    v_merma_pct := CASE 
        WHEN v_orden.peso_total_entrada > 0 
        THEN (v_merma_liquida / v_orden.peso_total_entrada) * 100 
        ELSE 0 
    END;
    
    -- Generar lotes para cada entrada (producto generado)
    v_fecha := TO_CHAR(NOW(), 'YYYYMMDD');
    
    FOR v_entrada IN SELECT * FROM orden_produccion_entradas WHERE orden_id = p_orden_id LOOP
        -- Calcular desviación si hay peso esperado y asignar merma proporcional
        IF v_entrada.peso_esperado_kg IS NOT NULL AND v_entrada.peso_esperado_kg > 0 THEN
            UPDATE orden_produccion_entradas
            SET desviacion_porcentaje = ROUND(((v_entrada.peso_kg - v_entrada.peso_esperado_kg) / v_entrada.peso_esperado_kg) * 100, 2)
            WHERE id = v_entrada.id;
        END IF;

        -- Merma por producto (solo si no es desperdicio sólido y hay factor)
        IF COALESCE(v_entrada.es_desperdicio_solido, false) = false AND v_factor_merma IS NOT NULL THEN
            v_merma_producto := ROUND(v_entrada.peso_kg * v_factor_merma, 3);
        ELSE
            v_merma_producto := 0;
        END IF;

        UPDATE orden_produccion_entradas
        SET merma_real_kg = v_merma_producto
        WHERE id = v_entrada.id;
        
        -- Generar número de lote único
        SELECT COALESCE(MAX(
            CAST(SUBSTRING(numero_lote FROM 'LP-[0-9]{8}-([0-9]+)') AS INTEGER)
        ), 0) + 1
        INTO v_secuencia
        FROM lotes
        WHERE numero_lote LIKE 'LP-' || v_fecha || '-%';
        
        v_numero_lote := 'LP-' || v_fecha || '-' || LPAD(v_secuencia::TEXT, 4, '0');
        
        -- Crear lote
        INSERT INTO lotes (
            numero_lote,
            producto_id,
            cantidad_ingresada,
            cantidad_disponible,
            fecha_ingreso,
            fecha_vencimiento,
            ubicacion_almacen,
            estado,
            orden_produccion_id,
            es_produccion
        ) VALUES (
            v_numero_lote,
            v_entrada.producto_id,
            v_entrada.peso_kg,
            v_entrada.peso_kg,
            CURRENT_DATE,
            v_entrada.fecha_vencimiento,
            'PRODUCCION',
            'disponible',
            p_orden_id,
            true
        ) RETURNING id INTO v_lote_id;
        
        -- Actualizar entrada con lote generado
        UPDATE orden_produccion_entradas
        SET lote_generado_id = v_lote_id
        WHERE id = v_entrada.id;
        
        -- Registrar movimiento de stock
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_lote_id,
            'ingreso',
            v_entrada.peso_kg,
            'Generado por orden de producción ' || v_orden.numero_orden,
            v_orden.operario_id
        );
        
        v_lotes_generados := v_lotes_generados || jsonb_build_object(
            'lote_id', v_lote_id,
            'numero_lote', v_numero_lote,
            'producto_id', v_entrada.producto_id,
            'peso_kg', v_entrada.peso_kg,
            'es_desperdicio_solido', v_entrada.es_desperdicio_solido,
            'merma_real_kg', v_merma_producto
        );
    END LOOP;
    
    -- Marcar orden como completada
    UPDATE ordenes_produccion
    SET estado = 'completada',
        merma_kg = v_merma_liquida, -- Solo merma líquida
        merma_porcentaje = v_merma_pct,
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'lotes_generados', v_lotes_generados,
        'merma_total_kg', v_merma_total,
        'desperdicio_solido_kg', v_desperdicio_solido,
        'merma_liquida_kg', v_merma_liquida,
        'merma_porcentaje', v_merma_pct
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 2) Activar venta mayorista para productos tipo "cajón"
--    - Configura unidad mayor = caja y 20 kg por unidad
-- ===========================================
UPDATE productos
SET venta_mayor_habilitada = true,
    unidad_mayor_nombre = 'caja',
    kg_por_unidad_mayor = 20.0,
    updated_at = NOW()
WHERE activo = true
  AND (
    LOWER(nombre) LIKE '%cajon%'
    OR LOWER(nombre) LIKE '%cajón%'
    OR LOWER(categoria) = 'cajones'
    OR LOWER(codigo) LIKE '%caj%'
  )
  AND COALESCE(venta_mayor_habilitada, false) = false;
;
