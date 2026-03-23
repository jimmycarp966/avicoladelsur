-- ===========================================
-- MIGRACIÓN: Transferencias integradas al flujo de Presupuestos
-- Fecha: 2025-12-02
-- Descripción:
--   - Nuevos estados: solicitud → en_almacen → preparado → en_ruta → entregado → recibido
--   - Campos para turno, fecha_entrega, zona_id, ruta_id
--   - Integración con rutas de reparto (sucursal destino como "cliente interno")
--   - Reserva de stock al crear, descuenta al preparar, suma al destino al recibir
-- ===========================================

-- 0. Eliminar funciones existentes para evitar conflictos de firma
DROP FUNCTION IF EXISTS fn_crear_transferencia_stock(UUID, UUID, JSONB, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS fn_crear_transferencia_stock(UUID, UUID, JSONB, TEXT, TEXT, UUID, DATE);
DROP FUNCTION IF EXISTS fn_aprobar_transferencia(UUID, UUID);
DROP FUNCTION IF EXISTS fn_recibir_transferencia(UUID, UUID);
DROP FUNCTION IF EXISTS fn_recibir_transferencia(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS fn_preparar_transferencia(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS fn_asignar_transferencia_a_ruta(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS fn_entregar_transferencia(UUID, UUID);
DROP FUNCTION IF EXISTS fn_cancelar_transferencia(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS fn_obtener_transferencias_dia(DATE, VARCHAR, UUID);
DROP FUNCTION IF EXISTS fn_calcular_turno_fecha_entrega(DATE);
DROP FUNCTION IF EXISTS fn_obtener_transferencias_en_ruta(UUID);

-- 1. Agregar nuevos campos a transferencias_stock
ALTER TABLE transferencias_stock 
ADD COLUMN IF NOT EXISTS turno VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fecha_entrega DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zona_id UUID REFERENCES zonas(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ruta_id UUID REFERENCES rutas_reparto(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preparado_por UUID REFERENCES usuarios(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fecha_preparacion TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS entregado_por UUID REFERENCES usuarios(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fecha_entregado TIMESTAMPTZ DEFAULT NULL;

-- 2. Actualizar constraint de estados para incluir los nuevos
ALTER TABLE transferencias_stock DROP CONSTRAINT IF EXISTS transferencias_stock_estado_check;
ALTER TABLE transferencias_stock ADD CONSTRAINT transferencias_stock_estado_check 
CHECK (estado IN ('solicitud', 'en_almacen', 'preparado', 'en_ruta', 'entregado', 'recibido', 'cancelada', 
                  'pendiente', 'en_transito', 'recibida')); -- mantener compatibilidad con estados anteriores

-- 3. Agregar campos para pesaje en transferencia_items (como presupuesto_items)
ALTER TABLE transferencia_items
ADD COLUMN IF NOT EXISTS peso_preparado DECIMAL(10,3) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS requiere_pesaje BOOLEAN DEFAULT FALSE;

-- 4. Crear índices para los nuevos campos
CREATE INDEX IF NOT EXISTS idx_transferencias_turno ON transferencias_stock(turno);
CREATE INDEX IF NOT EXISTS idx_transferencias_fecha_entrega ON transferencias_stock(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_transferencias_zona ON transferencias_stock(zona_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_ruta ON transferencias_stock(ruta_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado_fecha ON transferencias_stock(estado, fecha_entrega);

-- ===========================================
-- FUNCIÓN: Calcular turno automático (reutilizable)
-- ===========================================
CREATE OR REPLACE FUNCTION fn_calcular_turno_fecha_entrega(
    p_fecha_solicitada DATE DEFAULT NULL
) RETURNS TABLE(turno VARCHAR(20), fecha_entrega DATE) AS $$
DECLARE
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER := EXTRACT(HOUR FROM v_now_ba);
    v_turno VARCHAR(20);
    v_fecha DATE;
BEGIN
    IF p_fecha_solicitada IS NULL THEN
        -- Asignar fecha según horario de corte
        IF v_hora_actual < 5 THEN
            -- Antes de las 5 AM → turno mañana del mismo día
            v_turno := 'mañana';
            v_fecha := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            -- Entre 5 AM y 3 PM → turno tarde del mismo día
            v_turno := 'tarde';
            v_fecha := DATE(v_now_ba);
        ELSE
            -- Después de las 3 PM → turno mañana del día siguiente
            v_turno := 'mañana';
            v_fecha := DATE(v_now_ba) + INTERVAL '1 day';
        END IF;
    ELSE
        v_fecha := p_fecha_solicitada;
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
        ELSE
            IF p_fecha_solicitada = DATE(v_now_ba) THEN
                v_turno := 'mañana';
                v_fecha := DATE(v_now_ba) + INTERVAL '1 day';
            ELSE
                v_turno := 'mañana';
            END IF;
        END IF;
    END IF;
    
    RETURN QUERY SELECT v_turno, v_fecha;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================================
-- FUNCIÓN: Crear transferencia con nuevo flujo
-- ===========================================
CREATE OR REPLACE FUNCTION fn_crear_transferencia_stock(
    p_sucursal_origen_id UUID,
    p_sucursal_destino_id UUID,
    p_items JSONB,
    p_motivo TEXT DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_fecha_entrega DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_transferencia_id UUID;
    v_numero_transferencia VARCHAR(50);
    v_item JSONB;
    v_stock_disponible DECIMAL(10,3);
    v_producto_nombre VARCHAR(255);
    v_producto RECORD;
    v_turno VARCHAR(20);
    v_fecha_entrega DATE;
    v_zona_id UUID;
BEGIN
    -- Validar que las sucursales sean diferentes
    IF p_sucursal_origen_id = p_sucursal_destino_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La sucursal origen y destino deben ser diferentes'
        );
    END IF;

    -- Validar stock disponible y reservar para todos los productos en sucursal origen
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT nombre, pesable INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Producto no encontrado: ' || (v_item->>'producto_id')
            );
        END IF;

        v_producto_nombre := v_producto.nombre;

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

    -- Calcular turno y fecha de entrega automáticamente
    SELECT t.turno, t.fecha_entrega INTO v_turno, v_fecha_entrega
    FROM fn_calcular_turno_fecha_entrega(p_fecha_entrega) t;

    -- Obtener zona de la sucursal destino (para integración con rutas)
    SELECT z.id INTO v_zona_id
    FROM sucursales s
    LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(s.direccion))
    WHERE s.id = p_sucursal_destino_id
    LIMIT 1;

    -- Generar número de transferencia único
    v_numero_transferencia := 'TRANS-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear transferencia con estado inicial 'en_almacen' (como presupuestos del día)
    INSERT INTO transferencias_stock (
        numero_transferencia,
        sucursal_origen_id,
        sucursal_destino_id,
        estado,
        motivo,
        observaciones,
        solicitado_por,
        turno,
        fecha_entrega,
        zona_id
    ) VALUES (
        v_numero_transferencia,
        p_sucursal_origen_id,
        p_sucursal_destino_id,
        'en_almacen', -- Nuevo estado: aparece en Presupuestos del Día
        p_motivo,
        p_observaciones,
        p_user_id,
        v_turno,
        v_fecha_entrega,
        v_zona_id
    ) RETURNING id INTO v_transferencia_id;

    -- Crear items de transferencia con info de pesaje
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT pesable INTO v_producto FROM productos WHERE id = (v_item->>'producto_id')::UUID;
        
        INSERT INTO transferencia_items (
            transferencia_id,
            producto_id,
            cantidad_solicitada,
            requiere_pesaje
        ) VALUES (
            v_transferencia_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            COALESCE(v_producto.pesable, FALSE)
        );

        -- Reservar stock (descontar del disponible)
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible - (v_item->>'cantidad')::DECIMAL,
            updated_at = NOW()
        WHERE id = (
            SELECT id FROM lotes
            WHERE producto_id = (v_item->>'producto_id')::UUID
            AND sucursal_id = p_sucursal_origen_id
            AND estado = 'disponible'
            AND cantidad_disponible >= (v_item->>'cantidad')::DECIMAL
            ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC
            LIMIT 1
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transferencia_id', v_transferencia_id,
        'numero_transferencia', v_numero_transferencia,
        'turno', v_turno,
        'fecha_entrega', v_fecha_entrega
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
-- FUNCIÓN: Preparar transferencia (almacenista)
-- Similar a preparar presupuesto, con pesaje
-- ===========================================
CREATE OR REPLACE FUNCTION fn_preparar_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID,
    p_items_pesados JSONB DEFAULT NULL -- Array de {item_id, peso_preparado}
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
    v_item RECORD;
    v_lote_origen_id UUID;
    v_pesado JSONB;
BEGIN
    -- Obtener transferencia
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    IF v_transferencia.estado != 'en_almacen' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden preparar transferencias en estado en_almacen');
    END IF;

    -- Actualizar pesos de items si se proporcionaron
    IF p_items_pesados IS NOT NULL THEN
        FOR v_pesado IN SELECT * FROM jsonb_array_elements(p_items_pesados)
        LOOP
            UPDATE transferencia_items
            SET peso_preparado = (v_pesado->>'peso_preparado')::DECIMAL,
                cantidad_enviada = (v_pesado->>'peso_preparado')::DECIMAL
            WHERE id = (v_pesado->>'item_id')::UUID
            AND transferencia_id = p_transferencia_id;
        END LOOP;
    END IF;

    -- Procesar cada item
    FOR v_item IN
        SELECT * FROM transferencia_items WHERE transferencia_id = p_transferencia_id
    LOOP
        -- Si no se pesó, usar cantidad solicitada
        IF v_item.cantidad_enviada IS NULL THEN
            UPDATE transferencia_items
            SET cantidad_enviada = cantidad_solicitada
            WHERE id = v_item.id;
        END IF;

        -- Obtener lote origen (FIFO) - ya está reservado
        SELECT id INTO v_lote_origen_id
        FROM lotes
        WHERE producto_id = v_item.producto_id
        AND sucursal_id = v_transferencia.sucursal_origen_id
        ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC
        LIMIT 1;

        -- Registrar movimiento de salida
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_lote_origen_id,
            'salida',
            COALESCE(v_item.cantidad_enviada, v_item.cantidad_solicitada),
            'Transferencia preparada: ' || v_transferencia.numero_transferencia,
            p_user_id
        );

        -- Actualizar item con lote origen
        UPDATE transferencia_items
        SET lote_origen_id = v_lote_origen_id
        WHERE id = v_item.id;
    END LOOP;

    -- Actualizar transferencia a preparado
    UPDATE transferencias_stock
    SET estado = 'preparado',
        fecha_preparacion = NOW(),
        preparado_por = p_user_id,
        updated_at = NOW()
    WHERE id = p_transferencia_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia preparada exitosamente'
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
-- FUNCIÓN: Asignar transferencia a ruta
-- ===========================================
CREATE OR REPLACE FUNCTION fn_asignar_transferencia_a_ruta(
    p_transferencia_id UUID,
    p_ruta_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
BEGIN
    -- Obtener transferencia
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    IF v_transferencia.estado != 'preparado' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden asignar a ruta transferencias preparadas');
    END IF;

    -- Actualizar transferencia
    UPDATE transferencias_stock
    SET estado = 'en_ruta',
        ruta_id = p_ruta_id,
        fecha_envio = NOW(),
        updated_at = NOW()
    WHERE id = p_transferencia_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia asignada a ruta'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: Marcar transferencia como entregada (repartidor)
-- ===========================================
CREATE OR REPLACE FUNCTION fn_entregar_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
BEGIN
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    IF v_transferencia.estado != 'en_ruta' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden entregar transferencias en ruta');
    END IF;

    UPDATE transferencias_stock
    SET estado = 'entregado',
        fecha_entregado = NOW(),
        entregado_por = p_user_id,
        updated_at = NOW()
    WHERE id = p_transferencia_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia marcada como entregada'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: Recibir transferencia (sucursal destino)
-- Crea lotes en destino
-- ===========================================
CREATE OR REPLACE FUNCTION fn_recibir_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID,
    p_items_recibidos JSONB DEFAULT NULL -- Array de {item_id, cantidad_recibida} para diferencias
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
    v_item RECORD;
    v_lote_destino_id UUID;
    v_lote_origen RECORD;
    v_cantidad_a_recibir DECIMAL(10,3);
    v_recibido JSONB;
BEGIN
    -- Obtener transferencia
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    -- Permitir recibir desde 'entregado' o 'en_ruta' (para casos sin repartidor)
    IF v_transferencia.estado NOT IN ('entregado', 'en_ruta', 'en_transito', 'preparado') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no está en estado para recibir');
    END IF;

    -- Actualizar cantidades recibidas si se proporcionaron diferencias
    IF p_items_recibidos IS NOT NULL THEN
        FOR v_recibido IN SELECT * FROM jsonb_array_elements(p_items_recibidos)
        LOOP
            UPDATE transferencia_items
            SET cantidad_recibida = (v_recibido->>'cantidad_recibida')::DECIMAL
            WHERE id = (v_recibido->>'item_id')::UUID
            AND transferencia_id = p_transferencia_id;
        END LOOP;
    END IF;

    -- Procesar cada item y crear lotes en sucursal destino
    FOR v_item IN
        SELECT * FROM transferencia_items WHERE transferencia_id = p_transferencia_id
    LOOP
        -- Cantidad a recibir: la especificada, la enviada o la solicitada
        v_cantidad_a_recibir := COALESCE(v_item.cantidad_recibida, v_item.cantidad_enviada, v_item.cantidad_solicitada);

        -- Actualizar cantidad recibida si no se especificó
        IF v_item.cantidad_recibida IS NULL THEN
            UPDATE transferencia_items
            SET cantidad_recibida = v_cantidad_a_recibir
            WHERE id = v_item.id;
        END IF;

        -- Obtener datos del lote origen para replicar
        SELECT * INTO v_lote_origen
        FROM lotes
        WHERE id = v_item.lote_origen_id;

        -- Crear nuevo lote en sucursal destino
        INSERT INTO lotes (
            producto_id,
            sucursal_id,
            cantidad_ingresada,
            cantidad_disponible,
            costo_unitario,
            fecha_ingreso,
            fecha_vencimiento,
            proveedor,
            estado,
            numero_lote
        ) VALUES (
            v_item.producto_id,
            v_transferencia.sucursal_destino_id,
            v_cantidad_a_recibir,
            v_cantidad_a_recibir,
            COALESCE(v_lote_origen.costo_unitario, 0),
            NOW(),
            v_lote_origen.fecha_vencimiento,
            COALESCE(v_lote_origen.proveedor, 'Transferencia'),
            'disponible',
            'TRANS-' || COALESCE(v_lote_origen.numero_lote, v_transferencia.numero_transferencia)
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
            v_cantidad_a_recibir,
            'Transferencia recibida: ' || v_transferencia.numero_transferencia,
            p_user_id
        );

        -- Actualizar item con lote destino
        UPDATE transferencia_items
        SET lote_destino_id = v_lote_destino_id
        WHERE id = v_item.id;
    END LOOP;

    -- Actualizar transferencia
    UPDATE transferencias_stock
    SET estado = 'recibido',
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

-- ===========================================
-- FUNCIÓN: Obtener transferencias del día para almacén
-- Similar a obtener presupuestos del día
-- ===========================================
CREATE OR REPLACE FUNCTION fn_obtener_transferencias_dia(
    p_fecha DATE DEFAULT CURRENT_DATE,
    p_turno VARCHAR(20) DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    numero_transferencia VARCHAR(50),
    sucursal_origen_nombre VARCHAR(255),
    sucursal_destino_nombre VARCHAR(255),
    estado VARCHAR(20),
    turno VARCHAR(20),
    fecha_entrega DATE,
    zona_nombre VARCHAR(255),
    total_items BIGINT,
    items_pesaje BIGINT,
    fecha_solicitud TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.numero_transferencia,
        so.nombre AS sucursal_origen_nombre,
        sd.nombre AS sucursal_destino_nombre,
        t.estado,
        t.turno,
        t.fecha_entrega,
        z.nombre AS zona_nombre,
        COUNT(ti.id) AS total_items,
        COUNT(CASE WHEN ti.requiere_pesaje THEN 1 END) AS items_pesaje,
        t.fecha_solicitud
    FROM transferencias_stock t
    JOIN sucursales so ON t.sucursal_origen_id = so.id
    JOIN sucursales sd ON t.sucursal_destino_id = sd.id
    LEFT JOIN zonas z ON t.zona_id = z.id
    LEFT JOIN transferencia_items ti ON t.id = ti.transferencia_id
    WHERE t.fecha_entrega = p_fecha
    AND t.estado IN ('en_almacen', 'preparado')
    AND (p_turno IS NULL OR t.turno = p_turno)
    AND (p_zona_id IS NULL OR t.zona_id = p_zona_id)
    GROUP BY t.id, t.numero_transferencia, so.nombre, sd.nombre, 
             t.estado, t.turno, t.fecha_entrega, z.nombre, t.fecha_solicitud
    ORDER BY t.fecha_solicitud ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================================
-- FUNCIÓN: Cancelar transferencia y devolver stock
-- ===========================================
CREATE OR REPLACE FUNCTION fn_cancelar_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID,
    p_motivo TEXT DEFAULT 'Cancelada por usuario'
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    -- Solo cancelar si no ha sido recibida
    IF v_transferencia.estado IN ('recibido', 'recibida') THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se puede cancelar una transferencia ya recibida');
    END IF;

    -- Devolver stock reservado
    FOR v_item IN
        SELECT * FROM transferencia_items WHERE transferencia_id = p_transferencia_id
    LOOP
        -- Devolver al lote de origen si existe
        IF v_item.lote_origen_id IS NOT NULL THEN
            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible + COALESCE(v_item.cantidad_enviada, v_item.cantidad_solicitada),
                updated_at = NOW()
            WHERE id = v_item.lote_origen_id;

            -- Registrar movimiento de devolución
            INSERT INTO movimientos_stock (
                lote_id,
                tipo_movimiento,
                cantidad,
                motivo,
                usuario_id
            ) VALUES (
                v_item.lote_origen_id,
                'ajuste',
                COALESCE(v_item.cantidad_enviada, v_item.cantidad_solicitada),
                'Devolución por cancelación de transferencia: ' || v_transferencia.numero_transferencia,
                p_user_id
            );
        ELSE
            -- Si no hay lote origen (reserva inicial), buscar el lote y devolver
            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible + v_item.cantidad_solicitada,
                updated_at = NOW()
            WHERE id = (
                SELECT id FROM lotes
                WHERE producto_id = v_item.producto_id
                AND sucursal_id = v_transferencia.sucursal_origen_id
                ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC
                LIMIT 1
            );
        END IF;
    END LOOP;

    -- Actualizar transferencia
    UPDATE transferencias_stock
    SET estado = 'cancelada',
        observaciones = COALESCE(observaciones, '') || ' | Cancelada: ' || p_motivo,
        updated_at = NOW()
    WHERE id = p_transferencia_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia cancelada y stock devuelto'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Agregar campo transferencia_id a detalles_ruta
-- Permite incluir transferencias en las rutas de reparto
-- ===========================================
ALTER TABLE detalles_ruta
ADD COLUMN IF NOT EXISTS transferencia_id UUID REFERENCES transferencias_stock(id),
ADD COLUMN IF NOT EXISTS notas TEXT;

-- Índice para búsqueda de transferencias en rutas
CREATE INDEX IF NOT EXISTS idx_detalles_ruta_transferencia ON detalles_ruta(transferencia_id) WHERE transferencia_id IS NOT NULL;

-- ===========================================
-- FUNCIÓN: Obtener transferencias en ruta para repartidor
-- ===========================================
CREATE OR REPLACE FUNCTION fn_obtener_transferencias_en_ruta(
    p_ruta_id UUID
) RETURNS TABLE (
    id UUID,
    numero_transferencia VARCHAR(50),
    sucursal_destino_nombre VARCHAR(255),
    sucursal_destino_direccion TEXT,
    estado VARCHAR(20),
    orden_entrega INTEGER,
    estado_entrega VARCHAR(50),
    total_items BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.numero_transferencia,
        s.nombre AS sucursal_destino_nombre,
        s.direccion AS sucursal_destino_direccion,
        t.estado,
        dr.orden_entrega,
        dr.estado_entrega,
        COUNT(ti.id) AS total_items
    FROM transferencias_stock t
    JOIN sucursales s ON t.sucursal_destino_id = s.id
    JOIN detalles_ruta dr ON dr.transferencia_id = t.id
    LEFT JOIN transferencia_items ti ON t.id = ti.transferencia_id
    WHERE dr.ruta_id = p_ruta_id
    GROUP BY t.id, t.numero_transferencia, s.nombre, s.direccion, 
             t.estado, dr.orden_entrega, dr.estado_entrega
    ORDER BY dr.orden_entrega ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentarios actualizados
COMMENT ON FUNCTION fn_crear_transferencia_stock IS 'Crea transferencia con turno automático y reserva de stock (estado en_almacen)';
COMMENT ON FUNCTION fn_preparar_transferencia IS 'Almacenista prepara transferencia con pesaje opcional';
COMMENT ON FUNCTION fn_asignar_transferencia_a_ruta IS 'Asigna transferencia preparada a una ruta de reparto';
COMMENT ON FUNCTION fn_entregar_transferencia IS 'Repartidor marca transferencia como entregada';
COMMENT ON FUNCTION fn_recibir_transferencia IS 'Sucursal destino confirma recepción y crea lotes';
COMMENT ON FUNCTION fn_obtener_transferencias_dia IS 'Obtiene transferencias del día para vista de almacén';
COMMENT ON FUNCTION fn_cancelar_transferencia IS 'Cancela transferencia y devuelve stock reservado';
COMMENT ON FUNCTION fn_obtener_transferencias_en_ruta IS 'Obtiene transferencias asignadas a una ruta para el repartidor';

