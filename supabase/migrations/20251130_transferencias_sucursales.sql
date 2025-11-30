-- ===========================================
-- MIGRACIÓN: Sistema de Transferencias entre Sucursales
-- Fecha: 2025-11-30
-- ===========================================

-- Tabla de transferencias de stock entre sucursales
CREATE TABLE IF NOT EXISTS transferencias_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_transferencia VARCHAR(50) UNIQUE NOT NULL,
    sucursal_origen_id UUID NOT NULL REFERENCES sucursales(id),
    sucursal_destino_id UUID NOT NULL REFERENCES sucursales(id),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_transito', 'recibida', 'cancelada')),
    solicitado_por UUID REFERENCES usuarios(id),
    aprobado_por UUID REFERENCES usuarios(id),
    recibido_por UUID REFERENCES usuarios(id),
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
    fecha_aprobacion TIMESTAMPTZ,
    fecha_envio TIMESTAMPTZ,
    fecha_recepcion TIMESTAMPTZ,
    observaciones TEXT,
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT diferentes_sucursales CHECK (sucursal_origen_id != sucursal_destino_id)
);

-- Detalles de items en la transferencia
CREATE TABLE IF NOT EXISTS transferencia_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transferencia_id UUID NOT NULL REFERENCES transferencias_stock(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_origen_id UUID REFERENCES lotes(id),
    lote_destino_id UUID REFERENCES lotes(id),
    cantidad_solicitada DECIMAL(10,3) NOT NULL,
    cantidad_enviada DECIMAL(10,3),
    cantidad_recibida DECIMAL(10,3),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_transferencias_sucursal_origen ON transferencias_stock(sucursal_origen_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_sucursal_destino ON transferencias_stock(sucursal_destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado ON transferencias_stock(estado);
CREATE INDEX IF NOT EXISTS idx_transferencias_fecha ON transferencias_stock(fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_transferencia_items_transferencia ON transferencia_items(transferencia_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_items_producto ON transferencia_items(producto_id);

-- RLS para transferencias_stock
ALTER TABLE transferencias_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_transferencias" ON transferencias_stock
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "sucursal_access_transferencias" ON transferencias_stock
    USING (
        sucursal_origen_id = (current_setting('jwt.claims.sucursal_id', true))::UUID OR
        sucursal_destino_id = (current_setting('jwt.claims.sucursal_id', true))::UUID
    );

-- RLS para transferencia_items
ALTER TABLE transferencia_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_transferencia_items" ON transferencia_items
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "sucursal_access_items" ON transferencia_items
    USING (
        transferencia_id IN (
            SELECT id FROM transferencias_stock
            WHERE sucursal_origen_id = (current_setting('jwt.claims.sucursal_id', true))::UUID
            OR sucursal_destino_id = (current_setting('jwt.claims.sucursal_id', true))::UUID
        )
    );

-- ===========================================
-- FUNCIÓN: Crear transferencia entre sucursales
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_transferencia_stock(
    p_sucursal_origen_id UUID,
    p_sucursal_destino_id UUID,
    p_items JSONB,
    p_motivo TEXT DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_transferencia_id UUID;
    v_numero_transferencia VARCHAR(50);
    v_item JSONB;
    v_stock_disponible DECIMAL(10,3);
    v_producto_nombre VARCHAR(255);
BEGIN
    -- Validar que las sucursales sean diferentes
    IF p_sucursal_origen_id = p_sucursal_destino_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La sucursal origen y destino deben ser diferentes'
        );
    END IF;

    -- Validar stock disponible de todos los productos en sucursal origen
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT nombre INTO v_producto_nombre
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Producto no encontrado: ' || (v_item->>'producto_id')
            );
        END IF;

        -- Verificar stock en sucursal origen
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
        AND l.sucursal_id = p_sucursal_origen_id
        AND l.estado = 'disponible';

        IF v_stock_disponible < (v_item->>'cantidad')::DECIMAL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Stock insuficiente en sucursal origen para ' || v_producto_nombre || '. Disponible: ' || v_stock_disponible::TEXT,
                'producto_nombre', v_producto_nombre,
                'cantidad_solicitada', (v_item->>'cantidad')::DECIMAL,
                'stock_disponible', v_stock_disponible
            );
        END IF;
    END LOOP;

    -- Generar número de transferencia único
    v_numero_transferencia := 'TRANS-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear transferencia
    INSERT INTO transferencias_stock (
        numero_transferencia,
        sucursal_origen_id,
        sucursal_destino_id,
        estado,
        motivo,
        observaciones,
        solicitado_por
    ) VALUES (
        v_numero_transferencia,
        p_sucursal_origen_id,
        p_sucursal_destino_id,
        'pendiente',
        p_motivo,
        p_observaciones,
        p_user_id
    ) RETURNING id INTO v_transferencia_id;

    -- Crear items de transferencia
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO transferencia_items (
            transferencia_id,
            producto_id,
            cantidad_solicitada
        ) VALUES (
            v_transferencia_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transferencia_id', v_transferencia_id,
        'numero_transferencia', v_numero_transferencia
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
-- FUNCIÓN: Aprobar y enviar transferencia
-- ===========================================

CREATE OR REPLACE FUNCTION fn_aprobar_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
    v_item RECORD;
    v_lote_origen_id UUID;
    v_stock_disponible DECIMAL(10,3);
BEGIN
    -- Obtener transferencia
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    IF v_transferencia.estado != 'pendiente' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden aprobar transferencias pendientes');
    END IF;

    -- Procesar cada item y descontar stock de sucursal origen
    FOR v_item IN
        SELECT * FROM transferencia_items WHERE transferencia_id = p_transferencia_id
    LOOP
        -- Verificar stock disponible
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = v_item.producto_id
        AND l.sucursal_id = v_transferencia.sucursal_origen_id
        AND l.estado = 'disponible';

        IF v_stock_disponible < v_item.cantidad_solicitada THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Stock insuficiente en sucursal origen al momento de aprobar'
            );
        END IF;

        -- Obtener lote origen (FIFO)
        SELECT id INTO v_lote_origen_id
        FROM lotes
        WHERE producto_id = v_item.producto_id
        AND sucursal_id = v_transferencia.sucursal_origen_id
        AND estado = 'disponible'
        AND cantidad_disponible >= v_item.cantidad_solicitada
        ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC
        LIMIT 1;

        IF v_lote_origen_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'No hay lote con capacidad suficiente en sucursal origen'
            );
        END IF;

        -- Descontar del lote origen
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible - v_item.cantidad_solicitada,
            updated_at = NOW()
        WHERE id = v_lote_origen_id;

        -- Registrar movimiento
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_lote_origen_id,
            'salida',
            v_item.cantidad_solicitada,
            'Transferencia a otra sucursal: ' || v_transferencia.numero_transferencia,
            p_user_id
        );

        -- Actualizar item con lote origen y cantidad enviada
        UPDATE transferencia_items
        SET lote_origen_id = v_lote_origen_id,
            cantidad_enviada = v_item.cantidad_solicitada
        WHERE id = v_item.id;
    END LOOP;

    -- Actualizar transferencia
    UPDATE transferencias_stock
    SET estado = 'en_transito',
        fecha_aprobacion = NOW(),
        fecha_envio = NOW(),
        aprobado_por = p_user_id,
        updated_at = NOW()
    WHERE id = p_transferencia_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia aprobada y enviada'
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
-- FUNCIÓN: Recibir transferencia en sucursal destino
-- ===========================================

CREATE OR REPLACE FUNCTION fn_recibir_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
    v_item RECORD;
    v_lote_destino_id UUID;
    v_lote_origen RECORD;
BEGIN
    -- Obtener transferencia
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    IF v_transferencia.estado != 'en_transito' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden recibir transferencias en tránsito');
    END IF;

    -- Procesar cada item y crear lotes en sucursal destino
    FOR v_item IN
        SELECT * FROM transferencia_items WHERE transferencia_id = p_transferencia_id
    LOOP
        -- Obtener datos del lote origen para replicar
        SELECT * INTO v_lote_origen
        FROM lotes
        WHERE id = v_item.lote_origen_id;

        -- Crear nuevo lote en sucursal destino
        INSERT INTO lotes (
            producto_id,
            sucursal_id,
            cantidad_inicial,
            cantidad_disponible,
            precio_compra,
            fecha_ingreso,
            fecha_vencimiento,
            proveedor_id,
            estado,
            numero_lote
        ) VALUES (
            v_item.producto_id,
            v_transferencia.sucursal_destino_id,
            v_item.cantidad_enviada,
            v_item.cantidad_enviada,
            v_lote_origen.precio_compra,
            NOW(),
            v_lote_origen.fecha_vencimiento,
            v_lote_origen.proveedor_id,
            'disponible',
            'TRANS-' || v_lote_origen.numero_lote
        ) RETURNING id INTO v_lote_destino_id;

        -- Registrar movimiento de ingreso
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_lote_destino_id,
            'ingreso',
            v_item.cantidad_enviada,
            'Transferencia desde otra sucursal: ' || v_transferencia.numero_transferencia,
            p_user_id
        );

        -- Actualizar item con lote destino y cantidad recibida
        UPDATE transferencia_items
        SET lote_destino_id = v_lote_destino_id,
            cantidad_recibida = v_item.cantidad_enviada
        WHERE id = v_item.id;
    END LOOP;

    -- Actualizar transferencia
    UPDATE transferencias_stock
    SET estado = 'recibida',
        fecha_recepcion = NOW(),
        recibido_por = p_user_id,
        updated_at = NOW()
    WHERE id = p_transferencia_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia recibida exitosamente'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE transferencias_stock IS 'Transferencias de stock entre sucursales';
COMMENT ON TABLE transferencia_items IS 'Items individuales de transferencias entre sucursales';
COMMENT ON FUNCTION fn_crear_transferencia_stock IS 'Crea una nueva transferencia entre sucursales con validación de stock';
COMMENT ON FUNCTION fn_aprobar_transferencia IS 'Aprueba transferencia y descuenta stock de sucursal origen';
COMMENT ON FUNCTION fn_recibir_transferencia IS 'Recibe transferencia en sucursal destino y crea lotes';
