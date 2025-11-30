-- ===========================================
-- MEJORAS AL FLUJO DE VENTAS
-- Fecha: 2025-11-30
-- ===========================================

-- ===========================================
-- 1. AGREGAR CAMPO PESO_TOTAL_KG A PRESUPUESTOS
-- ===========================================

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS peso_total_kg DECIMAL(10,3) DEFAULT 0;

-- Índice para optimizar búsquedas por peso
CREATE INDEX IF NOT EXISTS idx_presupuestos_peso_total ON presupuestos(peso_total_kg);

-- ===========================================
-- 2. FUNCIÓN PARA RECALCULAR PESO TOTAL
-- ===========================================

CREATE OR REPLACE FUNCTION fn_recalcular_peso_presupuesto()
RETURNS TRIGGER AS $$
DECLARE
    v_peso_total DECIMAL(10,3);
BEGIN
    -- Calcular peso total sumando items
    SELECT COALESCE(SUM(
        CASE 
            WHEN pi.pesable AND pi.peso_final IS NOT NULL THEN pi.peso_final
            ELSE pi.cantidad_solicitada
        END
    ), 0)
    INTO v_peso_total
    FROM presupuesto_items pi
    WHERE pi.presupuesto_id = COALESCE(NEW.presupuesto_id, OLD.presupuesto_id);

    -- Actualizar peso total en presupuesto
    UPDATE presupuestos
    SET peso_total_kg = v_peso_total,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.presupuesto_id, OLD.presupuesto_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para recalcular peso automáticamente
DROP TRIGGER IF EXISTS trg_recalcular_peso_presupuesto ON presupuesto_items;
CREATE TRIGGER trg_recalcular_peso_presupuesto
AFTER INSERT OR UPDATE OR DELETE ON presupuesto_items
FOR EACH ROW EXECUTE FUNCTION fn_recalcular_peso_presupuesto();

-- ===========================================
-- 3. MEJORAR FUNCIÓN DE CREACIÓN DE PRESUPUESTO
-- Agregar validación de stock real
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_presupuesto_desde_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL,
    p_fecha_entrega_estimada DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto_id UUID;
    v_numero_presupuesto VARCHAR(50);
    v_total_estimado DECIMAL(10,2) := 0;
    v_peso_total DECIMAL(10,3) := 0;
    v_item JSONB;
    v_precio_unit DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_stock_disponible DECIMAL(10,3);
    v_reserva_result JSONB;
    v_producto_nombre VARCHAR(255);
    v_turno VARCHAR(20);
    v_fecha_entrega DATE;
    v_hora_actual TIME;
    v_pesable BOOLEAN;
