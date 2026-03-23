-- ===========================================
-- MIGRACIÓN: Agrupar múltiples presupuestos en un solo pedido
-- Fecha: 01/12/2025
-- Objetivo: Crear función que agrupe presupuestos por cliente/turno/zona/fecha
--           y los convierta en un solo pedido consolidado
-- ===========================================

BEGIN;

-- Función para convertir múltiples presupuestos agrupados en un solo pedido
CREATE OR REPLACE FUNCTION fn_convertir_presupuestos_agrupados_a_pedido(
    p_presupuestos_ids UUID[],
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_item RECORD;
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_total_items DECIMAL(12,2) := 0;
    v_total_con_recargo DECIMAL(12,2) := 0;
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_cantidad_a_consumir DECIMAL(12,3);
    v_caja_movimiento_id UUID;
    v_cuenta_id UUID;
    v_referencia_pago VARCHAR(60);
    v_instruccion_repartidor TEXT;
    v_turno TEXT;
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_asign_result JSONB;
    v_ruta_id UUID;
    v_cliente_id UUID;
    v_zona_id UUID;
    v_usuario_vendedor UUID;
    v_observaciones TEXT;
    v_metodos_pago JSONB;
    v_recargo_total DECIMAL(12,2) := 0;
    v_presupuestos_procesados UUID[] := '{}';
    v_presupuesto_base RECORD;
    v_grupo_valido BOOLEAN := true;
    v_error_mensaje TEXT;
BEGIN
    -- Validar que hay presupuestos
    IF array_length(p_presupuestos_ids, 1) IS NULL OR array_length(p_presupuestos_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se proporcionaron presupuestos para convertir');
    END IF;

    -- Obtener el primer presupuesto para obtener datos base del grupo
    SELECT * INTO v_presupuesto_base
    FROM presupuestos
    WHERE id = p_presupuestos_ids[1];

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto base no encontrado');
    END IF;

    -- Validar que todos los presupuestos pertenecen al mismo grupo (cliente, turno, zona, fecha)
    FOR v_presupuesto IN 
        SELECT * FROM presupuestos WHERE id = ANY(p_presupuestos_ids)
    LOOP
        -- Verificar estado válido
        IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
            RETURN jsonb_build_object('success', false, 'error', 
                'El presupuesto ' || v_presupuesto.numero_presupuesto || ' no está en un estado válido para facturar');
        END IF;

        -- Validar turno y zona
        IF v_presupuesto.turno IS NULL OR v_presupuesto.zona_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 
                'El presupuesto ' || v_presupuesto.numero_presupuesto || ' debe tener turno y zona asignados');
        END IF;

        -- Validar que todos pertenecen al mismo grupo
        IF v_presupuesto.cliente_id != v_presupuesto_base.cliente_id THEN
            RETURN jsonb_build_object('success', false, 'error', 
                'Todos los presupuestos deben ser del mismo cliente');
        END IF;

        IF v_presupuesto.turno != v_presupuesto_base.turno THEN
            RETURN jsonb_build_object('success', false, 'error', 
                'Todos los presupuestos deben ser del mismo turno');
        END IF;

        IF v_presupuesto.zona_id != v_presupuesto_base.zona_id THEN
            RETURN jsonb_build_object('success', false, 'error', 
                'Todos los presupuestos deben ser de la misma zona');
        END IF;

        IF v_presupuesto.fecha_entrega_estimada != v_presupuesto_base.fecha_entrega_estimada THEN
            RETURN jsonb_build_object('success', false, 'error', 
                'Todos los presupuestos deben tener la misma fecha de entrega');
        END IF;
    END LOOP;

    -- Asignar valores base del grupo
    v_cliente_id := v_presupuesto_base.cliente_id;
    v_turno := v_presupuesto_base.turno;
    v_zona_id := v_presupuesto_base.zona_id;
    v_fecha_entrega := v_presupuesto_base.fecha_entrega_estimada;
    v_usuario_vendedor := v_presupuesto_base.usuario_vendedor;
    v_metodos_pago := v_presupuesto_base.metodos_pago;

    -- Calcular totales de todos los presupuestos del grupo
    SELECT 
        COALESCE(SUM(COALESCE(pi.subtotal_final, pi.subtotal_est)), 0),
        COALESCE(SUM(COALESCE(p.recargo_total, 0)), 0)
    INTO v_total_items, v_recargo_total
    FROM presupuestos p
    INNER JOIN presupuesto_items pi ON pi.presupuesto_id = p.id
    WHERE p.id = ANY(p_presupuestos_ids);

    v_total_con_recargo := v_total_items + v_recargo_total;

    -- Verificar pesables pendientes (advertencia, no bloquea)
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items pi
    INNER JOIN presupuestos p ON p.id = pi.presupuesto_id
    WHERE p.id = ANY(p_presupuestos_ids)
      AND pi.pesable = true;

    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items pi
    INNER JOIN presupuestos p ON p.id = pi.presupuesto_id
    WHERE p.id = ANY(p_presupuestos_ids)
      AND pi.pesable = true
      AND pi.peso_final IS NOT NULL;

    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Consolidar observaciones de todos los presupuestos
    SELECT string_agg(
        COALESCE(numero_presupuesto || ': ' || observaciones, numero_presupuesto),
        E'\n'
        ORDER BY created_at
    ) INTO v_observaciones
    FROM presupuestos
    WHERE id = ANY(p_presupuestos_ids)
      AND observaciones IS NOT NULL;

    -- Si no hay observaciones, usar un texto por defecto
    IF v_observaciones IS NULL THEN
        v_observaciones := 'Pedido consolidado de ' || array_length(p_presupuestos_ids, 1) || ' presupuesto(s)';
    ELSE
        v_observaciones := 'Pedido consolidado de ' || array_length(p_presupuestos_ids, 1) || ' presupuesto(s):' || E'\n' || v_observaciones;
    END IF;

    -- Crear pedido principal consolidado
    INSERT INTO pedidos (
        numero_pedido,
        cliente_id,
        usuario_vendedor,
        fecha_entrega_estimada,
        estado,
        tipo_pedido,
        origen,
        subtotal,
        total,
        total_final,
        observaciones,
        turno,
        zona_id,
        metodos_pago,
        recargo_total,
        pago_estado
    ) VALUES (
        v_numero_pedido,
        v_cliente_id,
        v_usuario_vendedor,
        v_fecha_entrega,
        'preparando',
        'venta',
        'presupuesto',
        v_total_items,
        v_total_con_recargo,
        v_total_con_recargo,
        v_observaciones,
        v_turno,
        v_zona_id,
        v_metodos_pago,
        v_recargo_total,
        'pendiente'
    ) RETURNING id INTO v_pedido_id;

    -- Insertar detalles del pedido de todos los presupuestos
    FOR v_presupuesto IN 
        SELECT * FROM presupuestos WHERE id = ANY(p_presupuestos_ids)
    LOOP
        FOR v_item IN
            SELECT *
            FROM presupuesto_items
            WHERE presupuesto_id = v_presupuesto.id
        LOOP
            v_cantidad_a_consumir := CASE
                WHEN v_item.pesable THEN COALESCE(v_item.peso_final, v_item.cantidad_solicitada)
                ELSE v_item.cantidad_solicitada
            END;

            INSERT INTO detalles_pedido (
                pedido_id,
                producto_id,
                lote_id,
                cantidad,
                precio_unitario,
                subtotal,
                peso_final,
                precio_unit_final
            ) VALUES (
                v_pedido_id,
                v_item.producto_id,
                v_item.lote_reservado_id,
                v_cantidad_a_consumir,
                COALESCE(v_item.precio_unit_final, v_item.precio_unit_est),
                COALESCE(v_item.subtotal_final, v_item.subtotal_est),
                CASE WHEN v_item.pesable THEN v_cantidad_a_consumir ELSE NULL END,
                v_item.precio_unit_final
            );

            -- Descontar stock físico si hay lote reservado
            IF v_item.lote_reservado_id IS NOT NULL THEN
                UPDATE lotes
                SET cantidad_disponible = cantidad_disponible - v_cantidad_a_consumir,
                    updated_at = NOW()
                WHERE id = v_item.lote_reservado_id;
            END IF;
        END LOOP;

        -- Actualizar reservas de stock a consumidas
        UPDATE stock_reservations
        SET estado = 'consumida'
        WHERE presupuesto_id = v_presupuesto.id;

        -- Actualizar presupuesto a facturado
        UPDATE presupuestos
        SET estado = 'facturado',
            pedido_convertido_id = v_pedido_id,
            total_final = (
                SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
                FROM presupuesto_items
                WHERE presupuesto_id = v_presupuesto.id
            ) + COALESCE(v_presupuesto.recargo_total, 0),
            updated_at = NOW()
        WHERE id = v_presupuesto.id;

        -- Agregar a la lista de procesados
        v_presupuestos_procesados := array_append(v_presupuestos_procesados, v_presupuesto.id);
    END LOOP;

    -- Si no hay caja_id, registrar en cuenta corriente
    IF p_caja_id IS NULL THEN
        v_cuenta_id := fn_asegurar_cuenta_corriente(v_cliente_id);

        UPDATE cuentas_corrientes
        SET saldo = saldo + v_total_con_recargo,
            updated_at = NOW()
        WHERE id = v_cuenta_id;

        INSERT INTO cuentas_movimientos (
            cuenta_corriente_id,
            tipo,
            monto,
            descripcion,
            origen_tipo,
            origen_id
        ) VALUES (
            v_cuenta_id,
            'cargo',
            v_total_con_recargo,
            'Pedido consolidado ' || v_numero_pedido || ' (' || array_length(p_presupuestos_ids, 1) || ' presupuestos)',
            'pedido',
            v_pedido_id
        );

        UPDATE clientes
        SET bloqueado_por_deuda = true
        WHERE id = v_cliente_id;

        v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        v_instruccion_repartidor := 'Cobrar al cliente: $' || v_total_con_recargo::TEXT || ' - Ref: ' || v_referencia_pago;

        UPDATE pedidos
        SET referencia_pago = v_referencia_pago,
            instruccion_repartidor = v_instruccion_repartidor
        WHERE id = v_pedido_id;
    END IF;

    -- Asignar a ruta planificada si existe
    IF v_zona_id IS NOT NULL AND v_turno IS NOT NULL THEN
        v_asign_result := fn_asignar_pedido_a_ruta(
            v_pedido_id,
            v_fecha_entrega,
            v_zona_id,
            v_turno
        );

        IF (v_asign_result->>'success')::BOOLEAN IS TRUE THEN
            v_ruta_id := (v_asign_result->>'ruta_id')::UUID;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'presupuestos_procesados', v_presupuestos_procesados,
        'total_items', v_total_items,
        'total_con_recargo', v_total_con_recargo,
        'ruta_id', v_ruta_id,
        'referencia_pago', v_referencia_pago,
        'instruccion_repartidor', v_instruccion_repartidor
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al convertir presupuestos: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_convertir_presupuestos_agrupados_a_pedido(UUID[], UUID, UUID) IS 
'Convierte múltiples presupuestos en un solo pedido consolidado. Los presupuestos deben ser del mismo cliente, turno, zona y fecha de entrega.';

COMMIT;

