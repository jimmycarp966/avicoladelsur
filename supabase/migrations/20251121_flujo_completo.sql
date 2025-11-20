-- ===========================================
-- FLUJO COMPLETO PRESUPUESTOS → REPARTO → TESORERÍA
-- Fecha: 2025-11-21
-- ===========================================

-- ===========================================
-- CREAR TABLA ZONAS (si no existe)
-- ===========================================

CREATE TABLE IF NOT EXISTS zonas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- AGREGAR CAMPOS A TABLAS EXISTENTES
-- ===========================================

-- Agregar campos a pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS turno VARCHAR(20) CHECK (turno IN ('mañana', 'tarde'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS zona_id UUID REFERENCES zonas(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodos_pago JSONB;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recargo_total DECIMAL(10,2) DEFAULT 0;

-- Agregar campos a rutas_reparto
ALTER TABLE rutas_reparto ADD COLUMN IF NOT EXISTS turno VARCHAR(20) CHECK (turno IN ('mañana', 'tarde'));
ALTER TABLE rutas_reparto ADD COLUMN IF NOT EXISTS zona_id UUID REFERENCES zonas(id);
ALTER TABLE rutas_reparto ADD COLUMN IF NOT EXISTS checklist_inicio_id UUID REFERENCES checklists_vehiculos(id);
ALTER TABLE rutas_reparto ADD COLUMN IF NOT EXISTS checklist_fin_id UUID REFERENCES checklists_vehiculos(id);

-- Agregar campos a presupuestos
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS turno VARCHAR(20) CHECK (turno IN ('mañana', 'tarde'));
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS metodos_pago JSONB;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS recargo_total DECIMAL(10,2) DEFAULT 0;

-- Actualizar CHECK de estado en presupuestos para incluir 'cotizacion'
-- Primero eliminamos la constraint existente si existe
ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS presupuestos_estado_check;
ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_estado_check 
    CHECK (estado IN ('pendiente', 'cotizacion', 'en_almacen', 'facturado', 'anulado'));

-- Asegurar que productos con categoria='BALANZA' tengan pesable=true
-- Crear trigger para esto
CREATE OR REPLACE FUNCTION fn_actualizar_pesable_por_categoria()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.categoria = 'BALANZA' THEN
        NEW.pesable := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_pesable_por_categoria ON productos;
CREATE TRIGGER trigger_actualizar_pesable_por_categoria
    BEFORE INSERT OR UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_pesable_por_categoria();

-- Actualizar productos existentes con categoria BALANZA
UPDATE productos SET pesable = true WHERE categoria = 'BALANZA';

-- ===========================================
-- NUEVAS TABLAS
-- ===========================================

-- Tabla zonas_dias (zonas con días estipulados)
CREATE TABLE IF NOT EXISTS zonas_dias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zona_id UUID NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo, 6=sábado
    turno VARCHAR(20) NOT NULL CHECK (turno IN ('mañana', 'tarde')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(zona_id, dia_semana, turno)
);

-- Tabla tesoro (separada de tesoreria_cajas)
CREATE TABLE IF NOT EXISTS tesoro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('efectivo', 'transferencia', 'qr', 'tarjeta')),
    monto NUMERIC(14,2) NOT NULL,
    descripcion TEXT,
    origen_tipo VARCHAR(50), -- 'cierre_caja', 'retiro', 'deposito'
    origen_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla cierres_caja
CREATE TABLE IF NOT EXISTS cierres_caja (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caja_id UUID NOT NULL REFERENCES tesoreria_cajas(id),
    fecha DATE NOT NULL,
    saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
    saldo_final NUMERIC(14,2),
    total_ingresos NUMERIC(14,2) DEFAULT 0,
    total_egresos NUMERIC(14,2) DEFAULT 0,
    cobranzas_cuenta_corriente NUMERIC(14,2) DEFAULT 0,
    gastos NUMERIC(14,2) DEFAULT 0,
    retiro_tesoro NUMERIC(14,2) DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(caja_id, fecha)
);

-- Tabla devoluciones
CREATE TABLE IF NOT EXISTS devoluciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id),
    detalle_ruta_id UUID REFERENCES detalles_ruta(id),
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad DECIMAL(10,3) NOT NULL,
    motivo VARCHAR(100) NOT NULL, -- 'producto_dañado', 'cantidad_erronea', 'no_solicitado', etc.
    observaciones TEXT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla recepcion_almacen
CREATE TABLE IF NOT EXISTS recepcion_almacen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_id UUID REFERENCES lotes(id), -- Para ingresos
    cantidad DECIMAL(10,3) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL DEFAULT 'kg', -- 'kg', 'unidad', etc.
    motivo VARCHAR(100) NOT NULL, -- 'compra', 'produccion', 'ajuste', etc.
    destino_produccion BOOLEAN DEFAULT false, -- Si es egreso para producción
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_pedidos_turno ON pedidos(turno);
CREATE INDEX IF NOT EXISTS idx_pedidos_zona_id ON pedidos(zona_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_turno_zona ON pedidos(fecha_entrega_estimada, turno, zona_id);

CREATE INDEX IF NOT EXISTS idx_rutas_reparto_turno ON rutas_reparto(turno);
CREATE INDEX IF NOT EXISTS idx_rutas_reparto_zona_id ON rutas_reparto(zona_id);
CREATE INDEX IF NOT EXISTS idx_rutas_reparto_fecha_turno_zona ON rutas_reparto(fecha_ruta, turno, zona_id);

CREATE INDEX IF NOT EXISTS idx_presupuestos_turno ON presupuestos(turno);
CREATE INDEX IF NOT EXISTS idx_presupuestos_zona_turno ON presupuestos(zona_id, turno);

CREATE INDEX IF NOT EXISTS idx_zonas_dias_zona ON zonas_dias(zona_id);
CREATE INDEX IF NOT EXISTS idx_zonas_dias_dia_turno ON zonas_dias(dia_semana, turno);

CREATE INDEX IF NOT EXISTS idx_devoluciones_pedido ON devoluciones(pedido_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_detalle_ruta ON devoluciones(detalle_ruta_id);

CREATE INDEX IF NOT EXISTS idx_recepcion_almacen_producto ON recepcion_almacen(producto_id);
CREATE INDEX IF NOT EXISTS idx_recepcion_almacen_tipo ON recepcion_almacen(tipo);
CREATE INDEX IF NOT EXISTS idx_recepcion_almacen_fecha ON recepcion_almacen(created_at);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_caja_fecha ON cierres_caja(caja_id, fecha);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_estado ON cierres_caja(estado);

CREATE INDEX IF NOT EXISTS idx_tesoro_tipo ON tesoro(tipo);
CREATE INDEX IF NOT EXISTS idx_tesoro_fecha ON tesoro(created_at);

-- ===========================================
-- ACTUALIZAR FUNCIONES RPC EXISTENTES
-- ===========================================

-- Actualizar fn_convertir_presupuesto_a_pedido para copiar turno, zona_id y metodos_pago
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

    -- Validar que tenga turno y zona asignados
    IF v_presupuesto.turno IS NULL OR v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto debe tener turno y zona asignados antes de convertir');
    END IF;

    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido (copiar turno, zona_id y metodos_pago)
    INSERT INTO pedidos (
        numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
        estado, tipo_pedido, origen, total, subtotal, observaciones,
        presupuesto_id, turno, zona_id, metodos_pago, recargo_total
    ) VALUES (
        v_numero_pedido, v_presupuesto.cliente_id, v_presupuesto.usuario_vendedor,
        v_presupuesto.fecha_entrega_estimada, 'preparando', 'venta', 'presupuesto',
        v_presupuesto.total_final, v_presupuesto.total_final, v_presupuesto.observaciones,
        p_presupuesto_id, v_presupuesto.turno, v_presupuesto.zona_id, 
        v_presupuesto.metodos_pago, COALESCE(v_presupuesto.recargo_total, 0)
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

-- Actualizar fn_crear_presupuesto_desde_bot (no asignar turno automáticamente)
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
    v_cliente_zona_id UUID;
BEGIN
    -- Intentar detectar zona del cliente si no se proporciona
    IF p_zona_id IS NULL THEN
        -- Buscar zona por nombre en zona_entrega del cliente
        SELECT z.id INTO v_cliente_zona_id
        FROM clientes c
        LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(c.zona_entrega))
        WHERE c.id = p_cliente_id
        LIMIT 1;
        
        p_zona_id := v_cliente_zona_id;
    END IF;

    -- Generar número de presupuesto único
    v_numero_presupuesto := 'PRES-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear presupuesto (sin turno, lo asigna vendedor)
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones, turno
    ) VALUES (
        v_numero_presupuesto, p_cliente_id, p_zona_id, 'pendiente', p_observaciones, NULL
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

        -- Determinar si es pesable (productos con categoria BALANZA)
        INSERT INTO presupuesto_items (
            presupuesto_id, producto_id, cantidad_solicitada,
            precio_unit_est, subtotal_est, pesable
        ) VALUES (
            v_presupuesto_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            v_precio_unit,
            v_subtotal,
            EXISTS (SELECT 1 FROM productos WHERE id = (v_item->>'producto_id')::UUID AND categoria = 'BALANZA')
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

-- Actualizar fn_asignar_vehiculos_por_peso para filtrar por turno
CREATE OR REPLACE FUNCTION fn_asignar_vehiculos_por_peso(
    p_fecha DATE,
    p_zona_id UUID DEFAULT NULL,
    p_turno VARCHAR(20) DEFAULT NULL
) RETURNS TABLE (
    presupuesto_id UUID,
    vehiculo_id UUID,
    peso_estimado DECIMAL(10,2),
    capacidad_restante DECIMAL(10,2)
) AS $$
DECLARE
    v_vehiculo RECORD;
    v_presupuesto RECORD;
    v_capacidad_restante DECIMAL(10,2);
    v_peso_acumulado DECIMAL(10,2);
BEGIN
    -- Iterar sobre vehículos disponibles
    FOR v_vehiculo IN
        SELECT * FROM vehiculos
        WHERE activo = true
        ORDER BY capacidad_kg DESC
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
            AND (p_turno IS NULL OR p.turno = p_turno)
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

-- ===========================================
-- NUEVAS FUNCIONES RPC
-- ===========================================

-- Función para asignar turno y zona a presupuesto
CREATE OR REPLACE FUNCTION fn_asignar_turno_zona_presupuesto(
    p_presupuesto_id UUID,
    p_turno VARCHAR(20),
    p_zona_id UUID,
    p_metodos_pago JSONB DEFAULT NULL,
    p_recargo_total DECIMAL(10,2) DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_zona_dia RECORD;
    v_dia_semana INTEGER;
    v_total_con_recargo DECIMAL(10,2);
BEGIN
    -- Obtener presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id AND estado = 'pendiente';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado o no está pendiente');
    END IF;

    -- Validar turno
    IF p_turno NOT IN ('mañana', 'tarde') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Turno inválido. Debe ser "mañana" o "tarde"');
    END IF;

    -- Validar que la zona tenga el día estipulado configurado
    v_dia_semana := EXTRACT(DOW FROM COALESCE(v_presupuesto.fecha_entrega_estimada, CURRENT_DATE))::INTEGER;
    
    SELECT * INTO v_zona_dia
    FROM zonas_dias
    WHERE zona_id = p_zona_id
    AND dia_semana = v_dia_semana
    AND turno = p_turno
    AND activo = true;

    IF NOT FOUND THEN
        -- Permitir excepciones (no bloquear, solo advertir)
        -- En producción se podría agregar un flag de excepción
    END IF;

    -- Calcular total con recargo
    v_total_con_recargo := COALESCE(v_presupuesto.total_estimado, 0) + p_recargo_total;

    -- Actualizar presupuesto
    UPDATE presupuestos
    SET turno = p_turno,
        zona_id = p_zona_id,
        metodos_pago = p_metodos_pago,
        recargo_total = p_recargo_total,
        total_estimado = v_total_con_recargo,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Turno y zona asignados exitosamente',
        'total_con_recargo', v_total_con_recargo
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para convertir presupuesto a cotización
CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_cotizacion(
    p_presupuesto_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_cotizacion_id UUID;
    v_numero_cotizacion VARCHAR(50);
    v_item RECORD;
BEGIN
    -- Obtener presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id AND estado = 'pendiente';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado o no está pendiente');
    END IF;

    -- Generar número de cotización
    v_numero_cotizacion := 'COT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear cotización
    INSERT INTO cotizaciones (
        numero_cotizacion, cliente_id, usuario_vendedor,
        subtotal, total, observaciones, estado
    ) VALUES (
        v_numero_cotizacion, v_presupuesto.cliente_id, v_presupuesto.usuario_vendedor,
        v_presupuesto.total_estimado, v_presupuesto.total_estimado + COALESCE(v_presupuesto.recargo_total, 0),
        v_presupuesto.observaciones, 'pendiente'
    ) RETURNING id INTO v_cotizacion_id;

    -- Copiar items a detalles_cotizacion
    FOR v_item IN
        SELECT * FROM presupuesto_items WHERE presupuesto_id = p_presupuesto_id
    LOOP
        INSERT INTO detalles_cotizacion (
            cotizacion_id, producto_id, cantidad, precio_unitario, subtotal
        ) VALUES (
            v_cotizacion_id, v_item.producto_id, v_item.cantidad_solicitada,
            v_item.precio_unit_est, v_item.subtotal_est
        );
    END LOOP;

    -- Actualizar presupuesto a estado cotización
    UPDATE presupuestos
    SET estado = 'cotizacion',
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    -- NO descuento stock (solo reserva preventiva que puede expirar)

    RETURN jsonb_build_object(
        'success', true,
        'cotizacion_id', v_cotizacion_id,
        'numero_cotizacion', v_numero_cotizacion
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
-- POLÍTICAS RLS PARA NUEVAS TABLAS
-- ===========================================

ALTER TABLE zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tesoro ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_almacen ENABLE ROW LEVEL SECURITY;

-- Políticas para zonas
CREATE POLICY "admin_zonas_full" ON zonas FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true)
);

CREATE POLICY "vendedor_zonas_read" ON zonas FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true)
);

-- Políticas para zonas_dias
CREATE POLICY "admin_zonas_dias_full" ON zonas_dias FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true)
);

CREATE POLICY "vendedor_zonas_dias_read" ON zonas_dias FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true)
);

