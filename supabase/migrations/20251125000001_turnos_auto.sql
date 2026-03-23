-- ===========================================
-- AJUSTE: Turnos automáticos al convertir presupuesto a pedido
-- Fecha: 2025-11-25
-- Descripción:
--   - Si el presupuesto no tiene turno definido, se asigna automáticamente
--     según la hora local (<= 06:00 → mañana, > 06:00 → tarde)
--   - Se permite convertir presupuestos sin turno (solo se exige zona)
-- ===========================================

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
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
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
BEGIN
    -- Obtener presupuesto base
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;

    -- Verificar estado válido
    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no está en un estado válido para facturar');
    END IF;

    -- Validar zona (el turno puede autocompletarse)
    IF v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto debe tener zona asignada antes de convertir');
    END IF;

    -- Determinar turno (manual u automático)
    IF v_presupuesto.turno IS NULL THEN
        v_turno := CASE
            WHEN EXTRACT(HOUR FROM v_now_ba) < 6 THEN 'mañana'
            ELSE 'tarde'
        END;

        UPDATE presupuestos
        SET turno = v_turno,
            updated_at = NOW()
        WHERE id = p_presupuesto_id;
    ELSE
        v_turno := v_presupuesto.turno;
    END IF;

    -- Verificar pesables pendientes
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true;

    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true
      AND peso_final IS NOT NULL;

    IF v_presupuesto.estado = 'pendiente' AND v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este presupuesto tiene productos balanza que deben pesarse en almacén');
    END IF;

    -- Calcular totales antes de insertar
    SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
    INTO v_total_items
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id;

    v_total_con_recargo := v_total_items + COALESCE(v_presupuesto.recargo_total, 0);

    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido principal
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
        presupuesto_id,
        turno,
        zona_id,
        metodos_pago,
        recargo_total,
        pago_estado
    ) VALUES (
        v_numero_pedido,
        v_presupuesto.cliente_id,
        v_presupuesto.usuario_vendedor,
        v_presupuesto.fecha_entrega_estimada,
        'preparando',
        'venta',
        'presupuesto',
        v_total_items,
        v_total_con_recargo,
        v_total_con_recargo,
        v_presupuesto.observaciones,
        p_presupuesto_id,
        v_turno,
        v_presupuesto.zona_id,
        v_presupuesto.metodos_pago,
        COALESCE(v_presupuesto.recargo_total, 0),
        'pendiente'
    ) RETURNING id INTO v_pedido_id;

    -- Insertar detalles del pedido usando pesos finales cuando aplique
    FOR v_item IN
        SELECT *
        FROM presupuesto_items
        WHERE presupuesto_id = p_presupuesto_id
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

        -- Descontar stock del lote asociado (si aplica)
        IF v_item.lote_reservado_id IS NOT NULL THEN
            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_cantidad_a_consumir
            WHERE id = v_item.lote_reservado_id;

            INSERT INTO movimientos_stock (
                lote_id,
                tipo_movimiento,
                cantidad,
                motivo,
                usuario_id,
                pedido_id
            ) VALUES (
                v_item.lote_reservado_id,
                'salida',
                v_cantidad_a_consumir,
                'Conversión de presupuesto a pedido',
                p_user_id,
                v_pedido_id
            );
        END IF;
    END LOOP;

    -- Marcar reservas preventivas como consumidas
    UPDATE stock_reservations
    SET estado = 'consumida'
    WHERE presupuesto_id = p_presupuesto_id;

    -- Actualizar presupuesto
    UPDATE presupuestos
    SET estado = 'facturado',
        pedido_convertido_id = v_pedido_id,
        total_final = v_total_con_recargo,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    -- Registrar deuda en cuenta corriente cuando no hay pago anticipado
    IF p_caja_id IS NULL THEN
        v_cuenta_id := fn_asegurar_cuenta_corriente(v_presupuesto.cliente_id);

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
            'Pedido ' || v_numero_pedido,
            'pedido',
            v_pedido_id
        );

        UPDATE clientes
        SET bloqueado_por_deuda = true
        WHERE id = v_presupuesto.cliente_id;

        v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        v_instruccion_repartidor := 'Cobrar al cliente: $' || v_total_con_recargo::TEXT || ' - Ref: ' || v_referencia_pago;

        UPDATE pedidos
        SET referencia_pago = v_referencia_pago,
            instruccion_repartidor = v_instruccion_repartidor
        WHERE id = v_pedido_id;
    END IF;

    -- Registrar movimiento de caja si corresponde (prepagos)
    IF p_caja_id IS NOT NULL THEN
        INSERT INTO tesoreria_movimientos (
            caja_id,
            tipo,
            monto,
            descripcion,
            origen_tipo,
            origen_id,
            user_id
        ) VALUES (
            p_caja_id,
            'ingreso',
            v_total_con_recargo,
            'Cobro por pedido ' || v_numero_pedido,
            'pedido',
            v_pedido_id,
            p_user_id
        )
        RETURNING id INTO v_caja_movimiento_id;

        UPDATE tesoreria_cajas
        SET saldo_actual = saldo_actual + v_total_con_recargo,
            updated_at = NOW()
        WHERE id = p_caja_id;

        UPDATE pedidos
        SET pago_estado = 'pagado',
            caja_movimiento_id = v_caja_movimiento_id
        WHERE id = v_pedido_id;
    END IF;

    PERFORM fn_asignar_pedido_a_ruta(v_pedido_id);

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total_con_recargo
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

