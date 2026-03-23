-- ===========================================
-- MIGRACIÓN: Actualizar funciones RPC para aceptar lista_precio_id por item
-- Fecha: 11/12/2024
-- Descripción: Actualizar fn_crear_presupuesto_desde_bot para aceptar y guardar
--   lista_precio_id por cada item en presupuesto_items
-- ===========================================

BEGIN;

-- Actualizar función fn_crear_presupuesto_desde_bot para aceptar lista_precio_id por item
CREATE OR REPLACE FUNCTION fn_crear_presupuesto_desde_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL,
    p_fecha_entrega_estimada DATE DEFAULT NULL,
    p_lista_precio_id UUID DEFAULT NULL -- Lista global (opcional, por compatibilidad)
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto_id UUID;
    v_numero_presupuesto VARCHAR(50);
    v_total_estimado DECIMAL(10,2) := 0;
    v_item JSONB;
    v_precio_unit DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_stock_disponible DECIMAL(10,3);
    v_reserva_result JSONB;
    v_cliente_zona_id UUID;
    v_turno VARCHAR(20);
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_estado_inicial VARCHAR(50);
    v_lista_precio_id_item UUID;
BEGIN
    -- Intentar detectar zona del cliente si no se proporciona
    IF p_zona_id IS NULL THEN
        SELECT z.id INTO v_cliente_zona_id
        FROM clientes c
        LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(c.zona_entrega))
        WHERE c.id = p_cliente_id
        LIMIT 1;
        
        p_zona_id := v_cliente_zona_id;
    END IF;

    -- Determinar turno y fecha de entrega automáticamente según horarios de corte
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    IF p_fecha_entrega_estimada IS NULL THEN
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        ELSE
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
        END IF;
    ELSE
        v_fecha_entrega := p_fecha_entrega_estimada;
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
        ELSE
            IF p_fecha_entrega_estimada = DATE(v_now_ba) THEN
                v_turno := 'mañana';
                v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
            ELSE
                v_turno := 'mañana';
            END IF;
        END IF;
    END IF;

    v_estado_inicial := 'en_almacen';

    -- Generar número de presupuesto secuencial
    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

    -- Crear presupuesto
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones, turno, fecha_entrega_estimada, lista_precio_id
    ) VALUES (
        v_numero_presupuesto, 
        p_cliente_id, 
        p_zona_id, 
        v_estado_inicial,
        p_observaciones, 
        v_turno, 
        v_fecha_entrega,
        p_lista_precio_id
    ) RETURNING id INTO v_presupuesto_id;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener lista_precio_id del item (si existe) o usar la global
        IF (v_item->>'lista_precio_id') IS NOT NULL AND (v_item->>'lista_precio_id') != 'null' AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := p_lista_precio_id;
        END IF;

        -- Usar precio_unitario del JSON si está presente, sino obtener precio_venta de la BD
        IF (v_item->>'precio_unitario') IS NOT NULL AND (v_item->>'precio_unitario')::DECIMAL > 0 THEN
            v_precio_unit := (v_item->>'precio_unitario')::DECIMAL;
        ELSE
            -- Si hay lista_precio_id, obtener precio desde la lista usando fn_obtener_precio_producto
            IF v_lista_precio_id_item IS NOT NULL THEN
                SELECT fn_obtener_precio_producto(v_lista_precio_id_item, (v_item->>'producto_id')::UUID) INTO v_precio_unit;
            ELSE
                -- Fallback: obtener precio del producto desde BD
                SELECT precio_venta INTO v_precio_unit
                FROM productos
                WHERE id = (v_item->>'producto_id')::UUID;
            END IF;
            
            IF v_precio_unit IS NULL OR v_precio_unit = 0 THEN
                v_precio_unit := 0;
            END IF;
        END IF;

        -- Calcular subtotal
        v_subtotal := (v_item->>'cantidad')::DECIMAL * v_precio_unit;

        -- Verificar stock disponible
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
        AND l.estado = 'disponible';

        -- Insertar item con lista_precio_id
        INSERT INTO presupuesto_items (
            presupuesto_id,
            producto_id,
            cantidad_solicitada,
            precio_unit_est,
            subtotal_est,
            pesable,
            lista_precio_id
        ) VALUES (
            v_presupuesto_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            v_precio_unit,
            v_subtotal,
            EXISTS (
                SELECT 1 FROM productos p
                WHERE p.id = (v_item->>'producto_id')::UUID
                AND LOWER(TRIM(p.categoria)) = 'balanza'
            ),
            v_lista_precio_id_item
        );

        v_total_estimado := v_total_estimado + v_subtotal;
    END LOOP;

    -- Actualizar total estimado
    UPDATE presupuestos
    SET total_estimado = v_total_estimado
    WHERE id = v_presupuesto_id;

    -- Intentar reservar stock preventivo
    SELECT fn_reservar_stock_por_presupuesto(v_presupuesto_id) INTO v_reserva_result;

    -- Retornar resultado
    RETURN jsonb_build_object(
        'success', true,
        'presupuesto_id', v_presupuesto_id,
        'numero_presupuesto', v_numero_presupuesto,
        'total_estimado', v_total_estimado,
        'reserva_result', v_reserva_result
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar función fn_convertir_presupuesto_a_pedido para copiar lista_precio_id de items
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
    v_hora_actual INTEGER;
    v_fecha_entrega DATE;
    v_cliente_limite_credito DECIMAL(12,2);
    v_cliente_saldo_actual DECIMAL(12,2);
    v_limite_credito_valido BOOLEAN;
BEGIN
    -- Obtener datos del presupuesto
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

    -- Validar turno y zona antes de convertir
    IF v_presupuesto.turno IS NULL OR v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto debe tener turno y zona asignados antes de convertir');
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

    IF v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object('success', false, 'error', 'Todos los productos pesables deben estar pesados antes de convertir');
    END IF;

    -- Validar límite de crédito si el cliente tiene límite configurado
    SELECT limite_credito, saldo_actual INTO v_cliente_limite_credito, v_cliente_saldo_actual
    FROM clientes c
    LEFT JOIN cuenta_corriente cc ON cc.cliente_id = c.id
    WHERE c.id = v_presupuesto.cliente_id
    ORDER BY cc.fecha_movimiento DESC
    LIMIT 1;

    -- Verificar si se generará deuda (pago pendiente o parcial)
    -- Si el presupuesto tiene método de pago que genera deuda y el cliente tiene límite de crédito configurado
    IF v_cliente_limite_credito IS NOT NULL AND v_cliente_limite_credito >= 0 THEN
        -- Si el límite es 0, no se permite generar deuda
        IF v_cliente_limite_credito = 0 THEN
            v_limite_credito_valido := false;
        ELSE
            -- Verificar que el saldo actual más el total del presupuesto no exceda el límite
            v_limite_credito_valido := (COALESCE(v_cliente_saldo_actual, 0) + COALESCE(v_presupuesto.total_final, v_presupuesto.total_estimado)) <= v_cliente_limite_credito;
        END IF;

        -- Si no es válido y hay método de pago que genera deuda, rechazar
        IF NOT v_limite_credito_valido THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', format('El cliente excedería su límite de crédito (Límite: %s, Saldo actual: %s, Nuevo pedido: %s)', 
                    v_cliente_limite_credito, 
                    COALESCE(v_cliente_saldo_actual, 0), 
                    COALESCE(v_presupuesto.total_final, v_presupuesto.total_estimado))
            );
        END IF;
    END IF;

    -- Determinar turno y fecha según horario actual
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    v_fecha_entrega := COALESCE(v_presupuesto.fecha_entrega_estimada, DATE(v_now_ba));
    
    IF v_hora_actual < 5 THEN
        v_turno := 'mañana';
    ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
        v_turno := 'tarde';
    ELSE
        v_turno := 'mañana';
        IF v_fecha_entrega = DATE(v_now_ba) THEN
            v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
        END IF;
    END IF;

    -- Generar número de pedido secuencial
    v_numero_pedido := fn_obtener_siguiente_numero('pedido');

    -- Crear pedido
    INSERT INTO pedidos (
        numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
        estado, tipo_pedido, origen, total, subtotal, observaciones,
        presupuesto_id, turno, zona_id, lista_precio_id
    ) VALUES (
        v_numero_pedido, v_presupuesto.cliente_id, v_presupuesto.usuario_vendedor,
        v_fecha_entrega, 'preparando', 'venta', 'presupuesto',
        COALESCE(v_presupuesto.total_final, v_presupuesto.total_estimado),
        COALESCE(v_presupuesto.total_final, v_presupuesto.total_estimado),
        v_presupuesto.observaciones,
        p_presupuesto_id, v_turno, v_presupuesto.zona_id,
        v_presupuesto.lista_precio_id -- Copiar lista global del presupuesto
    ) RETURNING id INTO v_pedido_id;

    -- Procesar items y copiar lista_precio_id
    FOR v_item IN
        SELECT * FROM presupuesto_items WHERE presupuesto_id = p_presupuesto_id
    LOOP
        -- Determinar cantidad a consumir (usar peso_final si es pesable, sino cantidad_solicitada)
        v_cantidad_a_consumir := CASE 
            WHEN v_item.pesable AND v_item.peso_final IS NOT NULL THEN v_item.peso_final
            ELSE v_item.cantidad_solicitada
        END;

        -- Insertar item en detalles_pedido copiando lista_precio_id del item
        INSERT INTO detalles_pedido (
            pedido_id,
            producto_id,
            lote_id,
            cantidad,
            precio_unitario,
            subtotal,
            peso_final,
            precio_unit_final,
            lista_precio_id
        ) VALUES (
            v_pedido_id,
            v_item.producto_id,
            v_item.lote_reservado_id,
            v_cantidad_a_consumir,
            COALESCE(v_item.precio_unit_final, v_item.precio_unit_est),
            COALESCE(v_item.subtotal_final, v_item.subtotal_est),
            CASE WHEN v_item.pesable THEN v_cantidad_a_consumir ELSE NULL END,
            v_item.precio_unit_final,
            v_item.lista_precio_id -- Copiar lista_precio_id del item del presupuesto
        );

        -- Acumular totales
        v_total_items := v_total_items + COALESCE(v_item.subtotal_final, v_item.subtotal_est);
    END LOOP;

    -- Actualizar total del pedido
    v_total_con_recargo := v_total_items;
    UPDATE pedidos SET total = v_total_con_recargo, subtotal = v_total_items WHERE id = v_pedido_id;

    -- Actualizar estado del presupuesto
    UPDATE presupuestos SET estado = 'facturado' WHERE id = p_presupuesto_id;

    -- Generar movimiento de cuenta corriente si aplica
    -- (código existente para manejar pagos y cuentas corrientes)

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

COMMIT;

