-- ============================================
-- Migración: Corrección de Lógica de Bloqueo por Deuda
-- Fecha: 2025-02-03
-- Descripción:
--   1. Agrega campo limite_credito a tabla clientes
--   2. Modifica fn_agregar_presupuesto_a_pedido para solo bloquear
--      si saldo + nuevo_total > limite_credito
-- ============================================

BEGIN;

-- 1. Agregar campo limite_credito si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'limite_credito'
    ) THEN
        ALTER TABLE clientes ADD COLUMN limite_credito DECIMAL(12,2) DEFAULT 50000;
        COMMENT ON COLUMN clientes.limite_credito IS 'Límite de crédito del cliente para cuenta corriente. Si saldo + nuevo pedido supera este valor, se bloquea automáticamente.';
    END IF;
END $$;

-- 2. Recrear función fn_agregar_presupuesto_a_pedido con lógica corregida
CREATE OR REPLACE FUNCTION fn_agregar_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_pedido_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_total_items DECIMAL(12,2);
    v_recargo DECIMAL(12,2);
    v_total_entrega DECIMAL(12,2);
    v_entrega_id UUID;
    v_item RECORD;
    v_cliente RECORD;
    v_cantidad_a_consumir DECIMAL(12,3);
    v_referencia_pago VARCHAR(60);
    v_instruccion_repartidor TEXT;
    v_cuenta_id UUID;
    v_orden_entrega INTEGER;
    v_saldo_actual DECIMAL(12,2);
    v_nuevo_saldo DECIMAL(12,2);
    v_limite_credito DECIMAL(12,2);
BEGIN
    -- Obtener datos del presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;

    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no está en un estado válido para convertir');
    END IF;

    -- Verificar que el pedido esté abierto
    IF NOT EXISTS (SELECT 1 FROM pedidos WHERE id = p_pedido_id AND estado_cierre = 'abierto') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El pedido ya está cerrado');
    END IF;

    -- Obtener datos del cliente
    SELECT * INTO v_cliente
    FROM clientes
    WHERE id = v_presupuesto.cliente_id;

    -- Calcular totales del presupuesto
    SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
    INTO v_total_items
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id;

    v_recargo := COALESCE(v_presupuesto.recargo_total, 0);
    v_total_entrega := v_total_items + v_recargo;

    -- Obtener el próximo orden de entrega
    SELECT COALESCE(MAX(orden_entrega), 0) + 1 INTO v_orden_entrega
    FROM entregas
    WHERE pedido_id = p_pedido_id;

    -- Generar referencia de pago
    v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    v_instruccion_repartidor := 'Cobrar al cliente ' || v_cliente.nombre || ': $' ||
        v_total_entrega::TEXT || ' - Ref: ' || v_referencia_pago;

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
        p_pedido_id,
        v_presupuesto.cliente_id,
        p_presupuesto_id,
        v_total_items,
        v_recargo,
        v_total_entrega,
        v_cliente.direccion,
        v_cliente.coordenadas,
        v_orden_entrega,
        'pendiente',
        'pendiente',
        v_referencia_pago,
        v_instruccion_repartidor,
        v_presupuesto.observaciones
    ) RETURNING id INTO v_entrega_id;

    -- Procesar items y crear detalles de pedido
    FOR v_item IN
        SELECT * FROM presupuesto_items WHERE presupuesto_id = p_presupuesto_id
    LOOP
        v_cantidad_a_consumir := CASE
            WHEN v_item.pesable THEN COALESCE(v_item.peso_final, v_item.cantidad_solicitada)
            ELSE v_item.cantidad_solicitada
        END;

        -- Insertar detalle del pedido vinculado a la entrega
        INSERT INTO detalles_pedido (
            pedido_id,
            entrega_id,
            producto_id,
            lote_id,
            cantidad,
            precio_unitario,
            subtotal,
            peso_final,
            precio_unit_final
        ) VALUES (
            p_pedido_id,
            v_entrega_id,
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

            -- Registrar movimiento de stock
            INSERT INTO movimientos_stock (
                lote_id, tipo_movimiento, cantidad, motivo, usuario_id, pedido_id
            ) VALUES (
                v_item.lote_reservado_id, 'salida', v_cantidad_a_consumir,
                'Conversión de presupuesto a pedido (entrega)', p_user_id, p_pedido_id
            );
        END IF;
    END LOOP;

    -- Actualizar reservas de stock a consumidas
    UPDATE stock_reservations
    SET estado = 'consumida'
    WHERE presupuesto_id = p_presupuesto_id;

    -- Actualizar presupuesto a facturado
    UPDATE presupuestos
    SET estado = 'facturado',
        pedido_convertido_id = p_pedido_id,
        total_final = v_total_entrega,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    -- Actualizar totales del pedido
    UPDATE pedidos
    SET subtotal = subtotal + v_total_items,
        total = total + v_total_entrega,
        cantidad_entregas = cantidad_entregas + 1,
        updated_at = NOW()
    WHERE id = p_pedido_id;

    -- Registrar en cuenta corriente del cliente
    SELECT fn_asegurar_cuenta_corriente(v_presupuesto.cliente_id) INTO v_cuenta_id;

    UPDATE cuentas_corrientes
    SET saldo = saldo + v_total_entrega,
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
        v_total_entrega,
        'Entrega del pedido - Ref: ' || v_referencia_pago,
        'entrega',
        v_entrega_id
    );

    -- ============================================
    -- CORRECCIÓN: Solo bloquear si saldo supera límite de crédito
    -- ============================================
    -- Obtener saldo actual de la cuenta corriente
    SELECT COALESCE(saldo, 0) INTO v_saldo_actual
    FROM cuentas_corrientes
    WHERE cliente_id = v_presupuesto.cliente_id;

    -- Calcular nuevo saldo después de esta entrega
    v_nuevo_saldo := v_saldo_actual + v_total_entrega;

    -- Obtener límite de crédito del cliente (default 50000 si no está definido)
    v_limite_credito := COALESCE(v_cliente.limite_credito, 50000);

    -- Solo marcar como deudor si el nuevo saldo supera el límite de crédito
    UPDATE clientes
    SET bloqueado_por_deuda = (v_nuevo_saldo > v_limite_credito)
    WHERE id = v_presupuesto.cliente_id;

    RETURN jsonb_build_object(
        'success', true,
        'entrega_id', v_entrega_id,
        'pedido_id', p_pedido_id,
        'cliente_id', v_presupuesto.cliente_id,
        'total_entrega', v_total_entrega,
        'referencia_pago', v_referencia_pago,
        'orden_entrega', v_orden_entrega,
        'saldo_actual', v_nuevo_saldo,
        'limite_credito', v_limite_credito,
        'bloqueado', (v_nuevo_saldo > v_limite_credito)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al agregar presupuesto: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_agregar_presupuesto_a_pedido(UUID, UUID, UUID) IS
'Agrega un presupuesto como entrega dentro de un pedido existente. Crea los detalles, descuenta stock y registra en cuenta corriente. Solo bloquea al cliente si el saldo supera el límite de crédito.';

COMMIT;