BEGIN
    -- Determinar turno y fecha según horario de corte (zona horaria Argentina)
    v_hora_actual := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::TIME;
    
    IF v_hora_actual < '05:00:00' THEN
        v_turno := 'mañana';
        v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, CURRENT_DATE);
    ELSIF v_hora_actual >= '05:00:00' AND v_hora_actual < '15:00:00' THEN
        v_turno := 'tarde';
        v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, CURRENT_DATE);
    ELSE
        v_turno := 'mañana';
        v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, CURRENT_DATE + INTERVAL '1 day');
    END IF;

    -- Validar stock de todos los productos ANTES de crear el presupuesto
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener nombre del producto para mensaje de error
        SELECT nombre, precio_venta, pesable INTO v_producto_nombre, v_precio_unit, v_pesable
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Producto no encontrado: ' || (v_item->>'producto_id')
            );
        END IF;

        -- Verificar stock disponible (suma de lotes disponibles y no vencidos)
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
        AND l.estado = 'disponible'
        AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento > v_fecha_entrega);

        -- VALIDACIÓN CRÍTICA: Stock debe ser suficiente
        IF v_stock_disponible < (v_item->>'cantidad')::DECIMAL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Stock insuficiente para ' || v_producto_nombre || '. Disponible: ' || v_stock_disponible::TEXT || ' kg/u',
                'producto_nombre', v_producto_nombre,
                'cantidad_solicitada', (v_item->>'cantidad')::DECIMAL,
                'stock_disponible', v_stock_disponible
            );
        END IF;
    END LOOP;

    -- Si llegamos aquí, hay stock suficiente para todos los productos
    -- Generar número de presupuesto único
    v_numero_presupuesto := 'PRES-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Detectar zona del cliente si no se proporciona
    IF p_zona_id IS NULL THEN
        SELECT z.id INTO p_zona_id
        FROM clientes c
        LEFT JOIN localidades l ON c.localidad_id = l.id
        LEFT JOIN zonas z ON l.zona_id = z.id
        WHERE c.id = p_cliente_id;
    END IF;

    -- Crear presupuesto con estado 'en_almacen' y turno asignado
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones,
        turno, fecha_entrega_estimada
    ) VALUES (
        v_numero_presupuesto, p_cliente_id, p_zona_id, 'en_almacen', p_observaciones,
        v_turno, v_fecha_entrega
    ) RETURNING id INTO v_presupuesto_id;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener precio y determinar si es pesable
        SELECT precio_venta, pesable, categoria INTO v_precio_unit, v_pesable, v_producto_nombre
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        -- Si el item tiene precio_unitario en el JSON, usarlo (para listas de precios)
        IF v_item ? 'precio_unitario' THEN
            v_precio_unit := (v_item->>'precio_unitario')::DECIMAL;
        END IF;

        -- Calcular subtotal
        v_subtotal := (v_item->>'cantidad')::DECIMAL * v_precio_unit;

        -- Insertar item
        INSERT INTO presupuesto_items (
            presupuesto_id, producto_id, cantidad_solicitada,
            precio_unit_est, subtotal_est, pesable
        ) VALUES (
            v_presupuesto_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            v_precio_unit,
            v_subtotal,
            v_pesable
        );

        v_total_estimado := v_total_estimado + v_subtotal;
        v_peso_total := v_peso_total + (v_item->>'cantidad')::DECIMAL;
    END LOOP;

    -- Actualizar totales del presupuesto
    UPDATE presupuestos
    SET total_estimado = v_total_estimado,
        peso_total_kg = v_peso_total
    WHERE id = v_presupuesto_id;

    -- Intentar reservar stock preventivo
    SELECT fn_reservar_stock_por_presupuesto(v_presupuesto_id) INTO v_reserva_result;

    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'success', true,
        'presupuesto_id', v_presupuesto_id,
        'numero_presupuesto', v_numero_presupuesto,
        'total_estimado', v_total_estimado,
        'turno', v_turno,
        'fecha_entrega_estimada', v_fecha_entrega,
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

-- ===========================================
-- 4. MEJORAR FUNCIÓN DE ASIGNACIÓN DE VEHÍCULOS
-- Usar peso real en lugar de total_final
-- ===========================================

CREATE OR REPLACE FUNCTION fn_asignar_vehiculos_por_peso(
    p_fecha DATE,
    p_zona_id UUID DEFAULT NULL,
    p_turno VARCHAR(20) DEFAULT NULL
) RETURNS TABLE (
    presupuesto_id UUID,
    vehiculo_id UUID,
    peso_estimado DECIMAL(10,3),
    capacidad_restante DECIMAL(10,3)
) AS $$
DECLARE
    v_vehiculo RECORD;
    v_presupuesto RECORD;
    v_capacidad_restante DECIMAL(10,3);
