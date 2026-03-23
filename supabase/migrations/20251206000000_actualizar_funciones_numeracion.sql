-- ===========================================
-- MIGRACIÓN: Actualizar funciones para usar numeración secuencial
-- Fecha: 06/12/2025
-- Objetivo:
--   Actualizar todas las funciones que generan números
--   para usar el sistema de numeración secuencial
-- ===========================================

BEGIN;

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_convertir_presupuesto_a_pedido
-- ===========================================
-- Esta función ya existe en 20251125_turnos_auto.sql, solo actualizamos la línea 91
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

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_convertir_presupuestos_agrupados_a_pedido
-- ===========================================
-- Actualizar línea 133
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

    -- Generar número de pedido secuencial
    v_numero_pedido := fn_obtener_siguiente_numero('pedido');

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
        pago_estado,
        lista_precio_id
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
        'pendiente',
        v_presupuesto_base.lista_precio_id
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

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_crear_factura_desde_pedido
-- ===========================================
CREATE OR REPLACE FUNCTION fn_crear_factura_desde_pedido(
    p_pedido_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_factura_id UUID;
    v_numero_factura VARCHAR(50);
    v_subtotal DECIMAL(10,2);
    v_descuento DECIMAL(10,2);
    v_total DECIMAL(10,2);
    v_existente UUID;
BEGIN
    IF p_pedido_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido inválido');
    END IF;

    -- Verificar que el pedido exista
    SELECT *
    INTO v_pedido
    FROM pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
    END IF;

    -- Verificar que no exista ya una factura para este pedido
    SELECT id
    INTO v_existente
    FROM facturas
    WHERE pedido_id = p_pedido_id
    LIMIT 1;

    IF v_existente IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success',
            true,
            'factura_id',
            v_existente,
            'warning',
            'El pedido ya tiene una factura creada'
        );
    END IF;

    -- Determinar totales desde el pedido
    v_subtotal := COALESCE(v_pedido.subtotal, 0);
    v_descuento := COALESCE(v_pedido.descuento, 0);
    v_total := COALESCE(v_pedido.total, 0);

    -- Generar número de factura secuencial
    v_numero_factura := fn_obtener_siguiente_numero('factura');

    -- Crear factura
    INSERT INTO facturas (
        numero_factura,
        cliente_id,
        pedido_id,
        fecha_emision,
        subtotal,
        descuento,
        total,
        estado,
        tipo
    )
    VALUES (
        v_numero_factura,
        v_pedido.cliente_id,
        v_pedido.id,
        NOW(),
        v_subtotal,
        v_descuento,
        v_total,
        'emitida',
        'interna'
    )
    RETURNING id INTO v_factura_id;

    -- Crear items de factura a partir de detalles_pedido
    INSERT INTO factura_items (
        factura_id,
        producto_id,
        cantidad,
        precio_unitario,
        subtotal
    )
    SELECT
        v_factura_id,
        dp.producto_id,
        dp.cantidad,
        dp.precio_unitario,
        dp.subtotal
    FROM detalles_pedido dp
    WHERE dp.pedido_id = v_pedido.id;

    RETURN jsonb_build_object(
        'success',
        true,
        'factura_id',
        v_factura_id,
        'numero_factura',
        v_numero_factura
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success',
            false,
            'error',
            'Error al crear factura desde pedido: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_crear_pedido_bot
-- ===========================================
CREATE OR REPLACE FUNCTION fn_crear_pedido_bot(
    p_cliente_id UUID,
    p_items_json JSONB,
    p_observaciones TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_total DECIMAL(10,2) := 0;
    v_item JSONB;
    v_producto_id UUID;
    v_cantidad_pedida DECIMAL(10,3);
    v_precio_unitario DECIMAL(10,2);
    v_cantidad_restante DECIMAL(10,3);
    v_lote RECORD;
    v_cantidad_a_descontar DECIMAL(10,3);
BEGIN
    -- Generar número de pedido secuencial
    v_numero_pedido := fn_obtener_siguiente_numero('pedido');

    -- Crear el pedido
    INSERT INTO pedidos (
        numero_pedido, 
        cliente_id, 
        origen, 
        estado, 
        observaciones,
        subtotal,
        descuento,
        total
    )
    VALUES (
        v_numero_pedido, 
        p_cliente_id, 
        'whatsapp', 
        'pendiente', 
        p_observaciones,
        0, -- Se actualizará después
        0,
        0  -- Se actualizará después
    )
    RETURNING id INTO v_pedido_id;

    -- Procesar cada item del pedido
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_json)
    LOOP
        v_producto_id := (v_item->>'producto_id')::UUID;
        v_cantidad_pedida := (v_item->>'cantidad')::DECIMAL;
        v_precio_unitario := (v_item->>'precio_unitario')::DECIMAL;
        v_cantidad_restante := v_cantidad_pedida;

        -- Verificar stock total disponible
        IF (SELECT COALESCE(SUM(cantidad_disponible), 0) 
            FROM lotes 
            WHERE producto_id = v_producto_id 
            AND estado = 'disponible'
            AND fecha_vencimiento >= CURRENT_DATE) < v_cantidad_pedida THEN
            
            RAISE EXCEPTION 'Stock insuficiente para el producto';
        END IF;

        -- Descontar de los lotes usando FIFO (primero el que vence primero)
        FOR v_lote IN 
            SELECT id, cantidad_disponible
            FROM lotes
            WHERE producto_id = v_producto_id
            AND estado = 'disponible'
            AND fecha_vencimiento >= CURRENT_DATE
            ORDER BY fecha_vencimiento ASC, fecha_ingreso ASC
        LOOP
            -- Calcular cuánto descontar de este lote
            IF v_cantidad_restante <= 0 THEN
                EXIT; -- Ya se completó el pedido
            END IF;

            IF v_lote.cantidad_disponible >= v_cantidad_restante THEN
                -- Este lote tiene suficiente
                v_cantidad_a_descontar := v_cantidad_restante;
            ELSE
                -- Usar todo lo disponible de este lote
                v_cantidad_a_descontar := v_lote.cantidad_disponible;
            END IF;

            -- Descontar del lote
            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_cantidad_a_descontar,
                updated_at = NOW()
            WHERE id = v_lote.id;

            -- Registrar en movimientos de stock
            INSERT INTO movimientos_stock (
                lote_id,
                tipo_movimiento,
                cantidad,
                motivo,
                pedido_id,
                usuario_id
            ) VALUES (
                v_lote.id,
                'salida',
                v_cantidad_a_descontar,
                'Venta desde WhatsApp Bot',
                v_pedido_id,
                (SELECT id FROM usuarios WHERE activo = true LIMIT 1) -- Cualquier usuario activo
            );

            -- Crear detalle del pedido (un registro por cada lote usado)
            INSERT INTO detalles_pedido (
                pedido_id,
                producto_id,
                lote_id,
                cantidad,
                precio_unitario,
                descuento,
                subtotal
            ) VALUES (
                v_pedido_id,
                v_producto_id,
                v_lote.id,
                v_cantidad_a_descontar,
                v_precio_unitario,
                0,
                v_cantidad_a_descontar * v_precio_unitario
            );

            -- Actualizar cantidad restante
            v_cantidad_restante := v_cantidad_restante - v_cantidad_a_descontar;
            
            -- Actualizar total
            v_total := v_total + (v_cantidad_a_descontar * v_precio_unitario);
        END LOOP;

        -- Verificar que se pudo completar el pedido
        IF v_cantidad_restante > 0 THEN
            RAISE EXCEPTION 'No se pudo completar el pedido, stock insuficiente';
        END IF;
    END LOOP;

    -- Actualizar totales del pedido
    UPDATE pedidos 
    SET total = v_total, 
        subtotal = v_total,
        updated_at = NOW()
    WHERE id = v_pedido_id;

    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total
    );

EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, PostgreSQL hace rollback automático
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
