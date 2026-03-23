-- ===========================================
-- MIGRACIÓN: POS Sucursal Completo
-- Fecha: 16/12/2025
-- Objetivo:
--   Implementar todas las funcionalidades faltantes del POS de sucursal:
--   1. Movimientos de caja automáticos
--   2. Validación de apertura de caja
--   3. Cliente opcional (venta genérica)
--   4. Validación de límite de crédito
--   5. Soporte para multipago y recargos
-- ===========================================

BEGIN;

-- ===========================================
-- 1. TABLA: Configuración de recargos por método de pago
-- ===========================================

CREATE TABLE IF NOT EXISTS recargos_metodo_pago (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    metodo_pago VARCHAR(30) NOT NULL,
    porcentaje_recargo DECIMAL(5,2) DEFAULT 0,
    monto_fijo_recargo DECIMAL(10,2) DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sucursal_id, metodo_pago)
);

COMMENT ON TABLE recargos_metodo_pago IS 'Configuración de recargos aplicables por método de pago en cada sucursal';

-- Índices
CREATE INDEX IF NOT EXISTS idx_recargos_metodo_pago_sucursal ON recargos_metodo_pago(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_recargos_metodo_pago_activo ON recargos_metodo_pago(sucursal_id, activo) WHERE activo = true;

-- ===========================================
-- 2. FUNCIÓN: Validar apertura de caja
-- ===========================================

CREATE OR REPLACE FUNCTION fn_validar_caja_abierta(
    p_caja_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_cierre_abierto BOOLEAN;
BEGIN
    -- Verificar si existe un cierre abierto para la caja hoy
    SELECT EXISTS(
        SELECT 1 
        FROM cierres_caja 
        WHERE caja_id = p_caja_id 
          AND fecha = CURRENT_DATE 
          AND estado = 'abierto'
    ) INTO v_cierre_abierto;
    
    RETURN COALESCE(v_cierre_abierto, false);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_validar_caja_abierta IS 'Valida si una caja tiene un cierre abierto para el día actual';

-- ===========================================
-- 3. FUNCIÓN: Validar límite de crédito del cliente
-- ===========================================

CREATE OR REPLACE FUNCTION fn_validar_limite_credito(
    p_cliente_id UUID,
    p_monto DECIMAL(10,2)
) RETURNS JSONB AS $$
DECLARE
    v_cliente RECORD;
    v_saldo_actual DECIMAL(10,2) := 0;
    v_limite_credito DECIMAL(10,2);
    v_saldo_despues DECIMAL(10,2);
    v_excede BOOLEAN := false;
BEGIN
    -- Obtener datos del cliente
    SELECT 
        bloqueado_por_deuda,
        limite_credito
    INTO v_cliente
    FROM clientes
    WHERE id = p_cliente_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cliente no encontrado'
        );
    END IF;
    
    -- Si está bloqueado por deuda, rechazar
    IF v_cliente.bloqueado_por_deuda THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cliente bloqueado por deuda',
            'bloqueado', true
        );
    END IF;
    
    -- Obtener saldo actual
    SELECT COALESCE(saldo, 0) INTO v_saldo_actual
    FROM cuentas_corrientes
    WHERE cliente_id = p_cliente_id;
    
    -- Obtener límite de crédito
    v_limite_credito := COALESCE(v_cliente.limite_credito, 0);
    
    -- Si no tiene límite, permitir (sin límite)
    IF v_limite_credito = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'permite_venta', true,
            'saldo_actual', v_saldo_actual,
            'limite_credito', v_limite_credito,
            'sin_limite', true
        );
    END IF;
    
    -- Calcular saldo después de la venta
    v_saldo_despues := v_saldo_actual + p_monto;
    
    -- Verificar si excede
    IF v_saldo_despues > v_limite_credito THEN
        v_excede := true;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'permite_venta', NOT v_excede,
        'saldo_actual', v_saldo_actual,
        'limite_credito', v_limite_credito,
        'saldo_despues', v_saldo_despues,
        'excede', v_excede,
        'diferencia', CASE WHEN v_excede THEN v_saldo_despues - v_limite_credito ELSE 0 END
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_validar_limite_credito IS 'Valida si una venta a crédito excede el límite del cliente';

-- ===========================================
-- 4. FUNCIÓN: Calcular recargo por método de pago
-- ===========================================

