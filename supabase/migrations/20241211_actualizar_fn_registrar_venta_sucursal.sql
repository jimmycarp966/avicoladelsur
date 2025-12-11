-- ===========================================
-- MIGRACIÓN: Actualizar fn_registrar_venta_sucursal para aceptar lista_precio_id por item
-- Fecha: 11/12/2024
-- Descripción: Actualizar función para usar lista_precio_id por item en lugar de global
-- ===========================================

BEGIN;

-- Eliminar todas las versiones de la función anterior (necesario para cambiar orden de parámetros)
-- Usar bloque DO para eliminar dinámicamente todas las sobrecargas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc 
        WHERE proname = 'fn_registrar_venta_sucursal'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;

-- Actualizar función fn_registrar_venta_sucursal para usar lista_precio_id por item
CREATE OR REPLACE FUNCTION fn_registrar_venta_sucursal(
    p_sucursal_id UUID,
    p_cliente_id UUID,
    p_usuario_id UUID,
    p_items JSONB,
    p_lista_precio_id UUID DEFAULT NULL, -- Opcional, solo para compatibilidad (mover después de p_items)
    p_pago JSONB DEFAULT NULL,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(60);
    v_item JSONB;
    v_producto RECORD;
    v_cantidad DECIMAL(10,3);
    v_precio_unitario DECIMAL(10,2);
    v_costo_unitario DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_total DECIMAL(10,2) := 0;
    v_costo_total DECIMAL(10,2) := 0;
    v_margen_total DECIMAL(10,2) := 0;
    v_lista_tipo VARCHAR(50);
    v_lista_precio_id_item UUID;
    v_lote RECORD;
    v_pendiente DECIMAL(10,3);
    v_utiliza DECIMAL(10,3);
    v_cantidad_total DECIMAL(10,3) := 0;
    v_pago_item JSONB;
    v_total_pagos DECIMAL(10,2) := 0;
    v_caja_movimiento_id UUID;
BEGIN
    -- Validar parámetros
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'La venta debe tener items');
    END IF;

    -- Generar número de pedido
    v_numero_pedido := 'VTA-SUC-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido (usar primera lista del primer item si existe, sino NULL)
    INSERT INTO pedidos (
        numero_pedido,
        cliente_id,
        sucursal_id,
        usuario_vendedor,
        usuario_cajero_id,
        lista_precio_id,
        estado,
        tipo_pedido,
        origen,
        subtotal,
        total,
        pago_estado,
        fecha_pedido
    ) VALUES (
        v_numero_pedido,
        p_cliente_id,
        p_sucursal_id,
        p_usuario_id,
        p_usuario_id,
        COALESCE(
            (SELECT (item->>'lista_precio_id')::UUID 
             FROM jsonb_array_elements(p_items) AS item
             WHERE (item->>'lista_precio_id') IS NOT NULL 
               AND (item->>'lista_precio_id') != 'null'
               AND (item->>'lista_precio_id') != ''
             LIMIT 1),
            p_lista_precio_id
        ), -- Usar lista del primer item o la global
        'completado',
        'venta',
        'sucursal',
        0,
        0,
        COALESCE(p_pago->>'estado', 'pendiente'),
        NOW()
    ) RETURNING id INTO v_pedido_id;

    -- Procesar cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener lista_precio_id del item (si existe) o usar la global
        IF (v_item->>'lista_precio_id') IS NOT NULL AND (v_item->>'lista_precio_id') != 'null' AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := p_lista_precio_id;
        END IF;

        -- Obtener producto
        SELECT * INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'producto_id';
        END IF;

        v_cantidad := (v_item->>'cantidad')::DECIMAL;
        
        -- Obtener precio: usar precio_unitario del JSON si está presente, sino calcular desde lista
        IF (v_item->>'precio_unitario') IS NOT NULL AND (v_item->>'precio_unitario')::DECIMAL > 0 THEN
            v_precio_unitario := (v_item->>'precio_unitario')::DECIMAL;
        ELSE
            -- Si hay lista_precio_id, calcular precio desde la lista
            IF v_lista_precio_id_item IS NOT NULL THEN
                v_precio_unitario := fn_obtener_precio_producto(v_lista_precio_id_item, v_producto.id);
            ELSE
                -- Fallback: usar precio_venta del producto
                v_precio_unitario := v_producto.precio_venta;
            END IF;
        END IF;

        -- Obtener costo promedio
        v_costo_unitario := fn_obtener_costo_promedio_sucursal(p_sucursal_id, v_producto.id);

        v_subtotal := v_cantidad * v_precio_unitario;
        v_total := v_total + v_subtotal;
        v_costo_total := v_costo_total + (v_cantidad * v_costo_unitario);
        v_cantidad_total := v_cantidad_total + v_cantidad;

        -- Descontar stock FIFO
        v_pendiente := v_cantidad;
        FOR v_lote IN
            SELECT * FROM lotes
            WHERE producto_id = v_producto.id
              AND sucursal_id = p_sucursal_id
              AND estado = 'disponible'
              AND cantidad_disponible > 0
            ORDER BY fecha_vencimiento NULLS LAST, fecha_ingreso
            FOR UPDATE
        LOOP
            EXIT WHEN v_pendiente <= 0;

            v_utiliza := LEAST(v_lote.cantidad_disponible, v_pendiente);

            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_utiliza,
                updated_at = NOW()
            WHERE id = v_lote.id;

            -- Registrar movimiento de stock
            INSERT INTO movimientos_stock (
                lote_id,
                tipo_movimiento,
                cantidad,
                motivo,
                usuario_id,
                pedido_id
            ) VALUES (
                v_lote.id,
                'salida',
                v_utiliza,
                'Venta sucursal ' || v_numero_pedido,
                p_usuario_id,
                v_pedido_id
            );

            -- Insertar detalle del pedido con lista_precio_id por item
            INSERT INTO detalles_pedido (
                pedido_id,
                producto_id,
                lote_id,
                cantidad,
                precio_unitario,
                subtotal,
                costo_unitario,
                margen_bruto,
                lista_precio_id,
                tipo_lista
            ) VALUES (
                v_pedido_id,
                v_producto.id,
                v_lote.id,
                v_utiliza,
                v_precio_unitario,
                v_utiliza * v_precio_unitario,
                COALESCE(v_lote.costo_unitario, v_costo_unitario),
                (v_precio_unitario - COALESCE(v_lote.costo_unitario, v_costo_unitario)) * v_utiliza,
                v_lista_precio_id_item, -- Lista individual por item
                COALESCE((SELECT tipo FROM listas_precios WHERE id = v_lista_precio_id_item), 'N/A')
            );

            v_pendiente := v_pendiente - v_utiliza;
        END LOOP;

        -- Si aún queda pendiente (sin stock), registrar como pendiente
        IF v_pendiente > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %: solicitado %, disponible %', 
                v_producto.nombre, v_cantidad, (v_cantidad - v_pendiente);
        END IF;
    END LOOP;

    -- Actualizar totales del pedido
    UPDATE pedidos
    SET subtotal = v_total,
        total = v_total
    WHERE id = v_pedido_id;

    v_margen_total := v_total - v_costo_total;

    -- Obtener tipo de lista para auditoría (usar la primera lista encontrada)
    SELECT tipo INTO v_lista_tipo
    FROM listas_precios
    WHERE id IN (
        SELECT DISTINCT (item->>'lista_precio_id')::UUID
        FROM jsonb_array_elements(p_items) item
        WHERE (item->>'lista_precio_id') IS NOT NULL
        LIMIT 1
    )
    OR id = p_lista_precio_id
    LIMIT 1;

    -- Registrar en auditoría (solo si hay lista Y cliente)
    -- Las ventas genéricas sin cliente no se registran en auditoría
    IF v_lista_precio_id_item IS NOT NULL AND p_cliente_id IS NOT NULL THEN
        INSERT INTO auditoria_listas_precios (
            sucursal_id,
            usuario_id,
            cliente_id,
            pedido_id,
            lista_precio_id,
            tipo_lista,
            cantidad_total,
            monto_total,
            fecha_venta
        ) VALUES (
            p_sucursal_id,
            p_usuario_id,
            p_cliente_id,
            v_pedido_id,
            v_lista_precio_id_item,
            COALESCE(v_lista_tipo, 'N/A'),
            v_cantidad_total,
            v_total,
            NOW()
        );
    END IF;

    -- Procesar pagos si están presentes
    IF p_pago IS NOT NULL AND p_caja_id IS NOT NULL THEN
        -- Calcular total de pagos
        IF jsonb_typeof(p_pago->'pagos') = 'array' THEN
            -- Multipago
            FOR v_pago_item IN SELECT * FROM jsonb_array_elements(p_pago->'pagos')
            LOOP
                v_total_pagos := v_total_pagos + COALESCE((v_pago_item->>'monto')::DECIMAL, 0);
            END LOOP;
        ELSIF p_pago->>'monto' IS NOT NULL THEN
            -- Pago único (compatibilidad)
            v_total_pagos := (p_pago->>'monto')::DECIMAL;
        END IF;

        -- Solo procesar si hay pagos y coinciden con el total (o están cerca)
        IF v_total_pagos > 0 AND ABS(v_total_pagos - v_total) < 0.01 THEN
            -- Crear movimiento de caja
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
                v_total_pagos,
                'Venta sucursal - ' || v_numero_pedido,
                'pedido',
                v_pedido_id,
                p_usuario_id
            )
            RETURNING id INTO v_caja_movimiento_id;

            -- Actualizar saldo de caja
            UPDATE tesoreria_cajas
            SET saldo_actual = saldo_actual + v_total_pagos,
                updated_at = NOW()
            WHERE id = p_caja_id;

            -- Vincular movimiento al pedido y marcar como pagado
            UPDATE pedidos
            SET pago_estado = 'pagado',
                caja_movimiento_id = v_caja_movimiento_id
            WHERE id = v_pedido_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total,
        'costo_total', v_costo_total,
        'margen_bruto', v_margen_total,
        'tipo_lista', COALESCE(v_lista_tipo, 'N/A')
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

