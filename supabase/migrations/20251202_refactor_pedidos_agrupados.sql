-- ===========================================
-- MIGRACIÓN: Refactorizar sistema de pedidos agrupados por turno/zona/fecha
-- Fecha: 02/12/2025
-- Descripción:
--   - Un pedido agrupa todos los presupuestos del mismo turno + zona + fecha
--   - Cada cliente tiene su propia "entrega" dentro del pedido
--   - El pedido se cierra automáticamente cuando pasa el horario de corte
--   - Pedido = Ruta (1 pedido = 1 ruta de reparto)
-- ===========================================

BEGIN;

-- ===========================================
-- 1. NUEVA TABLA: entregas
-- Representa la porción del pedido que corresponde a un cliente específico
-- ===========================================

CREATE TABLE IF NOT EXISTS entregas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    presupuesto_id UUID REFERENCES presupuestos(id),
    
    -- Totales de esta entrega
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    recargo DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Dirección y ubicación (copiados del cliente para histórico)
    direccion TEXT,
    coordenadas GEOMETRY(POINT, 4326),
    
    -- Estado de entrega
    orden_entrega INTEGER, -- orden en la ruta
    estado_entrega VARCHAR(50) DEFAULT 'pendiente' CHECK (estado_entrega IN ('pendiente', 'en_camino', 'entregado', 'fallido', 'parcial')),
    fecha_hora_entrega TIMESTAMPTZ,
    notas_entrega TEXT,
    firma_url VARCHAR(500),
    qr_verificacion VARCHAR(100),
    
    -- Estado de pago
    estado_pago VARCHAR(20) DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'parcial', 'pagado', 'fiado')),
    metodo_pago VARCHAR(50),
    monto_cobrado DECIMAL(12,2) DEFAULT 0,
    numero_transaccion VARCHAR(100),
    comprobante_url VARCHAR(500),
    notas_pago TEXT,
    pago_validado BOOLEAN DEFAULT false,
    
    -- Referencia de pago para clientes que fían
    referencia_pago VARCHAR(60),
    instruccion_repartidor TEXT,
    
    -- Observaciones del presupuesto original
    observaciones TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para entregas