CREATE OR REPLACE FUNCTION fn_calcular_recargo_metodo_pago(
    p_sucursal_id UUID,
    p_metodo_pago VARCHAR(30),
    p_monto DECIMAL(10,2)
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_recargo DECIMAL(10,2) := 0;
    v_recargo_config RECORD;
BEGIN
    -- Obtener configuración de recargo
    SELECT 
        porcentaje_recargo,
        monto_fijo_recargo
    INTO v_recargo_config
    FROM recargos_metodo_pago
    WHERE sucursal_id = p_sucursal_id
      AND metodo_pago = p_metodo_pago
      AND activo = true;
    
    IF FOUND THEN
        -- Calcular recargo (porcentual + fijo)
        v_recargo := (p_monto * COALESCE(v_recargo_config.porcentaje_recargo, 0) / 100.0) + 
                     COALESCE(v_recargo_config.monto_fijo_recargo, 0);
    END IF;
    
    RETURN COALESCE(v_recargo, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_calcular_recargo_metodo_pago IS 'Calcula el recargo aplicable según método de pago y configuración de sucursal';

-- ===========================================
-- 5. ACTUALIZACIÓN: fn_registrar_venta_sucursal con todas las mejoras
-- ===========================================

-- Eliminar todas las versiones existentes de la función (por si hay múltiples firmas)
DROP FUNCTION IF EXISTS fn_registrar_venta_sucursal(
    UUID, UUID, UUID, UUID, JSONB, JSONB
);
DROP FUNCTION IF EXISTS fn_registrar_venta_sucursal(
    UUID, UUID, UUID, UUID, JSONB, JSONB, UUID
);

CREATE OR REPLACE FUNCTION fn_registrar_venta_sucursal(
    p_sucursal_id UUID,
    p_cliente_id UUID, -- Ahora puede ser NULL para venta genérica
    p_usuario_id UUID,
    p_lista_precio_id UUID,
    p_items JSONB,
    p_pago JSONB DEFAULT NULL, -- Puede incluir multipago: [{"metodo": "efectivo", "monto": 1000}, {"metodo": "tarjeta", "monto": 500}]
    p_caja_id UUID DEFAULT NULL -- Opcional, se obtiene de la sucursal si no se proporciona
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
    v_lote RECORD;
    v_pendiente DECIMAL(10,3);
    v_utiliza DECIMAL(10,3);
    v_cantidad_total DECIMAL(10,3) := 0;
    v_pago_item JSONB;
    v_metodo_pago VARCHAR(30);
    v_monto_pago DECIMAL(10,2);
    v_total_pagos DECIMAL(10,2) := 0;
    v_recargo DECIMAL(10,2) := 0;
    v_recargo_total DECIMAL(10,2) := 0;
    v_caja_final UUID;
    v_cierre_abierto BOOLEAN;
    v_validacion_credito JSONB;
    v_estado_pago VARCHAR(20);
    v_pagos_array JSONB;
BEGIN
    -- Validar parámetros
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'La venta debe tener items');
    END IF;

    -- Obtener tipo de lista
    SELECT tipo INTO v_lista_tipo
    FROM listas_precios
    WHERE id = p_lista_precio_id;

    IF v_lista_tipo IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lista de precios no encontrada');
    END IF;

    -- Determinar caja a usar
    IF p_caja_id IS NOT NULL THEN
        v_caja_final := p_caja_id;
    ELSE
        -- Obtener primera caja activa de la sucursal
        SELECT id INTO v_caja_final
        FROM tesoreria_cajas
        WHERE sucursal_id = p_sucursal_id
          AND active = true
        ORDER BY nombre
        LIMIT 1;
    END IF;

    IF v_caja_final IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se encontró caja para la sucursal');
    END IF;

    -- Validar apertura de caja (solo si no es cuenta corriente)
    IF p_pago IS NOT NULL THEN
        v_pagos_array := CASE 
            WHEN jsonb_typeof(p_pago->'pagos') = 'array' THEN p_pago->'pagos'
            ELSE jsonb_build_array(p_pago)
        END;
        
        -- Verificar si hay algún pago que no sea cuenta_corriente
        FOR v_pago_item IN SELECT * FROM jsonb_array_elements(v_pagos_array)
        LOOP
            v_metodo_pago := v_pago_item->>'metodo_pago';
            
            IF v_metodo_pago != 'cuenta_corriente' THEN
                -- Validar caja abierta
                v_cierre_abierto := fn_validar_caja_abierta(v_caja_final);
                
                IF NOT v_cierre_abierto THEN
                    RETURN jsonb_build_object(
                        'success', false, 
                        'error', 'La caja no está abierta. Debe abrir un cierre de caja antes de realizar ventas.'
                    );
                END IF;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    -- Validar límite de crédito si es venta a cuenta corriente
    IF p_cliente_id IS NOT NULL AND p_pago IS NOT NULL THEN
        v_pagos_array := CASE 
            WHEN jsonb_typeof(p_pago->'pagos') = 'array' THEN p_pago->'pagos'
            ELSE jsonb_build_array(p_pago)
        END;
        
        -- Calcular total de venta primero (necesario para validación)
        -- Lo haremos después de procesar items, pero validamos límite luego
        
        -- Verificar si hay pago a cuenta corriente
        FOR v_pago_item IN SELECT * FROM jsonb_array_elements(v_pagos_array)
        LOOP
            IF (v_pago_item->>'metodo_pago') = 'cuenta_corriente' THEN
                -- Validación se hará después de calcular el total
                EXIT;
            END IF;
        END LOOP;
    END IF;

    -- Generar número de pedido
    v_numero_pedido := 'VTA-SUC-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido
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
        p_cliente_id, -- Puede ser NULL
        p_sucursal_id,
        p_usuario_id,
        p_usuario_id,
        p_lista_precio_id,
        'completado',
        'venta',
        'sucursal',
        0,
        0,
        'pendiente', -- Se actualizará después
        NOW()
    ) RETURNING id INTO v_pedido_id;

    -- Procesar cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener producto
        SELECT * INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'producto_id';
        END IF;

        v_cantidad := (v_item->>'cantidad')::DECIMAL;
        
        -- Obtener precio de la lista
        v_precio_unitario := COALESCE(
            (v_item->>'precio_unitario')::DECIMAL,
            fn_obtener_precio_producto(p_lista_precio_id, v_producto.id)
        );

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

            -- Insertar detalle del pedido
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
                p_lista_precio_id,
                v_lista_tipo
            );

            v_pendiente := v_pendiente - v_utiliza;
        END LOOP;

        IF v_pendiente > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %', v_producto.nombre;
        END IF;
    END LOOP;

    -- Calcular margen total
    v_margen_total := v_total - v_costo_total;

    -- Procesar pagos (multipago) y calcular recargos
    IF p_pago IS NOT NULL THEN
        v_pagos_array := CASE 
            WHEN jsonb_typeof(p_pago->'pagos') = 'array' THEN p_pago->'pagos'
            ELSE jsonb_build_array(p_pago)
        END;
        
        -- Calcular recargos y total de pagos
        FOR v_pago_item IN SELECT * FROM jsonb_array_elements(v_pagos_array)
        LOOP
            v_metodo_pago := v_pago_item->>'metodo_pago';
            v_monto_pago := (v_pago_item->>'monto')::DECIMAL;
            
            -- Calcular recargo para este método
            v_recargo := fn_calcular_recargo_metodo_pago(p_sucursal_id, v_metodo_pago, v_monto_pago);
            v_recargo_total := v_recargo_total + v_recargo;
            v_total_pagos := v_total_pagos + v_monto_pago;
        END LOOP;
        
        -- Validar que total de pagos coincida con total + recargos
        IF ABS(v_total_pagos - (v_total + v_recargo_total)) > 0.01 THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'El total de pagos no coincide con el total de la venta más recargos'
            );
        END IF;
        
        -- Validar límite de crédito si hay pago a cuenta corriente
        IF p_cliente_id IS NOT NULL THEN
            FOR v_pago_item IN SELECT * FROM jsonb_array_elements(v_pagos_array)
            LOOP
                IF (v_pago_item->>'metodo_pago') = 'cuenta_corriente' THEN
                    v_monto_pago := (v_pago_item->>'monto')::DECIMAL;
                    v_validacion_credito := fn_validar_limite_credito(p_cliente_id, v_monto_pago);
                    
                    IF NOT (v_validacion_credito->>'permite_venta')::BOOLEAN THEN
                        RETURN jsonb_build_object(
                            'success', false,
                            'error', 'La venta excede el límite de crédito del cliente',
                            'saldo_actual', v_validacion_credito->>'saldo_actual',
                            'limite_credito', v_validacion_credito->>'limite_credito',
                            'diferencia', v_validacion_credito->>'diferencia'
                        );
                    END IF;
                    EXIT;
                END IF;
            END LOOP;
        END IF;
        
        -- Determinar estado de pago
        IF v_total_pagos >= (v_total + v_recargo_total) THEN
            v_estado_pago := 'pagado';
        ELSIF v_total_pagos > 0 THEN
            v_estado_pago := 'parcial';
        ELSE
            v_estado_pago := 'pendiente';
        END IF;
        
        -- Actualizar total con recargos
        v_total := v_total + v_recargo_total;
    ELSE
        v_estado_pago := 'pendiente';
    END IF;

    -- Actualizar totales del pedido
    UPDATE pedidos
    SET subtotal = v_total - v_recargo_total, -- Subtotal sin recargos
        total = v_total, -- Total con recargos
        costo_total = v_costo_total,
        margen_bruto_total = v_margen_total,
        pago_estado = v_estado_pago,
        updated_at = NOW()
    WHERE id = v_pedido_id;

    -- Registrar movimientos de caja automáticos (solo para pagos no a cuenta corriente)
    IF p_pago IS NOT NULL THEN
        v_pagos_array := CASE 
            WHEN jsonb_typeof(p_pago->'pagos') = 'array' THEN p_pago->'pagos'
            ELSE jsonb_build_array(p_pago)
        END;
        
        FOR v_pago_item IN SELECT * FROM jsonb_array_elements(v_pagos_array)
        LOOP
            v_metodo_pago := v_pago_item->>'metodo_pago';
            v_monto_pago := (v_pago_item->>'monto')::DECIMAL;
            
            -- Solo crear movimiento de caja si no es cuenta corriente
            IF v_metodo_pago != 'cuenta_corriente' AND v_monto_pago > 0 THEN
                -- Calcular recargo para este método
                v_recargo := fn_calcular_recargo_metodo_pago(p_sucursal_id, v_metodo_pago, v_monto_pago);
                
                -- Crear movimiento de caja
                PERFORM fn_crear_movimiento_caja(
                    v_caja_final,
                    'ingreso',
                    v_monto_pago, -- El monto ya incluye recargo si aplica
                    'Venta sucursal ' || v_numero_pedido || ' - ' || v_metodo_pago,
                    'venta_sucursal',
                    v_pedido_id,
                    p_usuario_id,
                    v_metodo_pago
                );
            ELSIF v_metodo_pago = 'cuenta_corriente' AND v_monto_pago > 0 AND p_cliente_id IS NOT NULL THEN
                -- Actualizar cuenta corriente del cliente
                INSERT INTO cuentas_movimientos (
                    cuenta_corriente_id,
                    tipo_movimiento,
                    monto,
                    descripcion,
                    origen_tipo,
                    origen_id
                )
                SELECT 
                    cc.id,
                    'debe',
                    v_monto_pago,
                    'Venta sucursal ' || v_numero_pedido,
                    'venta_sucursal',
                    v_pedido_id
                FROM cuentas_corrientes cc
                WHERE cc.cliente_id = p_cliente_id;
                
                -- Actualizar saldo de cuenta corriente
                UPDATE cuentas_corrientes
                SET saldo = saldo + v_monto_pago,
                    updated_at = NOW()
                WHERE cliente_id = p_cliente_id;
            END IF;
        END LOOP;
    END IF;

    -- Registrar en auditoría de listas de precios (solo si hay cliente)
    IF p_cliente_id IS NOT NULL THEN
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
            p_lista_precio_id,
            v_lista_tipo,
            v_cantidad_total,
            v_total,
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total,
        'subtotal', v_total - v_recargo_total,
        'recargo_total', v_recargo_total,
        'costo_total', v_costo_total,
        'margen_bruto', v_margen_total,
        'tipo_lista', v_lista_tipo,
        'pago_estado', v_estado_pago
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_registrar_venta_sucursal IS 'Registra una venta en sucursal con control completo: caja, crédito, multipago, recargos';

-- ===========================================
-- 6. FUNCIÓN: Reintegrar stock a lote (para devoluciones)
-- ===========================================

CREATE OR REPLACE FUNCTION fn_reintegrar_stock_lote(
    p_lote_id UUID,
    p_cantidad DECIMAL(10,3),
    p_motivo TEXT,
    p_usuario_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_lote RECORD;
BEGIN
    -- Obtener lote
    SELECT * INTO v_lote
    FROM lotes
    WHERE id = p_lote_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lote no encontrado');
    END IF;

    -- Reintegrar cantidad
    UPDATE lotes
    SET cantidad_disponible = cantidad_disponible + p_cantidad,
        updated_at = NOW()
    WHERE id = p_lote_id;

    RETURN jsonb_build_object(
        'success', true,
        'cantidad_reintegrada', p_cantidad,
        'nueva_cantidad_disponible', v_lote.cantidad_disponible + p_cantidad
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_reintegrar_stock_lote IS 'Reintegra stock a un lote específico (usado en devoluciones)';

COMMIT;