-- Políticas para tesoro
CREATE POLICY "admin_tesoro_full" ON tesoro FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true)
);

CREATE POLICY "tesorero_tesoro_read" ON tesoro FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true)
);

-- Políticas para cierres_caja
CREATE POLICY "admin_cierres_caja_full" ON cierres_caja FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true)
);

CREATE POLICY "tesorero_cierres_caja_read" ON cierres_caja FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true)
);

-- Políticas para devoluciones
CREATE POLICY "admin_devoluciones_full" ON devoluciones FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true)
);

CREATE POLICY "repartidor_devoluciones_insert" ON devoluciones FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'repartidor' AND activo = true)
);

CREATE POLICY "repartidor_devoluciones_own" ON devoluciones FOR SELECT USING (
    usuario_id = auth.uid()
);

-- Políticas para recepcion_almacen
CREATE POLICY "admin_recepcion_almacen_full" ON recepcion_almacen FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true)
);

CREATE POLICY "almacenista_recepcion_almacen_full" ON recepcion_almacen FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista') AND activo = true)
);

-- ===========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ===========================================

COMMENT ON TABLE zonas IS 'Zonas de entrega del sistema';
COMMENT ON TABLE zonas_dias IS 'Configuración de días estipulados por zona y turno';
COMMENT ON TABLE tesoro IS 'Tesoro separado de cajas (dinero físico en casa central)';
COMMENT ON TABLE cierres_caja IS 'Cierres de caja diarios con totales';
COMMENT ON TABLE devoluciones IS 'Devoluciones de productos registradas por repartidores';
COMMENT ON TABLE recepcion_almacen IS 'Ingresos y egresos de almacén (recepciones)';