CREATE INDEX IF NOT EXISTS idx_entregas_pedido_id ON entregas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_entregas_cliente_id ON entregas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_entregas_presupuesto_id ON entregas(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_entregas_estado_entrega ON entregas(estado_entrega);
CREATE INDEX IF NOT EXISTS idx_entregas_estado_pago ON entregas(estado_pago);
CREATE INDEX IF NOT EXISTS idx_entregas_coordenadas ON entregas USING GIST (coordenadas);

-- ===========================================
-- 2. MODIFICAR TABLA: pedidos
-- Agregar campos para agrupación y cierre
-- ===========================================

-- Hacer cliente_id opcional (ya no es 1 cliente por pedido)
ALTER TABLE pedidos ALTER COLUMN cliente_id DROP NOT NULL;

-- Agregar campos de agrupación y cierre
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS estado_cierre VARCHAR(20) DEFAULT 'abierto' CHECK (estado_cierre IN ('abierto', 'cerrado')),
ADD COLUMN IF NOT EXISTS hora_cierre TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cantidad_entregas INTEGER DEFAULT 0;

-- Cerrar todos los pedidos existentes antes de crear el índice único
-- (los pedidos antiguos no usan el nuevo modelo de agrupación)
UPDATE pedidos 
SET estado_cierre = 'cerrado',
    hora_cierre = COALESCE(fecha_entrega_real, updated_at, NOW())
WHERE estado_cierre = 'abierto' OR estado_cierre IS NULL;

-- Agregar índice único para evitar duplicados de pedido abierto por turno/zona/fecha
-- Solo aplica a pedidos nuevos que usen el modelo de agrupación
DROP INDEX IF EXISTS idx_pedidos_turno_zona_fecha_abierto;
CREATE UNIQUE INDEX idx_pedidos_turno_zona_fecha_abierto 
ON pedidos(turno, zona_id, fecha_entrega_estimada) 
WHERE estado_cierre = 'abierto' AND turno IS NOT NULL AND zona_id IS NOT NULL;

-- ===========================================
-- 3. MODIFICAR TABLA: detalles_pedido
-- Agregar referencia a entrega
-- ===========================================

ALTER TABLE detalles_pedido 
ADD COLUMN IF NOT EXISTS entrega_id UUID REFERENCES entregas(id);

CREATE INDEX IF NOT EXISTS idx_detalles_pedido_entrega_id ON detalles_pedido(entrega_id);

-- ===========================================
-- 4. FUNCIÓN: fn_obtener_o_crear_pedido_abierto
-- Busca pedido abierto para turno/zona/fecha, si no existe lo crea
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_o_crear_pedido_abierto(
    p_zona_id UUID,
    p_turno TEXT,
    p_fecha DATE
) RETURNS UUID AS $$
DECLARE
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_hora_corte INTEGER;
BEGIN
    -- Validar parámetros
    IF p_zona_id IS NULL THEN
        RAISE EXCEPTION 'La zona es requerida';
    END IF;
    
    IF p_turno IS NULL OR p_turno NOT IN ('mañana', 'tarde') THEN
        RAISE EXCEPTION 'El turno debe ser mañana o tarde';
    END IF;
    
    IF p_fecha IS NULL THEN
        p_fecha := DATE(v_now_ba);
    END IF;
    
    -- Verificar si el pedido ya está cerrado por horario
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    -- Horarios de corte: mañana = 5:00, tarde = 15:00
    IF p_turno = 'mañana' THEN
        v_hora_corte := 5;
    ELSE
        v_hora_corte := 15;
    END IF;
    
    -- Si es el mismo día y ya pasó el horario de corte, no permitir agregar
    IF p_fecha = DATE(v_now_ba) AND v_hora_actual >= v_hora_corte THEN
        -- Cerrar el pedido existente si está abierto
        UPDATE pedidos 
        SET estado_cierre = 'cerrado',
            hora_cierre = v_now_ba,
            updated_at = NOW()
        WHERE zona_id = p_zona_id 
          AND turno = p_turno 
          AND fecha_entrega_estimada = p_fecha
          AND estado_cierre = 'abierto';
        
        RAISE EXCEPTION 'El horario de corte para el turno % ya pasó (% hs)', p_turno, v_hora_corte;
    END IF;
    
    -- Buscar pedido abierto existente
    SELECT id INTO v_pedido_id
    FROM pedidos
    WHERE zona_id = p_zona_id
      AND turno = p_turno
      AND fecha_entrega_estimada = p_fecha
      AND estado_cierre = 'abierto'
    LIMIT 1;
    
    -- Si no existe, crear uno nuevo
    IF v_pedido_id IS NULL THEN
        -- Generar número de pedido único
        v_numero_pedido := 'PED-' || TO_CHAR(p_fecha, 'YYYYMMDD') || '-' || 
                          UPPER(SUBSTRING(p_turno FROM 1 FOR 1)) || '-' ||
                          UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
        
        INSERT INTO pedidos (
            numero_pedido,
            zona_id,
            turno,
            fecha_entrega_estimada,
            estado,
            estado_cierre,
            tipo_pedido,
            origen,
            subtotal,
            total,
            cantidad_entregas
        ) VALUES (
            v_numero_pedido,
            p_zona_id,
            p_turno,
            p_fecha,
            'preparando',
            'abierto',
            'venta',
            'agrupado',
            0,
            0,
            0
        ) RETURNING id INTO v_pedido_id;
    END IF;
    
    RETURN v_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_obtener_o_crear_pedido_abierto(UUID, TEXT, DATE) IS 
'Obtiene el pedido abierto para una combinación turno/zona/fecha, o lo crea si no existe. Valida horarios de corte.';

-- ===========================================
-- 5. FUNCIÓN: fn_agregar_presupuesto_a_pedido
-- Agrega un presupuesto como entrega dentro del pedido
-- ===========================================

CREATE OR REPLACE FUNCTION fn_agregar_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_pedido_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_item RECORD;
    v_entrega_id UUID;
    v_total_items DECIMAL(12,2) := 0;
    v_recargo DECIMAL(12,2) := 0;
    v_total_entrega DECIMAL(12,2) := 0;
    v_cliente RECORD;
    v_cantidad_a_consumir DECIMAL(12,3);
    v_referencia_pago VARCHAR(60);
    v_instruccion_repartidor TEXT;
    v_cuenta_id UUID;
    v_orden_entrega INTEGER;
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
    
    -- Marcar cliente como deudor
    UPDATE clientes
    SET bloqueado_por_deuda = true
    WHERE id = v_presupuesto.cliente_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'entrega_id', v_entrega_id,
        'pedido_id', p_pedido_id,
        'cliente_id', v_presupuesto.cliente_id,
        'total_entrega', v_total_entrega,
        'referencia_pago', v_referencia_pago,
        'orden_entrega', v_orden_entrega
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
'Agrega un presupuesto como entrega dentro de un pedido existente. Crea los detalles, descuenta stock y registra en cuenta corriente.';

-- ===========================================
-- 6. FUNCIÓN: fn_convertir_presupuesto_a_pedido (MODIFICADA)
-- Ahora usa la lógica de pedidos agrupados
-- ===========================================

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_pedido_id UUID;
    v_turno TEXT;
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_result JSONB;
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_numero_pedido VARCHAR(50);
BEGIN
    -- Obtener datos del presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;
    
    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no está en un estado válido para facturar');
    END IF;
    
    -- Validar que tenga zona asignada
    IF v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto debe tener una zona asignada');
    END IF;
    
    -- Validar productos pesables
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true;
    
    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true
      AND peso_final IS NOT NULL;
    
    IF v_presupuesto.estado = 'pendiente' AND v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este presupuesto tiene productos balanza que deben pesarse en almacén');
    END IF;
    
    -- Determinar turno y fecha de entrega
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    IF v_presupuesto.turno IS NULL THEN
        -- Lógica de horarios de corte
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        ELSE
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
        END IF;
        
        -- Actualizar presupuesto con turno y fecha
        UPDATE presupuestos
        SET turno = v_turno,
            fecha_entrega_estimada = v_fecha_entrega,
            updated_at = NOW()
        WHERE id = p_presupuesto_id;
    ELSE
        v_turno := v_presupuesto.turno;
        v_fecha_entrega := COALESCE(v_presupuesto.fecha_entrega_estimada, DATE(v_now_ba));
    END IF;
    
    -- Obtener o crear pedido abierto para este turno/zona/fecha
    BEGIN
        v_pedido_id := fn_obtener_o_crear_pedido_abierto(
            v_presupuesto.zona_id,
            v_turno,
            v_fecha_entrega
        );
    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
    
    -- Agregar presupuesto al pedido como entrega
    v_result := fn_agregar_presupuesto_a_pedido(
        p_presupuesto_id,
        v_pedido_id,
        p_user_id
    );
    
    IF NOT (v_result->>'success')::BOOLEAN THEN
        RETURN v_result;
    END IF;
    
    -- Obtener número de pedido para la respuesta
    SELECT numero_pedido INTO v_numero_pedido
    FROM pedidos WHERE id = v_pedido_id;
    
    -- Agregar información adicional al resultado
    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'entrega_id', v_result->>'entrega_id',
        'cliente_id', v_result->>'cliente_id',
        'total_entrega', v_result->>'total_entrega',
        'referencia_pago', v_result->>'referencia_pago',
        'turno', v_turno,
        'fecha_entrega', v_fecha_entrega,
        'mensaje', 'Presupuesto agregado al pedido ' || v_numero_pedido
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al convertir presupuesto: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_pedido(UUID, UUID, UUID) IS 
'Convierte un presupuesto a entrega dentro de un pedido agrupado por turno/zona/fecha.';

-- ===========================================
-- 7. FUNCIÓN: fn_cerrar_pedidos_por_horario
-- Job automático que cierra pedidos cuando pasa el horario de corte
-- ===========================================

CREATE OR REPLACE FUNCTION fn_cerrar_pedidos_por_horario()
RETURNS INTEGER AS $$
DECLARE
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_fecha_actual DATE;
    v_pedidos_cerrados INTEGER := 0;
    v_count INTEGER := 0;
BEGIN
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    v_fecha_actual := DATE(v_now_ba);
    
    -- Cerrar pedidos del turno mañana si pasó las 5:00
    IF v_hora_actual >= 5 THEN
        UPDATE pedidos
        SET estado_cierre = 'cerrado',
            hora_cierre = v_now_ba,
            updated_at = NOW()
        WHERE turno = 'mañana'
          AND fecha_entrega_estimada = v_fecha_actual
          AND estado_cierre = 'abierto';
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_pedidos_cerrados := v_pedidos_cerrados + v_count;
    END IF;
    
    -- Cerrar pedidos del turno tarde si pasó las 15:00
    IF v_hora_actual >= 15 THEN
        UPDATE pedidos
        SET estado_cierre = 'cerrado',
            hora_cierre = v_now_ba,
            updated_at = NOW()
        WHERE turno = 'tarde'
          AND fecha_entrega_estimada = v_fecha_actual
          AND estado_cierre = 'abierto';
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_pedidos_cerrados := v_pedidos_cerrados + v_count;
    END IF;
    
    -- También cerrar pedidos de días anteriores que quedaron abiertos
    UPDATE pedidos
    SET estado_cierre = 'cerrado',
        hora_cierre = v_now_ba,
        updated_at = NOW()
    WHERE fecha_entrega_estimada < v_fecha_actual
      AND estado_cierre = 'abierto';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_pedidos_cerrados := v_pedidos_cerrados + v_count;
    
    RETURN v_pedidos_cerrados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_cerrar_pedidos_por_horario() IS 
'Cierra automáticamente los pedidos cuando pasa el horario de corte del turno. Ejecutar con pg_cron cada 5 minutos.';

-- ===========================================
-- 8. FUNCIÓN: fn_obtener_entregas_pedido
-- Obtiene todas las entregas de un pedido con datos del cliente
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_entregas_pedido(p_pedido_id UUID)
RETURNS TABLE (
    entrega_id UUID,
    cliente_id UUID,
    cliente_nombre VARCHAR,
    cliente_telefono VARCHAR,
    presupuesto_id UUID,
    numero_presupuesto VARCHAR,
    subtotal DECIMAL,
    recargo DECIMAL,
    total DECIMAL,
    direccion TEXT,
    orden_entrega INTEGER,
    estado_entrega VARCHAR,
    estado_pago VARCHAR,
    metodo_pago VARCHAR,
    monto_cobrado DECIMAL,
    referencia_pago VARCHAR,
    observaciones TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as entrega_id,
        e.cliente_id,
        c.nombre as cliente_nombre,
        c.telefono as cliente_telefono,
        e.presupuesto_id,
        p.numero_presupuesto,
        e.subtotal,
        e.recargo,
        e.total,
        e.direccion,
        e.orden_entrega,
        e.estado_entrega,
        e.estado_pago,
        e.metodo_pago,
        e.monto_cobrado,
        e.referencia_pago,
        e.observaciones
    FROM entregas e
    INNER JOIN clientes c ON e.cliente_id = c.id
    LEFT JOIN presupuestos p ON e.presupuesto_id = p.id
    WHERE e.pedido_id = p_pedido_id
    ORDER BY e.orden_entrega;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 9. FUNCIÓN: fn_registrar_cobro_entrega
-- Registra el cobro de una entrega específica
-- ===========================================

CREATE OR REPLACE FUNCTION fn_registrar_cobro_entrega(
    p_entrega_id UUID,
    p_metodo_pago VARCHAR,
    p_monto_cobrado DECIMAL,
    p_repartidor_id UUID,
    p_numero_transaccion VARCHAR DEFAULT NULL,
    p_comprobante_url VARCHAR DEFAULT NULL,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_entrega RECORD;
    v_cuenta_id UUID;
    v_estado_pago VARCHAR;
BEGIN
    -- Obtener datos de la entrega
    SELECT * INTO v_entrega
    FROM entregas
    WHERE id = p_entrega_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entrega no encontrada');
    END IF;
    
    -- Determinar estado de pago
    IF p_monto_cobrado >= v_entrega.total THEN
        v_estado_pago := 'pagado';
    ELSIF p_monto_cobrado > 0 THEN
        v_estado_pago := 'parcial';
    ELSE
        v_estado_pago := 'fiado';
    END IF;
    
    -- Actualizar entrega
    UPDATE entregas
    SET metodo_pago = p_metodo_pago,
        monto_cobrado = p_monto_cobrado,
        numero_transaccion = p_numero_transaccion,
        comprobante_url = p_comprobante_url,
        notas_pago = p_notas,
        estado_pago = v_estado_pago,
        updated_at = NOW()
    WHERE id = p_entrega_id;
    
    -- Si se cobró algo, actualizar cuenta corriente
    IF p_monto_cobrado > 0 THEN
        SELECT fn_asegurar_cuenta_corriente(v_entrega.cliente_id) INTO v_cuenta_id;
        
        UPDATE cuentas_corrientes
        SET saldo = saldo - p_monto_cobrado,
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
            'abono',
            p_monto_cobrado,
            'Cobro en reparto - ' || COALESCE(p_metodo_pago, 'efectivo'),
            'entrega',
            p_entrega_id
        );
        
        -- Si quedó saldo 0 o negativo, desbloquear cliente
        IF (SELECT saldo FROM cuentas_corrientes WHERE id = v_cuenta_id) <= 0 THEN
            UPDATE clientes
            SET bloqueado_por_deuda = false
            WHERE id = v_entrega.cliente_id;
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'entrega_id', p_entrega_id,
        'estado_pago', v_estado_pago,
        'monto_cobrado', p_monto_cobrado
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al registrar cobro: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_registrar_cobro_entrega(UUID, VARCHAR, DECIMAL, UUID, VARCHAR, VARCHAR, TEXT) IS 
'Registra el cobro de una entrega específica y actualiza la cuenta corriente del cliente.';

-- ===========================================
-- 10. FUNCIÓN: fn_marcar_entrega_completada
-- Marca una entrega como completada
-- ===========================================

CREATE OR REPLACE FUNCTION fn_marcar_entrega_completada(
    p_entrega_id UUID,
    p_firma_url VARCHAR DEFAULT NULL,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_entrega RECORD;
    v_pedido_id UUID;
    v_entregas_pendientes INTEGER;
BEGIN
    -- Obtener datos de la entrega
    SELECT * INTO v_entrega
    FROM entregas
    WHERE id = p_entrega_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entrega no encontrada');
    END IF;
    
    v_pedido_id := v_entrega.pedido_id;
    
    -- Actualizar entrega
    UPDATE entregas
    SET estado_entrega = 'entregado',
        fecha_hora_entrega = NOW(),
        firma_url = COALESCE(p_firma_url, firma_url),
        notas_entrega = COALESCE(p_notas, notas_entrega),
        updated_at = NOW()
    WHERE id = p_entrega_id;
    
    -- Verificar si todas las entregas del pedido están completadas
    SELECT COUNT(*) INTO v_entregas_pendientes
    FROM entregas
    WHERE pedido_id = v_pedido_id
      AND estado_entrega NOT IN ('entregado', 'fallido');
    
    -- Si no hay entregas pendientes, marcar pedido como entregado
    IF v_entregas_pendientes = 0 THEN
        UPDATE pedidos
        SET estado = 'entregado',
            fecha_entrega_real = NOW(),
            updated_at = NOW()
        WHERE id = v_pedido_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'entrega_id', p_entrega_id,
        'pedido_completado', v_entregas_pendientes = 0
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al marcar entrega: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 11. RLS PARA TABLA entregas
-- ===========================================

ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;

-- Política para admin (acceso total)
CREATE POLICY "entregas_admin_all" ON entregas
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

-- Política para vendedor (lectura y creación)
CREATE POLICY "entregas_vendedor_select" ON entregas
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol IN ('admin', 'vendedor', 'almacenista') AND activo = true
    )
);

-- Política para repartidor (solo sus entregas asignadas)
CREATE POLICY "entregas_repartidor_select" ON entregas
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM pedidos p
        INNER JOIN rutas_reparto r ON r.id = (
            SELECT ruta_id FROM detalles_ruta WHERE pedido_id = p.id LIMIT 1
        )
        WHERE p.id = entregas.pedido_id
          AND r.repartidor_id = auth.uid()
    )
);

