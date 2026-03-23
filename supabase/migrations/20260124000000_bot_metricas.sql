-- ===========================================
-- MIGRACIÓN: Métricas del Bot
-- Fecha: 2026-01-24
-- Descripción: Tablas para tracking de métricas
--              del bot de WhatsApp
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: bot_metricas_diarias
-- Métricas agregadas por día del bot
-- ===========================================

CREATE TABLE IF NOT EXISTS bot_metricas_diarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    total_mensajes INTEGER NOT NULL DEFAULT 0,
    mensajes_exitosos INTEGER NOT NULL DEFAULT 0,
    mensajes_fallidos INTEGER NOT NULL DEFAULT 0,
    presupuestos_creados INTEGER NOT NULL DEFAULT 0,
    tiempo_respuesta_promedio_ms NUMERIC(12, 2),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unicidad: una métrica por día
    CONSTRAINT unique_fecha_metrica UNIQUE (fecha)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_metricas_diarias_fecha ON bot_metricas_diarias(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_diarias_mensajes ON bot_metricas_diarias(total_mensajes DESC);

-- Comentarios para documentación
COMMENT ON TABLE bot_metricas_diarias IS 'Métricas agregadas diarias del bot de WhatsApp (sin contenido de mensajes por privacidad)';
COMMENT ON COLUMN bot_metricas_diarias.fecha IS 'Fecha de la métrica';
COMMENT ON COLUMN bot_metricas_diarias.total_mensajes IS 'Cantidad total de mensajes (incoming + outgoing)';
COMMENT ON COLUMN bot_metricas_diarias.mensajes_exitosos IS 'Mensajes procesados exitosamente';
COMMENT ON COLUMN bot_metricas_diarias.mensajes_fallidos IS 'Mensajes que fallaron en procesamiento';
COMMENT ON COLUMN bot_metricas_diarias.presupuestos_creados IS 'Cantidad de presupuestos creados ese día';
COMMENT ON COLUMN bot_metricas_diarias.tiempo_respuesta_promedio_ms IS 'Tiempo promedio de respuesta en milisegundos';

-- ===========================================
-- TABLA: bot_metricas_productos
-- Métricas de productos pedidos vía bot
-- ===========================================

CREATE TABLE IF NOT EXISTS bot_metricas_productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    veces_pedido INTEGER NOT NULL DEFAULT 0,
    cantidad_total NUMERIC(12, 3) NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unicidad: un registro por producto y fecha
    CONSTRAINT unique_producto_fecha UNIQUE (producto_id, fecha)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_metricas_productos_fecha ON bot_metricas_productos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_productos_producto ON bot_metricas_productos(producto_id);
CREATE INDEX IF NOT EXISTS idx_metricas_productos_veces_pedido ON bot_metricas_productos(veces_pedido DESC);

-- Comentarios para documentación
COMMENT ON TABLE bot_metricas_productos IS 'Métricas de productos pedidos vía bot para análisis de ventas y popularidad';
COMMENT ON COLUMN bot_metricas_productos.fecha IS 'Fecha de la métrica';
COMMENT ON COLUMN bot_metricas_productos.producto_id IS 'Producto asociado a la métrica';
COMMENT ON COLUMN bot_metricas_productos.veces_pedido IS 'Cantidad de veces que se pidió este producto vía bot';
COMMENT ON COLUMN bot_metricas_productos.cantidad_total IS 'Suma total de cantidades pedidas de este producto';

-- ===========================================
-- TABLA: bot_messages
-- Mensajes del bot (para cálculo de métricas)
-- ===========================================

-- Crear tabla si no existe (puede que ya exista de otras migraciones)
CREATE TABLE IF NOT EXISTS bot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,

    -- Metadata para tracking (sin contenido de mensajes por privacidad)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Índices
    CONSTRAINT chk_bot_messages_direction CHECK (direction IN ('incoming', 'outgoing'))
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_bot_messages_phone ON bot_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_bot_messages_cliente ON bot_messages(cliente_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created_at ON bot_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_messages_direction ON bot_messages(direction);

-- Comentario
COMMENT ON TABLE bot_messages IS 'Mensajes del bot de WhatsApp (sin contenido en métricas por privacidad)';
COMMENT ON COLUMN bot_messages.phone_number IS 'Número de teléfono del cliente (formato internacional)';
COMMENT ON COLUMN bot_messages.direction IS 'Dirección: incoming (cliente → bot), outgoing (bot → cliente)';

-- ===========================================
-- FUNCIÓN: actualizar_metricas_diarias
-- Actualiza o crea métricas diarias al insertar mensaje
-- ===========================================

CREATE OR REPLACE FUNCTION actualizar_metricas_diarias()
RETURNS TRIGGER AS $$
BEGIN
    -- Upsert métricas diarias
    INSERT INTO bot_metricas_diarias (fecha, total_mensajes, updated_at)
    VALUES (
        CURRENT_DATE,
        1,
        NOW()
    )
    ON CONFLICT (fecha)
    DO UPDATE SET
        total_mensajes = bot_metricas_diarias.total_mensajes + 1,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER: tr_bot_messages_actualizar_metricas
-- Actualiza métricas diarias al insertar mensaje
-- ===========================================

CREATE TRIGGER tr_bot_messages_actualizar_metricas
    AFTER INSERT ON bot_messages
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_metricas_diarias();

-- ===========================================
-- FUNCIÓN: actualizar_metricas_presupuestos
-- Actualiza contador de presupuestos creados en métricas
-- ===========================================

CREATE OR REPLACE FUNCTION actualizar_metricas_presupuestos()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar contador de presupuestos del día
    UPDATE bot_metricas_diarias
    SET
        presupuestos_creados = presupuestos_creados + 1,
        updated_at = NOW()
    WHERE fecha = CURRENT_DATE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Nota: Este trigger se aplicará en otra migración
-- cuando se tenga la tabla de presupuestos y sepa cuándo
-- se crea desde el bot (origen = 'whatsapp')

-- ===========================================
-- FUNCIÓN: actualizar_metricas_producto
-- Actualiza métricas de productos al crear presupuesto
-- ===========================================

CREATE OR REPLACE FUNCTION actualizar_metricas_producto(
    p_producto_id UUID,
    p_cantidad NUMERIC
)
RETURNS VOID AS $$
BEGIN
    -- Upsert métricas de producto
    INSERT INTO bot_metricas_productos (fecha, producto_id, veces_pedido, cantidad_total, updated_at)
    VALUES (
        CURRENT_DATE,
        p_producto_id,
        1,
        p_cantidad,
        NOW()
    )
    ON CONFLICT (producto_id, fecha)
    DO UPDATE SET
        veces_pedido = bot_metricas_productos.veces_pedido + 1,
        cantidad_total = bot_metricas_productos.cantidad_total + p_cantidad,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- RPC: obtener_metricas_bot
-- Obtiene métricas del bot en un rango de fechas
-- ===========================================

CREATE OR REPLACE FUNCTION obtener_metricas_bot(
    p_fecha_desde DATE DEFAULT NULL,
    p_fecha_hasta DATE DEFAULT NULL
)
RETURNS TABLE (
    fecha DATE,
    total_mensajes BIGINT,
    mensajes_exitosos BIGINT,
    mensajes_fallidos BIGINT,
    presupuestos_creados BIGINT,
    tiempo_respuesta_promedio_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bmd.fecha,
        SUM(bmd.total_mensajes) AS total_mensajes,
        SUM(bmd.mensajes_exitosos) AS mensajes_exitosos,
        SUM(bmd.mensajes_fallidos) AS mensajes_fallidos,
        SUM(bmd.presupuestos_creados) AS presupuestos_creados,
        AVG(bmd.tiempo_respuesta_promedio_ms) AS tiempo_respuesta_promedio_ms
    FROM bot_metricas_diarias bmd
    WHERE
        (p_fecha_desde IS NULL OR bmd.fecha >= p_fecha_desde)
        AND (p_fecha_hasta IS NULL OR bmd.fecha <= p_fecha_hasta)
    GROUP BY bmd.fecha
    ORDER BY bmd.fecha DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- RPC: obtener_productos_mas_pedidos
-- Obtiene ranking de productos más pedidos vía bot
-- ===========================================

CREATE OR REPLACE FUNCTION obtener_productos_mas_pedidos(
    p_fecha_desde DATE DEFAULT NULL,
    p_fecha_hasta DATE DEFAULT NULL,
    p_limite INTEGER DEFAULT 10
)
RETURNS TABLE (
    producto_id UUID,
    producto_nombre TEXT,
    producto_codigo TEXT,
    veces_pedido BIGINT,
    cantidad_total NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bmp.producto_id,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        SUM(bmp.veces_pedido) AS veces_pedido,
        SUM(bmp.cantidad_total) AS cantidad_total
    FROM bot_metricas_productos bmp
    JOIN productos p ON p.id = bmp.producto_id
    WHERE
        (p_fecha_desde IS NULL OR bmp.fecha >= p_fecha_desde)
        AND (p_fecha_hasta IS NULL OR bmp.fecha <= p_fecha_hasta)
    GROUP BY bmp.producto_id, p.nombre, p.codigo
    ORDER BY veces_pedido DESC, cantidad_total DESC
    LIMIT p_limite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- VERIFICACIÓN DE LA MIGRACIÓN
-- ===========================================

DO $$
DECLARE
    v_bot_metricas_diarias_exists BOOLEAN;
    v_bot_metricas_productos_exists BOOLEAN;
    v_bot_messages_exists BOOLEAN;
BEGIN
    -- Verificar que las tablas se crearon
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bot_metricas_diarias'
    ) INTO v_bot_metricas_diarias_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bot_metricas_productos'
    ) INTO v_bot_metricas_productos_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bot_messages'
    ) INTO v_bot_messages_exists;

    -- Logs de verificación
    IF v_bot_metricas_diarias_exists THEN
        RAISE NOTICE '✅ Tabla bot_metricas_diarias creada exitosamente';
    ELSE
        RAISE NOTICE '❌ ERROR: Tabla bot_metricas_diarias NO creada';
    END IF;

    IF v_bot_metricas_productos_exists THEN
        RAISE NOTICE '✅ Tabla bot_metricas_productos creada exitosamente';
    ELSE
        RAISE NOTICE '❌ ERROR: Tabla bot_metricas_productos NO creada';
    END IF;

    IF v_bot_messages_exists THEN
        RAISE NOTICE '✅ Tabla bot_messages creada exitosamente';
    ELSE
        RAISE NOTICE '❌ ERROR: Tabla bot_messages NO creada';
    END IF;

    -- Verificar triggers
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'tr_bot_messages_actualizar_metricas'
    ) THEN
        RAISE NOTICE '✅ Trigger tr_bot_messages_actualizar_metricas activo';
    ELSE
        RAISE NOTICE '❌ ERROR: Trigger tr_bot_messages_actualizar_metricas NO creado';
    END IF;

    -- Verificar funciones RPC
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'obtener_metricas_bot'
    ) THEN
        RAISE NOTICE '✅ RPC obtener_metricas_bot creada';
    ELSE
        RAISE NOTICE '❌ ERROR: RPC obtener_metricas_bot NO creada';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'obtener_productos_mas_pedidos'
    ) THEN
        RAISE NOTICE '✅ RPC obtener_productos_mas_pedidos creada';
    ELSE
        RAISE NOTICE '❌ ERROR: RPC obtener_productos_mas_pedidos NO creada';
    END IF;
END $$;

COMMIT;

-- ===========================================
-- COMENTARIOS FINALES
-- ===========================================

-- Esta migración crea:
-- 1. Tabla bot_metricas_diarias para métricas diarias agregadas
-- 2. Tabla bot_metricas_productos para tracking de productos populares
-- 3. Tabla bot_messages para historial de mensajes
-- 4. Trigger para actualizar métricas automáticamente al insertar mensajes
-- 5. Funciones RPC para consultar métricas y ranking de productos
-- 6. Verificación completa de todos los objetos creados
--
-- Privacidad: NO se almacena contenido de mensajes en métricas,
-- solo conteos y agregados. El contenido está en bot_messages.
-- ===========================================
