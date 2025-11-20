-- ===========================================
-- HIT PRESUPUESTOS - FLUJO COMPLETO
-- Fecha: 2025-11-20
-- ===========================================

-- ===========================================
-- NUEVAS TABLAS PARA FLUJO PRESUPUESTOS
-- ===========================================

-- TABLA PRESUPUESTOS
CREATE TABLE IF NOT EXISTS presupuestos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_presupuesto VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    zona_id UUID REFERENCES zonas(id),
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_almacen', 'facturado', 'anulado')),
    fecha_entrega_estimada DATE,
    fecha_entrega_real TIMESTAMP WITH TIME ZONE,
    total_estimado DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_final DECIMAL(10,2),
    observaciones TEXT,
    usuario_vendedor UUID REFERENCES usuarios(id),
    usuario_almacen UUID REFERENCES usuarios(id),
    usuario_repartidor UUID REFERENCES usuarios(id),
    pedido_convertido_id UUID REFERENCES pedidos(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA PRESUPUESTO_ITEMS
CREATE TABLE IF NOT EXISTS presupuesto_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presupuesto_id UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_reservado_id UUID REFERENCES lotes(id),
    cantidad_solicitada DECIMAL(10,3) NOT NULL,
    cantidad_reservada DECIMAL(10,3) DEFAULT 0,
    precio_unit_est DECIMAL(10,2) NOT NULL,
    precio_unit_final DECIMAL(10,2),
    pesable BOOLEAN DEFAULT false,
    peso_final DECIMAL(10,3),
    subtotal_est DECIMAL(10,2) NOT NULL,
    subtotal_final DECIMAL(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA STOCK_RESERVATIONS (RESERVAS PREVENTIVAS)
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presupuesto_id UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_id UUID NOT NULL REFERENCES lotes(id),
    cantidad DECIMAL(10,3) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa', 'expirada', 'consumida')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- ALTERACIONES A TABLAS EXISTENTES
-- ===========================================

-- Agregar campos a productos si no existen
ALTER TABLE productos ADD COLUMN IF NOT EXISTS pesable BOOLEAN DEFAULT false;

-- Agregar campos a pedidos si no existen
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS presupuesto_id UUID REFERENCES presupuestos(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS total_final DECIMAL(10,2);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_estado VARCHAR(20) DEFAULT 'pendiente' CHECK (pago_estado IN ('pendiente', 'parcial', 'pagado'));

-- Agregar campos a detalles_pedido si no existen
ALTER TABLE detalles_pedido ADD COLUMN IF NOT EXISTS peso_final DECIMAL(10,3);
ALTER TABLE detalles_pedido ADD COLUMN IF NOT EXISTS precio_unit_final DECIMAL(10,2);

-- ===========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente_id ON presupuestos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha ON presupuestos(fecha_entrega_estimada);
CREATE INDEX IF NOT EXISTS idx_presupuesto_items_presupuesto_id ON presupuesto_items(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_presupuesto_id ON stock_reservations(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_lote_id ON stock_reservations(lote_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at ON stock_reservations(expires_at);

-- ===========================================
-- FUNCIONES RPC PARA FLUJO PRESUPUESTOS
-- ===========================================

-- Función para reservar stock preventivo por presupuesto
CREATE OR REPLACE FUNCTION fn_reservar_stock_por_presupuesto(
    p_presupuesto_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_lote RECORD;
    v_cantidad_restante DECIMAL(10,3);
    v_reservado DECIMAL(10,3);
    v_errores JSONB := '[]'::jsonb;
    v_exito BOOLEAN := true;
BEGIN
    -- Procesar cada item del presupuesto
    FOR v_item IN
        SELECT pi.id, pi.producto_id, pi.cantidad_solicitada,
               p.fecha_entrega_estimada
        FROM presupuesto_items pi
        JOIN presupuestos p ON pi.presupuesto_id = p.id
        WHERE pi.presupuesto_id = p_presupuesto_id
    LOOP
        v_cantidad_restante := v_item.cantidad_solicitada;
        v_reservado := 0;

        -- Buscar lotes disponibles ordenados por FIFO
        FOR v_lote IN
            SELECT l.id, l.numero_lote, l.cantidad_disponible,
                   l.fecha_vencimiento, l.fecha_ingreso
            FROM lotes l
            WHERE l.producto_id = v_item.producto_id
            AND l.estado = 'disponible'
            AND l.fecha_vencimiento > v_item.fecha_entrega_estimada
            ORDER BY l.fecha_vencimiento ASC, l.fecha_ingreso ASC
        LOOP
            IF v_cantidad_restante <= 0 THEN
                EXIT;
            END IF;

            IF v_lote.cantidad_disponible > 0 THEN
                -- Calcular cuánto reservar de este lote
                v_reservado := LEAST(v_cantidad_restante, v_lote.cantidad_disponible);

                -- Crear reserva
                INSERT INTO stock_reservations (
                    presupuesto_id, producto_id, lote_id, cantidad
                ) VALUES (
                    p_presupuesto_id, v_item.producto_id, v_lote.id, v_reservado
                );

                -- Actualizar cantidad reservada en presupuesto_items
                UPDATE presupuesto_items
                SET cantidad_reservada = cantidad_reservada + v_reservado,
                    lote_reservado_id = v_lote.id
                WHERE id = v_item.id;

                -- Reducir cantidad restante
                v_cantidad_restante := v_cantidad_restante - v_reservado;
            END IF;
        END LOOP;

        -- Si no se pudo reservar todo, agregar error
        IF v_cantidad_restante > 0 THEN
            v_errores := v_errores || jsonb_build_object(
                'producto_id', v_item.producto_id,
                'cantidad_faltante', v_cantidad_restante
            );
            v_exito := false;
        END IF;
    END LOOP;

    -- Retornar resultado
    RETURN jsonb_build_object(
        'success', v_exito,
        'errores', v_errores
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para expirar reservas vencidas
CREATE OR REPLACE FUNCTION fn_expirar_reservas()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Marcar reservas expiradas
    UPDATE stock_reservations
    SET estado = 'expirada'
    WHERE estado = 'activa'
    AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para convertir presupuesto a pedido (ATÓMICA)
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
    v_total_final DECIMAL(10,2) := 0;
    v_reserva RECORD;
BEGIN
    -- Obtener datos del presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id AND estado = 'en_almacen';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado o no está en almacén');
    END IF;

    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido
    INSERT INTO pedidos (
        numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
        estado, tipo_pedido, origen, total, subtotal, observaciones,
        presupuesto_id
    ) VALUES (
        v_numero_pedido, v_presupuesto.cliente_id, v_presupuesto.usuario_vendedor,
        v_presupuesto.fecha_entrega_estimada, 'preparando', 'venta', 'presupuesto',
        v_presupuesto.total_final, v_presupuesto.total_final, v_presupuesto.observaciones,
        p_presupuesto_id
    ) RETURNING id INTO v_pedido_id;

    -- Procesar items y descontar stock
    FOR v_item IN
        SELECT * FROM presupuesto_items WHERE presupuesto_id = p_presupuesto_id
    LOOP
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
        SET cantidad_disponible = cantidad_disponible - v_item.cantidad_solicitada
        WHERE id = v_item.lote_reservado_id;

        -- Registrar movimiento de stock
        INSERT INTO movimientos_stock (
            lote_id, tipo_movimiento, cantidad, motivo, usuario_id, pedido_id
        ) VALUES (
            v_item.lote_reservado_id, 'salida', v_item.cantidad_solicitada,
            'Conversión de presupuesto a pedido', p_user_id, v_pedido_id
        );

        v_total_final := v_total_final + COALESCE(v_item.subtotal_final, v_item.subtotal_est);
    END LOOP;

    -- Marcar reservas como consumidas
    UPDATE stock_reservations
    SET estado = 'consumida'
    WHERE presupuesto_id = p_presupuesto_id;

    -- Actualizar presupuesto
    UPDATE presupuestos
    SET estado = 'facturado', pedido_convertido_id = v_pedido_id,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    -- Si hay caja especificada, crear movimiento de tesorería
    IF p_caja_id IS NOT NULL THEN
        -- Crear movimiento de caja (ingreso por venta)
        INSERT INTO tesoreria_movimientos (
            caja_id, tipo, monto, descripcion, origen_tipo, origen_id, user_id
        ) VALUES (
            p_caja_id, 'ingreso', v_total_final,
            'Cobro por pedido ' || v_numero_pedido, 'pedido', v_pedido_id, p_user_id
        );

        -- Actualizar saldo de caja
        UPDATE tesoreria_cajas
        SET saldo_actual = saldo_actual + v_total_final, updated_at = NOW()
        WHERE id = p_caja_id;

        -- Vincular movimiento al pedido
        UPDATE pedidos
        SET pago_estado = 'pagado', caja_movimiento_id = (SELECT id FROM tesoreria_movimientos WHERE origen_id = v_pedido_id LIMIT 1)
        WHERE id = v_pedido_id;
    END IF;

    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total_final
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar peso de item de presupuesto
CREATE OR REPLACE FUNCTION fn_actualizar_peso_item_presupuesto(
    p_presupuesto_item_id UUID,
    p_peso_final DECIMAL(10,3)
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_precio_unit_final DECIMAL(10,2);
    v_subtotal_final DECIMAL(10,2);
BEGIN
    -- Obtener datos del item
    SELECT * INTO v_item
    FROM presupuesto_items
    WHERE id = p_presupuesto_item_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item de presupuesto no encontrado');
    END IF;

    -- Calcular precio unitario final (precio por kg del producto)
    SELECT precio_venta INTO v_precio_unit_final
    FROM productos
    WHERE id = v_item.producto_id;

    -- Calcular subtotal final
    v_subtotal_final := p_peso_final * v_precio_unit_final;

    -- Actualizar item
    UPDATE presupuesto_items
    SET peso_final = p_peso_final,
        precio_unit_final = v_precio_unit_final,
        subtotal_final = v_subtotal_final,
        updated_at = NOW()
    WHERE id = p_presupuesto_item_id;

    -- Recalcular total del presupuesto
    UPDATE presupuestos
    SET total_final = (
        SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
        FROM presupuesto_items
        WHERE presupuesto_id = v_item.presupuesto_id
    ),
    updated_at = NOW()
    WHERE id = v_item.presupuesto_id;

    RETURN jsonb_build_object(
        'success', true,
        'precio_unit_final', v_precio_unit_final,
        'subtotal_final', v_subtotal_final
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para asignar vehículos por peso (heurística simple)
CREATE OR REPLACE FUNCTION fn_asignar_vehiculos_por_peso(
    p_fecha DATE,
    p_zona_id UUID DEFAULT NULL
) RETURNS TABLE (
    presupuesto_id UUID,
    vehiculo_id UUID,
    peso_estimado DECIMAL(10,3),
    capacidad_restante DECIMAL(10,3)
) AS $$
DECLARE
    v_vehiculo RECORD;
    v_presupuesto RECORD;
    v_peso_acumulado DECIMAL(10,3) := 0;
    v_capacidad_restante DECIMAL(10,3);
BEGIN
    -- Para cada vehículo disponible
    FOR v_vehiculo IN
        SELECT v.id, v.capacidad_kg
        FROM vehiculos v
        WHERE v.activo = true
        ORDER BY v.capacidad_kg DESC
    LOOP
        v_capacidad_restante := v_vehiculo.capacidad_kg;
        v_peso_acumulado := 0;

        -- Asignar presupuestos que quepan en este vehículo
        FOR v_presupuesto IN
            SELECT p.id,
                   COALESCE(p.total_final,
                           (SELECT SUM(COALESCE(pi.subtotal_est, 0))
                            FROM presupuesto_items pi
                            WHERE pi.presupuesto_id = p.id)) as peso_est
            FROM presupuestos p
            WHERE p.estado = 'facturado'
            AND (p_zona_id IS NULL OR p.zona_id = p_zona_id)
            AND p.fecha_entrega_estimada = p_fecha
            AND NOT EXISTS (
                SELECT 1 FROM detalles_ruta dr
                JOIN rutas_reparto rr ON dr.ruta_id = rr.id
                WHERE dr.pedido_id IN (
                    SELECT pe.id FROM pedidos pe WHERE pe.presupuesto_id = p.id
                )
            )
            ORDER BY peso_est DESC
        LOOP
            -- Si el presupuesto cabe en el vehículo
            IF v_presupuesto.peso_est <= v_capacidad_restante THEN
                -- Retornar asignación
                presupuesto_id := v_presupuesto.id;
                vehiculo_id := v_vehiculo.id;
                peso_estimado := v_presupuesto.peso_est;
                capacidad_restante := v_capacidad_restante - v_presupuesto.peso_est;

                RETURN NEXT;

                -- Actualizar capacidad restante
                v_capacidad_restante := v_capacidad_restante - v_presupuesto.peso_est;
            END IF;

            -- Si ya no cabe nada más en este vehículo, pasar al siguiente
            IF v_capacidad_restante <= 0 THEN
                EXIT;
            END IF;
        END LOOP;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear presupuesto desde bot
CREATE OR REPLACE FUNCTION fn_crear_presupuesto_desde_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL
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
BEGIN
    -- Generar número de presupuesto único
    v_numero_presupuesto := 'PRES-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear presupuesto
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones
    ) VALUES (
        v_numero_presupuesto, p_cliente_id, p_zona_id, 'pendiente', p_observaciones
    ) RETURNING id INTO v_presupuesto_id;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener precio del producto
        SELECT precio_venta INTO v_precio_unit
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        -- Calcular subtotal
        v_subtotal := (v_item->>'cantidad')::DECIMAL * v_precio_unit;

        -- Verificar stock disponible (básico)
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
        AND l.estado = 'disponible';

        -- Determinar si es pesable (productos con stock variable)
        INSERT INTO presupuesto_items (
            presupuesto_id, producto_id, cantidad_solicitada,
            precio_unit_est, subtotal_est, pesable
        ) VALUES (
            v_presupuesto_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            v_precio_unit,
            v_subtotal,
            (v_stock_disponible < (v_item->>'cantidad')::DECIMAL * 2) -- Pesable si stock es crítico
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

-- ===========================================
-- POLÍTICAS RLS PARA PRESUPUESTOS
-- ===========================================

ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

-- Políticas para presupuestos
CREATE POLICY "admin_presupuestos_full" ON presupuestos FOR ALL USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

CREATE POLICY "vendedor_presupuestos_zona" ON presupuestos FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true
    ) AND (
        zona_id IS NULL OR
        zona_id IN (
            SELECT zona_id FROM usuarios WHERE id = auth.uid()
        )
    )
);

CREATE POLICY "vendedor_presupuestos_insert" ON presupuestos FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true
    )
);

-- Políticas para presupuesto_items
CREATE POLICY "admin_presupuesto_items_full" ON presupuesto_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

CREATE POLICY "vendedor_presupuesto_items" ON presupuesto_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM usuarios u
        JOIN presupuestos p ON p.id = presupuesto_id
        WHERE u.id = auth.uid() AND u.rol IN ('admin', 'vendedor') AND u.activo = true
        AND (p.zona_id IS NULL OR p.zona_id = u.zona_id)
    )
);

-- Políticas para stock_reservations
CREATE POLICY "almacen_stock_reservations" ON stock_reservations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol IN ('admin', 'almacenista') AND activo = true
    )
);

CREATE POLICY "almacen_stock_reservations_update" ON stock_reservations FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol IN ('admin', 'almacenista') AND activo = true
    )
);