-- Política para repartidor (actualizar estado de entrega y pago)
CREATE POLICY "entregas_repartidor_update" ON entregas
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM pedidos p
        INNER JOIN rutas_reparto r ON r.id = (
            SELECT ruta_id FROM detalles_ruta WHERE pedido_id = p.id LIMIT 1
        )
        WHERE p.id = entregas.pedido_id
          AND r.repartidor_id = auth.uid()
    )
);

-- ===========================================
-- 12. TRIGGER: Actualizar updated_at en entregas
-- ===========================================

CREATE OR REPLACE FUNCTION trigger_entregas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entregas_updated_at ON entregas;
CREATE TRIGGER trg_entregas_updated_at
BEFORE UPDATE ON entregas
FOR EACH ROW
EXECUTE FUNCTION trigger_entregas_updated_at();

-- ===========================================
-- 13. CONFIGURAR pg_cron PARA CIERRE AUTOMÁTICO
-- (Requiere extensión pg_cron habilitada en Supabase)
-- ===========================================

-- Nota: Ejecutar manualmente en Supabase si pg_cron está disponible:
-- SELECT cron.schedule(
--     'cerrar-pedidos-por-horario',
--     '*/5 * * * *',  -- Cada 5 minutos
--     $$SELECT fn_cerrar_pedidos_por_horario()$$
-- );

COMMIT;