BEGIN
    -- Para cada vehículo disponible (ordenado por capacidad DESC)
    FOR v_vehiculo IN
        SELECT v.id, v.capacidad_kg
        FROM vehiculos v
        WHERE v.activo = true
        ORDER BY v.capacidad_kg DESC
    LOOP
        v_capacidad_restante := v_vehiculo.capacidad_kg;

        -- Asignar presupuestos que quepan en este vehículo
        FOR v_presupuesto IN
            SELECT p.id, p.peso_total_kg
            FROM presupuestos p
            WHERE p.estado = 'en_almacen'
            AND p.fecha_entrega_estimada = p_fecha
            AND (p_zona_id IS NULL OR p.zona_id = p_zona_id)
            AND (p_turno IS NULL OR p.turno = p_turno)
            AND NOT EXISTS (
                SELECT 1 FROM pedidos pe WHERE pe.presupuesto_id = p.id
            )
            ORDER BY p.peso_total_kg DESC
        LOOP
            -- Si el presupuesto cabe en el vehículo
            IF v_presupuesto.peso_total_kg <= v_capacidad_restante THEN
                presupuesto_id := v_presupuesto.id;
                vehiculo_id := v_vehiculo.id;
                peso_estimado := v_presupuesto.peso_total_kg;
                capacidad_restante := v_capacidad_restante - v_presupuesto.peso_total_kg;

                RETURN NEXT;

                v_capacidad_restante := capacidad_restante;
            END IF;

            IF v_capacidad_restante <= 0 THEN
                EXIT;
            END IF;
        END LOOP;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 5. FUNCIÓN PARA CONFIGURAR EXPIRACIÓN AUTOMÁTICA DE RESERVAS
-- (Requiere extensión pg_cron)
-- ===========================================

-- Nota: pg_cron debe estar habilitado en Supabase
-- Esta función se puede ejecutar manualmente o programar con pg_cron

CREATE OR REPLACE FUNCTION fn_configurar_expirar_reservas()
RETURNS TEXT AS $$
BEGIN
    -- Intentar crear el job de pg_cron
    -- Si pg_cron no está disponible, retornar mensaje informativo
    BEGIN
        PERFORM cron.schedule(
            'expirar-reservas-stock',
            '*/15 * * * *', -- Cada 15 minutos
            $$SELECT fn_expirar_reservas()$$
        );
        RETURN 'Job de expiración de reservas configurado exitosamente (cada 15 minutos)';
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 'No se pudo configurar pg_cron. Ejecutar manualmente fn_expirar_reservas() periódicamente. Error: ' || SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar configuración (comentar si falla por permisos)
-- SELECT fn_configurar_expirar_reservas();

-- ===========================================
-- 6. MEJORAR FUNCIÓN DE CONVERSIÓN A PEDIDO
-- Agregar manejo de items sin stock (conversión parcial)
-- ===========================================

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL,
    p_permitir_parcial BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_item RECORD;
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_total_final DECIMAL(10,2) := 0;
    v_items_procesados INTEGER := 0;
    v_items_omitidos JSONB := '[]'::JSONB;
    v_stock_disponible DECIMAL(10,3);
