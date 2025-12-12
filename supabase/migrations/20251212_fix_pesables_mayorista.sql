-- ===========================================
-- MIGRACIÓN: Fix validación pesables para venta mayorista
-- Fecha: 12/12/2025
-- Problema: Al convertir presupuesto a pedido, la validación de pesables
--           cuenta items con pesable=true aunque sean de venta mayorista.
--           Los productos mayoristas vienen en caja cerrada y NO necesitan pesarse.
-- Solución: Excluir items mayoristas del conteo de "pesables pendientes".
-- ===========================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_item RECORD;
    v_producto RECORD;
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_total_items DECIMAL(12,2) := 0;
    v_total_con_recargo DECIMAL(12,2) := 0;
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_cantidad_a_consumir DECIMAL(12,3);
    v_cantidad_stock DECIMAL(12,3);
    v_caja_movimiento_id UUID;
    v_cuenta_id UUID;
    v_referencia_pago VARCHAR(60);
    v_instruccion_repartidor TEXT;
    v_turno TEXT;
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_lista_tipo VARCHAR(50);
    v_es_venta_mayor BOOLEAN;
    v_unidad_venta VARCHAR(50);
    v_es_pedido_nuevo BOOLEAN := false;
    v_entrega_id UUID;
    v_orden_entrega INTEGER;
    v_cliente RECORD;
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

    -- Validar zona
    IF v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto debe tener zona asignada antes de convertir');
    END IF;

    -- Obtener tipo de lista del presupuesto o del cliente
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

    v_es_venta_mayor := v_lista_tipo IN ('mayorista', 'distribuidor');

    -- Determinar turno y fecha de entrega
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    IF v_presupuesto.turno IS NULL THEN
        -- Lógica de horarios de corte
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

        UPDATE presupuestos
        SET turno = v_turno,
            fecha_entrega_estimada = v_fecha_entrega,
            updated_at = NOW()
        WHERE id = p_presupuesto_id;
    ELSE
        v_turno := v_presupuesto.turno;
        v_fecha_entrega := COALESCE(v_presupuesto.fecha_entrega_estimada, DATE(v_now_ba));
    END IF;

    -- =====================================================
    -- VERIFICAR PESABLES PENDIENTES
    -- IMPORTANTE: Excluir items de venta mayorista (no requieren pesaje)
    -- Un item es pesable "real" si:
    --   1. Tiene pesable = true
    --   2. NO es venta mayorista (producto.venta_mayor_habilitada = false O lista no es mayorista)
    -- =====================================================
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    WHERE pi.presupuesto_id = p_presupuesto_id 
      AND pi.pesable = true
      -- Excluir si es venta mayorista
      AND NOT (
          v_es_venta_mayor 
          AND COALESCE(p.venta_mayor_habilitada, false) = true
      );

    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    WHERE pi.presupuesto_id = p_presupuesto_id 
      AND pi.pesable = true 
      AND pi.peso_final IS NOT NULL
      -- Excluir si es venta mayorista
      AND NOT (
          v_es_venta_mayor 
          AND COALESCE(p.venta_mayor_habilitada, false) = true
      );

    IF v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'No se puede convertir a pedido: todos los productos pesables deben estar pesados. Faltan ' || 
            (v_total_pesables - v_pesables_pesados) || ' producto(s) por pesar.'
        );
    END IF;

    -- Calcular totales
    SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
    INTO v_total_items
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id;

    v_total_con_recargo := v_total_items + COALESCE(v_presupuesto.recargo_total, 0);

    -- =====================================================
    -- LÓGICA DE PEDIDOS AGRUPADOS
    -- Buscar pedido abierto para turno/zona/fecha
    -- =====================================================
    SELECT id INTO v_pedido_id
    FROM pedidos
    WHERE zona_id = v_presupuesto.zona_id
      AND turno = v_turno
      AND fecha_entrega_estimada = v_fecha_entrega
      AND estado_cierre = 'abierto'
    LIMIT 1;
    
    -- Si no existe pedido abierto, crear uno nuevo
    IF v_pedido_id IS NULL THEN
        v_es_pedido_nuevo := true;
        v_numero_pedido := fn_obtener_siguiente_numero('pedido');

        INSERT INTO pedidos (
            numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
            estado, estado_cierre, tipo_pedido, origen, subtotal, total, total_final,
            observaciones, lista_precio_id, turno, zona_id,
            metodos_pago, recargo_total, pago_estado, cantidad_entregas
        ) VALUES (
            v_numero_pedido, NULL, v_presupuesto.usuario_vendedor,
            v_fecha_entrega, 'preparando', 'abierto', 'venta', 'agrupado',
            0, 0, 0,
            NULL, NULL,
            v_turno, v_presupuesto.zona_id, NULL,
            0, 'pendiente', 0
        ) RETURNING id INTO v_pedido_id;
    ELSE
        SELECT numero_pedido INTO v_numero_pedido
        FROM pedidos WHERE id = v_pedido_id;
    END IF;

    -- =====================================================
    -- CREAR ENTREGA PARA ESTE CLIENTE
    -- =====================================================
    SELECT * INTO v_cliente
    FROM clientes
    WHERE id = v_presupuesto.cliente_id;

    -- Obtener el próximo orden de entrega
    SELECT COALESCE(MAX(orden_entrega), 0) + 1 INTO v_orden_entrega
    FROM entregas
    WHERE pedido_id = v_pedido_id;

    -- Generar referencia de pago
    v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    v_instruccion_repartidor := 'Cobrar al cliente ' || v_cliente.nombre || ': $' || 
        v_total_con_recargo::TEXT || ' - Ref: ' || v_referencia_pago;

    -- Crear la entrega
    INSERT INTO entregas (
        pedido_id,
        cliente_id,
        presupuesto_id,
        subtotal,
        recargo,
        total,
        direccion,
        coordenadas,
        orden_entrega,
        estado_entrega,
        estado_pago,
        referencia_pago,
        instruccion_repartidor,
        observaciones
    ) VALUES (
        v_pedido_id,
        v_presupuesto.cliente_id,
        p_presupuesto_id,
        v_total_items,
        COALESCE(v_presupuesto.recargo_total, 0),
        v_total_con_recargo,
        v_cliente.direccion,
        v_cliente.coordenadas,
        v_orden_entrega,
        'pendiente',
        'pendiente',
        v_referencia_pago,
        v_instruccion_repartidor,
        v_presupuesto.observaciones
    ) RETURNING id INTO v_entrega_id;

    -- =====================================================
    -- INSERTAR DETALLES DEL PEDIDO CON LÓGICA VENTA MAYOR
    -- =====================================================
    FOR v_item IN
        SELECT * FROM presupuesto_items WHERE presupuesto_id = p_presupuesto_id
    LOOP
        SELECT
            id, unidad_medida,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(kg_por_unidad_mayor, 20) as kg_por_unidad_mayor,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre
        INTO v_producto
        FROM productos
        WHERE id = v_item.producto_id;

        -- Para venta mayor, la cantidad ya representa cajas, usar directamente
        -- Para venta normal, usar peso_final si es pesable
        v_cantidad_a_consumir := CASE
            WHEN v_es_venta_mayor AND v_producto.venta_mayor_habilitada THEN 
                v_item.cantidad_solicitada  -- Cantidad en cajas
            WHEN v_item.pesable THEN 
                COALESCE(v_item.peso_final, v_item.cantidad_solicitada)
            ELSE 
                v_item.cantidad_solicitada
        END;

        -- Lógica de conversión para venta por mayor
        IF v_es_venta_mayor
           AND v_producto.venta_mayor_habilitada
           AND v_producto.unidad_medida = 'kg' THEN
            v_cantidad_stock := v_cantidad_a_consumir * v_producto.kg_por_unidad_mayor;
            v_unidad_venta := v_producto.unidad_mayor_nombre;
        ELSE
            v_cantidad_stock := v_cantidad_a_consumir;
            v_unidad_venta := v_producto.unidad_medida;
        END IF;

        INSERT INTO detalles_pedido (
            pedido_id, entrega_id, producto_id, lote_id, cantidad,
            precio_unitario, subtotal, peso_final, precio_unit_final
        ) VALUES (
            v_pedido_id, v_entrega_id, v_item.producto_id, v_item.lote_reservado_id,
            v_cantidad_stock,
            COALESCE(v_item.precio_unit_final, v_item.precio_unit_est),
            COALESCE(v_item.subtotal_final, v_item.subtotal_est),
            CASE WHEN v_item.pesable AND NOT (v_es_venta_mayor AND v_producto.venta_mayor_habilitada) 
                 THEN v_cantidad_stock 
                 ELSE NULL 
            END,
            v_item.precio_unit_final
        );

        -- Descontar stock del lote
        IF v_item.lote_reservado_id IS NOT NULL THEN
            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_cantidad_stock
            WHERE id = v_item.lote_reservado_id;

            INSERT INTO movimientos_stock (
                lote_id, tipo_movimiento, cantidad, motivo, usuario_id, pedido_id
            ) VALUES (
                v_item.lote_reservado_id,
                'salida',
                v_cantidad_stock,
                'Conversión presupuesto a pedido ' || v_numero_pedido ||
                CASE WHEN v_cantidad_stock != v_cantidad_a_consumir
                     THEN ' (' || v_cantidad_a_consumir || ' ' || v_unidad_venta || ')'
                     ELSE '' END,
                p_user_id,
                v_pedido_id
            );
        END IF;
    END LOOP;

    -- Marcar reservas como consumidas
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

    -- Actualizar totales del pedido
    UPDATE pedidos
    SET subtotal = subtotal + v_total_items,
        total = total + v_total_con_recargo,
        total_final = total_final + v_total_con_recargo,
        cantidad_entregas = cantidad_entregas + 1,
        updated_at = NOW()
    WHERE id = v_pedido_id;

    -- Registrar deuda en cuenta corriente cuando no hay pago anticipado
    IF p_caja_id IS NULL THEN
        v_cuenta_id := fn_asegurar_cuenta_corriente(v_presupuesto.cliente_id);

        UPDATE cuentas_corrientes
        SET saldo = saldo + v_total_con_recargo, updated_at = NOW()
        WHERE id = v_cuenta_id;

        INSERT INTO cuentas_movimientos (
            cuenta_corriente_id, tipo, monto, descripcion, origen_tipo, origen_id
        ) VALUES (
            v_cuenta_id, 'cargo', v_total_con_recargo,
            'Entrega del pedido ' || v_numero_pedido || ' - Ref: ' || v_referencia_pago, 
            'entrega', v_entrega_id
        );

        UPDATE clientes SET bloqueado_por_deuda = true WHERE id = v_presupuesto.cliente_id;
    END IF;

    -- Registrar movimiento de caja si corresponde
    IF p_caja_id IS NOT NULL THEN
        INSERT INTO tesoreria_movimientos (
            caja_id, tipo, monto, descripcion, origen_tipo, origen_id, user_id
        ) VALUES (
            p_caja_id, 'ingreso', v_total_con_recargo,
            'Cobro por entrega del pedido ' || v_numero_pedido, 'entrega', v_entrega_id, p_user_id
        ) RETURNING id INTO v_caja_movimiento_id;

        UPDATE tesoreria_cajas
        SET saldo_actual = saldo_actual + v_total_con_recargo, updated_at = NOW()
        WHERE id = p_caja_id;

        -- Actualizar estado de pago de la entrega
        UPDATE entregas
        SET estado_pago = 'pagado',
            monto_cobrado = v_total_con_recargo
        WHERE id = v_entrega_id;
    END IF;

    -- NO asignar automáticamente a ruta, se hará manualmente desde el panel de pedidos
    -- PERFORM fn_asignar_pedido_a_ruta(v_pedido_id);

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'entrega_id', v_entrega_id,
        'total', v_total_con_recargo,
        'es_venta_mayor', v_es_venta_mayor,
        'es_pedido_nuevo', v_es_pedido_nuevo,
        'orden_entrega', v_orden_entrega,
        'turno', v_turno,
        'fecha_entrega', v_fecha_entrega,
        'mensaje', CASE 
            WHEN v_es_pedido_nuevo THEN 'Pedido ' || v_numero_pedido || ' creado exitosamente'
            ELSE 'Entrega agregada al pedido ' || v_numero_pedido
        END
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_pedido IS
'Convierte presupuesto a pedido usando lógica de agrupación por turno/zona/fecha.
Múltiples presupuestos del mismo turno/zona/fecha se agregan como entregas al mismo pedido.
Incluye soporte para venta por mayor con conversión automática de unidades.
FIX: Los items mayoristas NO se cuentan como pesables pendientes.';

COMMIT;
