-- =====================================================
-- Función para crear pedido desde WhatsApp con descuento automático de stock
-- =====================================================

-- Primero eliminar la función si existe
DROP FUNCTION IF EXISTS fn_crear_pedido_bot(UUID, JSONB, TEXT);

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
    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

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

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION fn_crear_pedido_bot(UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION fn_crear_pedido_bot(UUID, JSONB, TEXT) TO authenticated;