BEGIN
    -- Obtener datos del presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id AND estado = 'en_almacen';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado o no está en almacén');
    END IF;

    -- Validar que tenga zona asignada
    IF v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto debe tener una zona asignada');
    END IF;

    -- Validar que productos balanza estén pesados
    IF EXISTS (
        SELECT 1 FROM presupuesto_items 
        WHERE presupuesto_id = p_presupuesto_id 
        AND pesable = true 
        AND peso_final IS NULL
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Todos los productos balanza deben estar pesados antes de convertir');
    END IF;

    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido
    INSERT INTO pedidos (
        numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
        estado, tipo_pedido, origen, total, subtotal, observaciones,
        presupuesto_id, turno, zona_id
    ) VALUES (
        v_numero_pedido, v_presupuesto.cliente_id, v_presupuesto.usuario_vendedor,
        v_presupuesto.fecha_entrega_estimada, 'preparando', 'venta', 'presupuesto',
        COALESCE(v_presupuesto.total_final, v_presupuesto.total_estimado),
        COALESCE(v_presupuesto.total_final, v_presupuesto.total_estimado),
        v_presupuesto.observaciones,
        p_presupuesto_id, v_presupuesto.turno, v_presupuesto.zona_id
    ) RETURNING id INTO v_pedido_id;

    -- Procesar items y descontar stock
    FOR v_item IN
        SELECT * FROM presupuesto_items WHERE presupuesto_id = p_presupuesto_id
    LOOP
        -- Verificar stock disponible antes de procesar
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = v_item.producto_id
        AND l.estado = 'disponible'
        AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento > v_presupuesto.fecha_entrega_estimada);

        IF v_stock_disponible < v_item.cantidad_solicitada THEN
            -- Si no se permite parcial, abortar todo
            IF NOT p_permitir_parcial THEN
                RAISE EXCEPTION 'Stock insuficiente para completar el pedido completo';
            END IF;
            
            -- Agregar a items omitidos
            v_items_omitidos := v_items_omitidos || jsonb_build_object(
                'producto_id', v_item.producto_id,
                'cantidad_solicitada', v_item.cantidad_solicitada,
                'stock_disponible', v_stock_disponible,
                'motivo', 'stock_insuficiente'
            );
            CONTINUE;
        END IF;

        -- Insertar detalle del pedido
        INSERT INTO detalles_pedido (
            pedido_id, producto_id, lote_id, cantidad,
            precio_unitario, subtotal, peso_final, precio_unit_final
        ) VALUES (
            v_pedido_id, v_item.producto_id, v_item.lote_reservado_id,
            v_item.cantidad_solicitada, COALESCE(v_item.precio_unit_final, v_item.precio_unit_est),
            COALESCE(v_item.subtotal_final, v_item.subtotal_est),
            v_item.peso_final, v_item.precio_unit_final
        );

        -- Descontar stock del lote
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible - v_item.cantidad_solicitada,
            updated_at = NOW()
        WHERE id = v_item.lote_reservado_id;

        -- Registrar movimiento de stock
        INSERT INTO movimientos_stock (
            lote_id, tipo_movimiento, cantidad, motivo, usuario_id, pedido_id
        ) VALUES (
            v_item.lote_reservado_id, 'salida', v_item.cantidad_solicitada,
            'Conversión de presupuesto a pedido', p_user_id, v_pedido_id
        );

        v_total_final := v_total_final + COALESCE(v_item.subtotal_final, v_item.subtotal_est);
        v_items_procesados := v_items_procesados + 1;
    END LOOP;

    -- Si no se procesó ningún item, eliminar pedido y abortar
    IF v_items_procesados = 0 THEN
        DELETE FROM pedidos WHERE id = v_pedido_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No se pudo procesar ningún item del presupuesto por falta de stock'
        );
    END IF;

    -- Actualizar total del pedido
    UPDATE pedidos
    SET total = v_total_final, subtotal = v_total_final
    WHERE id = v_pedido_id;

    -- Marcar reservas como consumidas
    UPDATE stock_reservations
    SET estado = 'consumida'
    WHERE presupuesto_id = p_presupuesto_id;

    -- Actualizar presupuesto
    UPDATE presupuestos
    SET estado = 'facturado', pedido_convertido_id = v_pedido_id,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total_final,
        'items_procesados', v_items_procesados,
        'items_omitidos', v_items_omitidos,
        'conversion_parcial', jsonb_array_length(v_items_omitidos) > 0
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
-- COMENTARIOS Y NOTAS
-- ===========================================

COMMENT ON FUNCTION fn_crear_presupuesto_desde_bot IS 'Crea presupuesto desde WhatsApp con validación de stock real y asignación automática de turno';
COMMENT ON FUNCTION fn_asignar_vehiculos_por_peso IS 'Sugiere asignación de vehículos basada en peso real (peso_total_kg) de presupuestos';
COMMENT ON FUNCTION fn_convertir_presupuesto_a_pedido IS 'Convierte presupuesto a pedido con opción de conversión parcial si falta stock';
COMMENT ON COLUMN presupuestos.peso_total_kg IS 'Peso total en kg calculado automáticamente desde items';