-- ===========================================
-- SCRIPT DE ROLLBACK
-- ===========================================

-- Para hacer rollback de esta migración, ejecutar:
-- DROP TABLE IF EXISTS stock_reservations;
-- DROP TABLE IF EXISTS presupuesto_items;
-- DROP TABLE IF EXISTS presupuestos;
--
-- ALTER TABLE productos DROP COLUMN IF EXISTS pesable;
-- ALTER TABLE pedidos DROP COLUMN IF EXISTS presupuesto_id;
-- ALTER TABLE pedidos DROP COLUMN IF EXISTS total_final;
-- ALTER TABLE pedidos DROP COLUMN IF EXISTS pago_estado;
-- ALTER TABLE detalles_pedido DROP COLUMN IF EXISTS peso_final;
-- ALTER TABLE detalles_pedido DROP COLUMN IF EXISTS precio_unit_final;
--
-- DROP FUNCTION IF EXISTS fn_reservar_stock_por_presupuesto(UUID);
-- DROP FUNCTION IF EXISTS fn_expirar_reservas();
-- DROP FUNCTION IF EXISTS fn_convertir_presupuesto_a_pedido(UUID, UUID, UUID);
-- DROP FUNCTION IF EXISTS fn_actualizar_peso_item_presupuesto(UUID, DECIMAL);
-- DROP FUNCTION IF EXISTS fn_asignar_vehiculos_por_peso(DATE, UUID);
-- DROP FUNCTION IF EXISTS fn_crear_presupuesto_desde_bot(UUID, JSONB, TEXT, UUID);
