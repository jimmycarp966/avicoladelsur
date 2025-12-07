-- ===========================================
-- MIGRACIÓN: Validar límite de crédito al convertir presupuesto a pedido
-- Fecha: 04/12/2025
-- Descripción: Agrega validación de límite de crédito antes de generar deuda
--              cuando se convierte un presupuesto a pedido sin pago anticipado
-- ===========================================

BEGIN;

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_convertir_presupuesto_a_pedido
-- ===========================================
-- Agregar validación de límite de crédito antes de generar deuda en cuenta corriente

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
    -- Variables para validación de límite de crédito
    v_saldo_actual DECIMAL(12,2);
    v_limite_credito DECIMAL(12,2);
    v_cliente_bloqueado BOOLEAN;
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

    -- Verificar si el cliente está bloqueado por deuda
    SELECT bloqueado_por_deuda INTO v_cliente_bloqueado
    FROM clientes
    WHERE id = v_presupuesto.cliente_id;

    IF v_cliente_bloqueado THEN
        RETURN jsonb_build_object('success', false, 'error', 'El cliente está bloqueado por deuda. No se puede convertir el presupuesto.');
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

    -- VALIDACIÓN DE LÍMITE DE CRÉDITO (si no hay pago anticipado)
    IF p_caja_id IS NULL THEN
        -- Asegurar que existe cuenta corriente
        v_cuenta_id := fn_asegurar_cuenta_corriente(v_presupuesto.cliente_id);
        
        -- Obtener saldo actual y límite de crédito
        SELECT saldo, limite_credito INTO v_saldo_actual, v_limite_credito
        FROM cuentas_corrientes
        WHERE id = v_cuenta_id;

        -- Validar que el cliente no supere el límite de crédito
        IF (COALESCE(v_saldo_actual, 0) + v_total_con_recargo) > COALESCE(v_limite_credito, 0) THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 
                'El cliente supera el límite de crédito disponible. Saldo actual: $' || 
                COALESCE(v_saldo_actual, 0)::TEXT || 
                ', Límite: $' || COALESCE(v_limite_credito, 0)::TEXT ||
                ', Total pedido: $' || v_total_con_recargo::TEXT
            );
        END IF;
    END IF;

    -- Generar número de pedido secuencial
    v_numero_pedido := fn_obtener_siguiente_numero('pedido');

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
        lista_precio_id,
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
        v_presupuesto.lista_precio_id,
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
        -- v_cuenta_id ya fue obtenido en la validación anterior
        -- v_saldo_actual y v_limite_credito ya fueron obtenidos

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

        -- Actualizar bloqueo de cliente según nuevo saldo
        UPDATE clientes
        SET bloqueado_por_deuda = CASE
            WHEN (SELECT saldo FROM cuentas_corrientes WHERE id = v_cuenta_id) > limite_credito THEN true
            ELSE false
        END
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

COMMENT ON FUNCTION fn_convertir_presupuesto_a_pedido(UUID, UUID, UUID) IS 
'Convierte presupuesto a pedido con validación de límite de crédito. Si el cliente tiene límite 0 y se intenta generar deuda, retorna error.';

COMMIT;









