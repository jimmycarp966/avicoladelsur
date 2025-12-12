-- ===========================================
-- MIGRACIÓN: Mejora UX Venta Mayorista en Presupuestos
-- Fecha: 16/12/2025
-- Objetivo:
--   Actualizar la función fn_convertir_presupuesto_a_pedido
--   para mostrar mejor aclaración en movimientos de stock
-- ===========================================

BEGIN;

-- ===========================================
-- 1. ACTUALIZAR fn_convertir_presupuesto_a_pedido
--    Para mostrar aclaración más clara en movimientos
-- ===========================================

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
    v_cantidad_stock DECIMAL(12,3); -- Cantidad real a descontar del stock (en kg)
    v_caja_movimiento_id UUID;
    v_cuenta_id UUID;
    v_referencia_pago VARCHAR(60);
    v_instruccion_repartidor TEXT;
    v_turno TEXT;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_lista_tipo VARCHAR(50);
    v_es_venta_mayor BOOLEAN;
    v_unidad_venta VARCHAR(50);
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

    -- Si no hay lista en presupuesto, buscar la del cliente
    IF v_lista_tipo IS NULL THEN
        SELECT lp.tipo INTO v_lista_tipo
        FROM clientes_listas_precios clp
        INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
        WHERE clp.cliente_id = v_presupuesto.cliente_id
          AND lp.activa = true
        ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
        LIMIT 1;
    END IF;

    -- Determinar si es venta por mayor
    v_es_venta_mayor := v_lista_tipo IN ('mayorista', 'distribuidor');

    -- Determinar turno
    IF v_presupuesto.turno IS NULL THEN
        v_turno := CASE
            WHEN EXTRACT(HOUR FROM v_now_ba) < 6 THEN 'mañana'
            ELSE 'tarde'
        END;

        UPDATE presupuestos
        SET turno = v_turno, updated_at = NOW()
        WHERE id = p_presupuesto_id;
    ELSE
        v_turno := v_presupuesto.turno;
    END IF;

    -- Verificar pesables pendientes
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id AND pesable = true;

    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id AND pesable = true AND peso_final IS NOT NULL;

    IF v_presupuesto.estado = 'pendiente' AND v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este presupuesto tiene productos balanza que deben pesarse en almacén');
    END IF;

    -- Calcular totales
    SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
    INTO v_total_items
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id;

    v_total_con_recargo := v_total_items + COALESCE(v_presupuesto.recargo_total, 0);

    -- Generar número de pedido
    v_numero_pedido := fn_obtener_siguiente_numero('pedido');

    -- Crear pedido principal
    INSERT INTO pedidos (
        numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
        estado, tipo_pedido, origen, subtotal, total, total_final,
        observaciones, presupuesto_id, lista_precio_id, turno, zona_id,
        metodos_pago, recargo_total, pago_estado
    ) VALUES (
        v_numero_pedido, v_presupuesto.cliente_id, v_presupuesto.usuario_vendedor,
        v_presupuesto.fecha_entrega_estimada, 'preparando', 'venta', 'presupuesto',
        v_total_items, v_total_con_recargo, v_total_con_recargo,
        v_presupuesto.observaciones, p_presupuesto_id, v_presupuesto.lista_precio_id,
        v_turno, v_presupuesto.zona_id, v_presupuesto.metodos_pago,
        COALESCE(v_presupuesto.recargo_total, 0), 'pendiente'
    ) RETURNING id INTO v_pedido_id;

    -- Insertar detalles del pedido
    FOR v_item IN
        SELECT * FROM presupuesto_items WHERE presupuesto_id = p_presupuesto_id
    LOOP
        -- Obtener producto con campos de venta por mayor
        SELECT
            id, unidad_medida,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(kg_por_unidad_mayor, 20) as kg_por_unidad_mayor,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre
        INTO v_producto
        FROM productos
        WHERE id = v_item.producto_id;

        -- Calcular cantidad a consumir (del presupuesto)
        v_cantidad_a_consumir := CASE
            WHEN v_item.pesable THEN COALESCE(v_item.peso_final, v_item.cantidad_solicitada)
            ELSE v_item.cantidad_solicitada
        END;

        -- =====================================================
        -- LÓGICA DE CONVERSIÓN PARA VENTA POR MAYOR
        -- =====================================================
        IF v_es_venta_mayor
           AND v_producto.venta_mayor_habilitada
           AND v_producto.unidad_medida = 'kg' THEN
            -- La cantidad del presupuesto representa unidades mayores (cajas)
            -- Convertir a kg para descontar del stock
            v_cantidad_stock := v_cantidad_a_consumir * v_producto.kg_por_unidad_mayor;
            v_unidad_venta := v_producto.unidad_mayor_nombre;
        ELSE
            -- Venta normal: la cantidad ya está en la unidad base
            v_cantidad_stock := v_cantidad_a_consumir;
            v_unidad_venta := v_producto.unidad_medida;
        END IF;

        INSERT INTO detalles_pedido (
            pedido_id, producto_id, lote_id, cantidad,
            precio_unitario, subtotal, peso_final, precio_unit_final
        ) VALUES (
            v_pedido_id, v_item.producto_id, v_item.lote_reservado_id,
            v_cantidad_stock, -- Usar cantidad convertida a kg
            COALESCE(v_item.precio_unit_final, v_item.precio_unit_est),
            COALESCE(v_item.subtotal_final, v_item.subtotal_est),
            CASE WHEN v_item.pesable THEN v_cantidad_stock ELSE NULL END,
            v_item.precio_unit_final
        );

        -- Descontar stock del lote asociado - USANDO v_cantidad_stock (kg)
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
            'Pedido ' || v_numero_pedido, 'pedido', v_pedido_id
        );

        UPDATE clientes SET bloqueado_por_deuda = true WHERE id = v_presupuesto.cliente_id;

        v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        v_instruccion_repartidor := 'Cobrar al cliente: $' || v_total_con_recargo::TEXT || ' - Ref: ' || v_referencia_pago;

        UPDATE pedidos
        SET referencia_pago = v_referencia_pago, instruccion_repartidor = v_instruccion_repartidor
        WHERE id = v_pedido_id;
    END IF;

    -- Registrar movimiento de caja si corresponde
    IF p_caja_id IS NOT NULL THEN
        INSERT INTO tesoreria_movimientos (
            caja_id, tipo, monto, descripcion, origen_tipo, origen_id, user_id
        ) VALUES (
            p_caja_id, 'ingreso', v_total_con_recargo,
            'Cobro por pedido ' || v_numero_pedido, 'pedido', v_pedido_id, p_user_id
        ) RETURNING id INTO v_caja_movimiento_id;

        UPDATE tesoreria_cajas
        SET saldo_actual = saldo_actual + v_total_con_recargo, updated_at = NOW()
        WHERE id = p_caja_id;

        UPDATE pedidos
        SET pago_estado = 'pagado', caja_movimiento_id = v_caja_movimiento_id
        WHERE id = v_pedido_id;
    END IF;

    PERFORM fn_asignar_pedido_a_ruta(v_pedido_id);

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total_con_recargo,
        'es_venta_mayor', v_es_venta_mayor
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
'Convierte presupuesto a pedido con soporte para venta por mayor.
Si el cliente tiene lista mayorista y el producto tiene venta_mayor_habilitada,
convierte automáticamente las unidades (cajas) a kg para descontar stock.
Muestra aclaración clara en movimientos: (X unidad_mayor)';

COMMIT;



