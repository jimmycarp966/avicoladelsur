-- ===========================================
-- MIGRACIÓN: Lógica de Venta por Mayor en fn_registrar_venta_sucursal
-- Fecha: 11/12/2025
-- Objetivo:
--   Actualizar fn_registrar_venta_sucursal para soportar conversión
--   automática de unidades mayores a kg cuando se usa lista mayorista
-- ===========================================

BEGIN;

-- ===========================================
-- 1. ACTUALIZAR fn_registrar_venta_sucursal
-- ===========================================

-- Eliminar TODAS las versiones existentes de la función
-- Hay múltiples firmas por los parámetros con DEFAULT
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure::text as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'fn_registrar_venta_sucursal'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION fn_registrar_venta_sucursal(
    p_sucursal_id UUID,
    p_cliente_id UUID, -- Puede ser NULL para venta genérica
    p_usuario_id UUID,
    p_lista_precio_id UUID,
    p_items JSONB,
    p_pago JSONB DEFAULT NULL,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(60);
    v_item JSONB;
    v_producto RECORD;
    v_cantidad DECIMAL(10,3);
    v_cantidad_real DECIMAL(10,3); -- Cantidad real en kg a descontar
    v_unidad_venta VARCHAR(50); -- Unidad de venta usada (kg o caja, etc.)
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
    v_es_venta_mayor BOOLEAN;
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

    -- Determinar si es venta por mayor (lista mayorista o distribuidor)
    v_es_venta_mayor := v_lista_tipo IN ('mayorista', 'distribuidor');

    -- Determinar caja a usar
    IF p_caja_id IS NOT NULL THEN
        v_caja_final := p_caja_id;
    ELSE
        SELECT id INTO v_caja_final
        FROM tesoreria_cajas
        WHERE sucursal_id = p_sucursal_id
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
        
        FOR v_pago_item IN SELECT * FROM jsonb_array_elements(v_pagos_array)
        LOOP
            v_metodo_pago := v_pago_item->>'metodo_pago';
            
            IF v_metodo_pago != 'cuenta_corriente' THEN
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
        p_cliente_id,
        p_sucursal_id,
        p_usuario_id,
        p_usuario_id,
        p_lista_precio_id,
        'completado',
        'venta',
        'sucursal',
        0,
        0,
        'pendiente',
        NOW()
    ) RETURNING id INTO v_pedido_id;

    -- Procesar cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener producto con campos de venta por mayor
        SELECT 
            id, nombre, precio_venta, precio_costo, unidad_medida,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre,
            COALESCE(kg_por_unidad_mayor, 20) as kg_por_unidad_mayor
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'producto_id';
        END IF;

        v_cantidad := (v_item->>'cantidad')::DECIMAL;
        
        -- =====================================================
        -- LÓGICA DE CONVERSIÓN PARA VENTA POR MAYOR
        -- =====================================================
        -- Si es lista mayorista/distribuidor Y el producto tiene venta_mayor_habilitada
        -- Y el producto se mide en kg, entonces convertir unidades a kg
        IF v_es_venta_mayor 
           AND v_producto.venta_mayor_habilitada 
           AND v_producto.unidad_medida = 'kg' THEN
            -- La cantidad ingresada representa unidades mayores (cajas)
            -- Convertir a kg para descontar del stock
            v_cantidad_real := v_cantidad * v_producto.kg_por_unidad_mayor;
            v_unidad_venta := v_producto.unidad_mayor_nombre;
        ELSE
            -- Venta normal: la cantidad ya está en la unidad base
            v_cantidad_real := v_cantidad;
            v_unidad_venta := v_producto.unidad_medida;
        END IF;
        
        -- Obtener precio de la lista
        v_precio_unitario := COALESCE(
            (v_item->>'precio_unitario')::DECIMAL,
            fn_obtener_precio_producto(p_lista_precio_id, v_producto.id)
        );

        -- Obtener costo promedio
        v_costo_unitario := fn_obtener_costo_promedio_sucursal(p_sucursal_id, v_producto.id);

        -- Calcular subtotal basado en cantidad original (no la convertida)
        -- El precio ya está calculado por la lista según el tipo
        v_subtotal := v_cantidad * v_precio_unitario;
        v_total := v_total + v_subtotal;
        v_costo_total := v_costo_total + (v_cantidad_real * v_costo_unitario);
        v_cantidad_total := v_cantidad_total + v_cantidad_real;

        -- Descontar stock FIFO - USANDO v_cantidad_real (kg)
        v_pendiente := v_cantidad_real;
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
                'Venta sucursal ' || v_numero_pedido || 
                CASE WHEN v_es_venta_mayor AND v_producto.venta_mayor_habilitada 
                     THEN ' (' || v_cantidad || ' ' || v_unidad_venta || ')' 
                     ELSE '' END,
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

        -- =====================================================
        -- PERMITIR STOCK NEGATIVO
        -- =====================================================
        -- Si aún queda pendiente, crear un movimiento negativo
        -- Esto permite la venta aunque no haya stock suficiente
        IF v_pendiente > 0 THEN
            -- Buscar cualquier lote del producto para registrar el negativo
            SELECT id INTO v_lote
            FROM lotes
            WHERE producto_id = v_producto.id
              AND sucursal_id = p_sucursal_id
            ORDER BY fecha_ingreso DESC
            LIMIT 1;
            
            IF FOUND THEN
                -- Actualizar el lote (quedará negativo)
                UPDATE lotes
                SET cantidad_disponible = cantidad_disponible - v_pendiente,
                    updated_at = NOW()
                WHERE id = v_lote.id;

                -- Registrar movimiento de stock (negativo)
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
                    v_pendiente,
                    'Venta sucursal ' || v_numero_pedido || ' (STOCK NEGATIVO - Requiere auditoría)',
                    p_usuario_id,
                    v_pedido_id
                );

                -- Insertar detalle del pedido para la cantidad pendiente
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
                    v_pendiente,
                    v_precio_unitario,
                    v_pendiente * v_precio_unitario,
                    v_costo_unitario,
                    (v_precio_unitario - v_costo_unitario) * v_pendiente,
                    p_lista_precio_id,
                    v_lista_tipo
                );
            END IF;
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
            
            v_recargo := fn_calcular_recargo_metodo_pago(p_sucursal_id, v_metodo_pago, v_monto_pago);
            v_recargo_total := v_recargo_total + v_recargo;
            v_total_pagos := v_total_pagos + v_monto_pago;
        END LOOP;
        
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
    SET subtotal = v_total - v_recargo_total,
        total = v_total,
        costo_total = v_costo_total,
        margen_bruto_total = v_margen_total,
        pago_estado = v_estado_pago,
        updated_at = NOW()
    WHERE id = v_pedido_id;

    -- Registrar movimientos de caja automáticos
    IF p_pago IS NOT NULL THEN
        v_pagos_array := CASE 
            WHEN jsonb_typeof(p_pago->'pagos') = 'array' THEN p_pago->'pagos'
            ELSE jsonb_build_array(p_pago)
        END;
        
        FOR v_pago_item IN SELECT * FROM jsonb_array_elements(v_pagos_array)
        LOOP
            v_metodo_pago := v_pago_item->>'metodo_pago';
            v_monto_pago := (v_pago_item->>'monto')::DECIMAL;
            
            IF v_metodo_pago != 'cuenta_corriente' AND v_monto_pago > 0 THEN
                v_recargo := fn_calcular_recargo_metodo_pago(p_sucursal_id, v_metodo_pago, v_monto_pago);
                
                PERFORM fn_crear_movimiento_caja(
                    v_caja_final,
                    'ingreso',
                    v_monto_pago,
                    'Venta sucursal ' || v_numero_pedido || ' - ' || v_metodo_pago,
                    'venta_sucursal',
                    v_pedido_id,
                    p_usuario_id,
                    v_metodo_pago
                );
            ELSIF v_metodo_pago = 'cuenta_corriente' AND v_monto_pago > 0 AND p_cliente_id IS NOT NULL THEN
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
                
                UPDATE cuentas_corrientes
                SET saldo = saldo + v_monto_pago,
                    updated_at = NOW()
                WHERE cliente_id = p_cliente_id;
            END IF;
        END LOOP;
    END IF;

    -- Registrar en auditoría
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
        'pago_estado', v_estado_pago,
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

COMMENT ON FUNCTION fn_registrar_venta_sucursal IS 
'Registra una venta en sucursal con soporte para:
- Venta por mayor (convierte unidades a kg automáticamente)
- Stock negativo (permite venta aunque no haya stock)
- Multipago y recargos
- Control de límite de crédito';

COMMIT;