COMMENT ON COLUMN pedidos.turno IS 'Turno de entrega: mañana o tarde';
COMMENT ON COLUMN pedidos.zona_id IS 'Zona estipulada para el pedido';
COMMENT ON COLUMN pedidos.metodos_pago IS 'Múltiples formas de pago con recargos (JSONB)';
COMMENT ON COLUMN rutas_reparto.turno IS 'Turno de la ruta: mañana o tarde';
COMMENT ON COLUMN rutas_reparto.zona_id IS 'Zona estipulada para esta ruta';
COMMENT ON COLUMN presupuestos.turno IS 'Turno asignado por vendedor: mañana o tarde';
COMMENT ON COLUMN presupuestos.metodos_pago IS 'Múltiples formas de pago con recargos (JSONB)';

-- ===========================================
-- ROLLBACK (comentado para referencia)
-- ===========================================

/*
-- Para rollback, ejecutar en orden inverso:

DROP FUNCTION IF EXISTS fn_convertir_presupuesto_a_cotizacion;
DROP FUNCTION IF EXISTS fn_asignar_turno_zona_presupuesto;
DROP FUNCTION IF EXISTS fn_asignar_vehiculos_por_peso;
DROP FUNCTION IF EXISTS fn_crear_presupuesto_desde_bot;
DROP FUNCTION IF EXISTS fn_convertir_presupuesto_a_pedido;

DROP TRIGGER IF EXISTS trigger_actualizar_pesable_por_categoria ON productos;
DROP FUNCTION IF EXISTS fn_actualizar_pesable_por_categoria;

DROP TABLE IF EXISTS recepcion_almacen;
DROP TABLE IF EXISTS devoluciones;
DROP TABLE IF EXISTS cierres_caja;
DROP TABLE IF EXISTS tesoro;
DROP TABLE IF EXISTS zonas_dias;
DROP TABLE IF EXISTS zonas;

ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS presupuestos_estado_check;
ALTER TABLE presupuestos DROP COLUMN IF EXISTS recargo_total;
ALTER TABLE presupuestos DROP COLUMN IF EXISTS metodos_pago;
ALTER TABLE presupuestos DROP COLUMN IF EXISTS turno;

ALTER TABLE rutas_reparto DROP COLUMN IF EXISTS checklist_fin_id;
ALTER TABLE rutas_reparto DROP COLUMN IF EXISTS checklist_inicio_id;
ALTER TABLE rutas_reparto DROP COLUMN IF EXISTS zona_id;
ALTER TABLE rutas_reparto DROP COLUMN IF EXISTS turno;

ALTER TABLE pedidos DROP COLUMN IF EXISTS recargo_total;
ALTER TABLE pedidos DROP COLUMN IF EXISTS metodos_pago;
ALTER TABLE pedidos DROP COLUMN IF EXISTS zona_id;
ALTER TABLE pedidos DROP COLUMN IF EXISTS turno;
*/

