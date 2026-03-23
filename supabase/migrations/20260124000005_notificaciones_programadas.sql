-- ===========================================
-- MIGRACIÓN: Sistema de Notificaciones Programadas
-- Fecha: 2026-01-24
-- Descripción: Sistema completo de notificaciones proactivas para clientes
--              con preferencias personalizables
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: cliente_preferencias_notificaciones
-- Preferencias de notificaciones por cliente
-- ===========================================

CREATE TABLE IF NOT EXISTS cliente_preferencias_notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    habilitado BOOLEAN NOT NULL DEFAULT true,
    frecuencia_maxima INTEGER NOT NULL DEFAULT 3,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unicidad: un cliente tiene solo una preferencia por tipo
    CONSTRAINT unique_cliente_tipo UNIQUE (cliente_id, tipo),

    -- Validaciones
    CONSTRAINT chk_tipo_notificacion CHECK (tipo IN (
        'estado_pedido',      -- Estado actual de pedidos
        'recordatorio_compra', -- Recordatorio de re-stock
        'promocion',          -- Ofertas y promociones
        'entrega_cercana',     -- Alerta de entrega inminente
        'alerta_pago'          -- Alertas de pago pendiente
    )),
    CONSTRAINT chk_frecuencia_maxima CHECK (frecuencia_maxima >= 1 AND frecuencia_maxima <= 10)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_cliente ON cliente_preferencias_notificaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_tipo ON cliente_preferencias_notificaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_habilitado ON cliente_preferencias_notificaciones(habilitado);

-- Comentarios para documentación
COMMENT ON TABLE cliente_preferencias_notificaciones IS 'Preferencias de notificaciones por cliente con control de frecuencia';
COMMENT ON COLUMN cliente_preferencias_notificaciones.cliente_id IS 'Cliente asociado';
COMMENT ON COLUMN cliente_preferencias_notificaciones.tipo IS 'Tipo de notificación: estado_pedido, recordatorio_compra, promocion, entrega_cercana, alerta_pago';
COMMENT ON COLUMN cliente_preferencias_notificaciones.habilitado IS 'Si la notificación está habilitada para este cliente';
COMMENT ON COLUMN cliente_preferencias_notificaciones.frecuencia_maxima IS 'Máximo de notificaciones de este tipo por día (1-10)';

-- ===========================================
-- TABLA: notificaciones_programadas
-- Notificaciones pendientes de envío
-- ===========================================

CREATE TABLE IF NOT EXISTS notificaciones_programadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB NOT NULL DEFAULT '{}'::jsonb,
    programada_para TIMESTAMPTZ NOT NULL,
    enviada BOOLEAN NOT NULL DEFAULT false,
    enviada_at TIMESTAMPTZ,
    error_envio TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validaciones
    CONSTRAINT chk_tipo_notificacion_prog CHECK (tipo IN (
        'estado_pedido',
        'recordatorio_compra',
        'promocion',
        'entrega_cercana',
        'alerta_pago'
    ))
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_cliente ON notificaciones_programadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_tipo ON notificaciones_programadas(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_programada ON notificaciones_programadas(programada_para);
CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_enviada ON notificaciones_programadas(enviada);
CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_pendientes ON notificaciones_programadas(enviada, programada_para)
    WHERE enviada = false;

-- Comentarios para documentación
COMMENT ON TABLE notificaciones_programadas IS 'Notificaciones programadas para envío automático';
COMMENT ON COLUMN notificaciones_programadas.cliente_id IS 'Cliente destinatario';
COMMENT ON COLUMN notificaciones_programadas.tipo IS 'Tipo de notificación: estado_pedido, recordatorio_compra, promocion, entrega_cercana, alerta_pago';
COMMENT ON COLUMN notificaciones_programadas.mensaje IS 'Mensaje de la notificación';
COMMENT ON COLUMN notificaciones_programadas.datos IS 'Datos adicionales en JSON (IDs, montos, fechas, etc.)';
COMMENT ON COLUMN notificaciones_programadas.programada_para IS 'Timestamp cuando debe enviarse (respetando horario 8am-8pm)';
COMMENT ON COLUMN notificaciones_programadas.enviada IS 'Indica si la notificación fue enviada';
COMMENT ON COLUMN notificaciones_programadas.enviada_at IS 'Timestamp real de envío';
COMMENT ON COLUMN notificaciones_programadas.error_envio IS 'Mensaje de error si falló el envío';

-- ===========================================
-- FUNCIÓN RPC: upsert_cliente_preferencia_notificacion
-- Inserta o actualiza preferencia de notificación
-- ===========================================

CREATE OR REPLACE FUNCTION upsert_cliente_preferencia_notificacion(
    p_cliente_id UUID,
    p_tipo VARCHAR(50),
    p_habilitado BOOLEAN DEFAULT true,
    p_frecuencia_maxima INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_preferencia RECORD;
BEGIN
    -- Validar tipo de notificación
    IF p_tipo NOT IN ('estado_pedido', 'recordatorio_compra', 'promocion', 'entrega_cercana', 'alerta_pago') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Tipo de notificación inválido'
        );
    END IF;

    -- Insertar o actualizar preferencia
    INSERT INTO cliente_preferencias_notificaciones (
        cliente_id,
        tipo,
        habilitado,
        frecuencia_maxima,
        updated_at
    )
    VALUES (
        p_cliente_id,
        p_tipo,
        p_habilitado,
        p_frecuencia_maxia,
        NOW()
    )
    ON CONFLICT (cliente_id, tipo)
    DO UPDATE SET
        habilitado = EXCLUDED.habilitado,
        frecuencia_maxima = EXCLUDED.frecuencia_maxima,
        updated_at = NOW()
    RETURNING * INTO v_preferencia;

    RETURN jsonb_build_object(
        'success', true,
        'preferencia', row_to_json(v_preferencia)
    );
END;
$$;

COMMENT ON FUNCTION upsert_cliente_preferencia_notificacion IS 'Inserta o actualiza preferencia de notificación de un cliente';

-- ===========================================
-- FUNCIÓN RPC: get_cliente_preferencias_notificaciones
-- Obtiene todas las preferencias de un cliente
-- ===========================================

CREATE OR REPLACE FUNCTION get_cliente_preferencias_notificaciones(
    p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_preferencias JSONB;
BEGIN
    SELECT jsonb_agg(row_to_json(cp))
    INTO v_preferencias
    FROM cliente_preferencias_notificaciones cp
    WHERE cp.cliente_id = p_cliente_id;

    IF v_preferencias IS NULL THEN
        -- Retornar preferencias por defecto
        v_preferencias := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'preferencias', v_preferencias
    );
END;
$$;

COMMENT ON FUNCTION get_cliente_preferencias_notificaciones IS 'Obtiene todas las preferencias de notificaciones de un cliente';

-- ===========================================
-- FUNCIÓN RPC: programar_notificacion
-- Programa una notificación para envío futuro
-- ===========================================

CREATE OR REPLACE FUNCTION programar_notificacion(
    p_cliente_id UUID,
    p_tipo VARCHAR(50),
    p_mensaje TEXT,
    p_datos JSONB DEFAULT '{}'::jsonb,
    p_programada_para TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_preferencia RECORD;
    v_notificacion RECORD;
    v_programada TIMESTAMPTZ;
BEGIN
    -- Validar tipo de notificación
    IF p_tipo NOT IN ('estado_pedido', 'recordatorio_compra', 'promocion', 'entrega_cercana', 'alerta_pago') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Tipo de notificación inválido'
        );
    END IF;

    -- Verificar si el cliente tiene preferencias
    SELECT * INTO v_preferencia
    FROM cliente_preferencias_notificaciones
    WHERE cliente_id = p_cliente_id AND tipo = p_tipo;

    -- Si no tiene preferencias, usar defaults
    IF v_preferencia IS NULL THEN
        v_preferencia := ROW(NULL, p_tipo, true, 3)::cliente_preferencias_notificaciones;
    ELSE
        -- Si la notificación está deshabilitada, rechazar
        IF NOT v_preferencia.habilitado THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Notificación deshabilitada para este cliente'
            );
        END IF;
    END IF;

    -- Calcular horario de envío (respetar 8am-8pm)
    v_programada := COALESCE(p_programada_para, NOW());

    -- Si está fuera de horario, ajustar al próximo horario válido
    IF EXTRACT(HOUR FROM v_programada) < 8 THEN
        -- Antes de 8am: enviar a las 8am del mismo día
        v_programada := DATE_TRUNC('day', v_programada) + INTERVAL '8 hours';
    ELSIF EXTRACT(HOUR FROM v_programada) >= 20 THEN
        -- Después de 8pm: enviar a las 8am del día siguiente
        v_programada := DATE_TRUNC('day', v_programada) + INTERVAL '1 day 8 hours';
    END IF;

    -- Insertar notificación programada
    INSERT INTO notificaciones_programadas (
        cliente_id,
        tipo,
        mensaje,
        datos,
        programada_para
    )
    VALUES (
        p_cliente_id,
        p_tipo,
        p_mensaje,
        p_datos,
        v_programada
    )
    RETURNING * INTO v_notificacion;

    RETURN jsonb_build_object(
        'success', true,
        'notificacion', row_to_json(v_notificacion),
        'ajustada_a_horario', v_programada != COALESCE(p_programada_para, NOW())
    );
END;
$$;

COMMENT ON FUNCTION programar_notificacion IS 'Programa una notificación para envío futuro, respetando horarios 8am-8pm y preferencias del cliente';

-- ===========================================
-- FUNCIÓN RPC: obtener_notificaciones_pendientes
-- Obtiene notificaciones pendientes de envío
-- ===========================================

CREATE OR REPLACE FUNCTION obtener_notificaciones_pendientes(
    p_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notificaciones JSONB;
BEGIN
    -- Obtener notificaciones pendientes que ya es hora de enviar
    SELECT jsonb_agg(row_to_json(np))
    INTO v_notificaciones
    FROM notificaciones_programadas np
    WHERE np.enviada = false
      AND np.programada_para <= NOW()
    ORDER BY np.programada_para ASC
    LIMIT p_limit;

    IF v_notificaciones IS NULL THEN
        v_notificaciones := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'notificaciones', v_notificaciones,
        'total', COALESCE(jsonb_array_length(v_notificaciones), 0)
    );
END;
$$;

COMMENT ON FUNCTION obtener_notificaciones_pendientes IS 'Obtiene notificaciones pendientes que ya es hora de enviar';

-- ===========================================
-- FUNCIÓN RPC: marcar_notificacion_enviada
-- Marca una notificación como enviada
-- ===========================================

CREATE OR REPLACE FUNCTION marcar_notificacion_enviada(
    p_notificacion_id UUID,
    p_enviada BOOLEAN DEFAULT true,
    p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_notificacion RECORD;
BEGIN
    UPDATE notificaciones_programadas
    SET
        enviada = p_enviada,
        enviada_at = CASE WHEN p_enviada THEN NOW() ELSE NULL END,
        error_envio = p_error,
        updated_at = NOW()
    WHERE id = p_notificacion_id
    RETURNING * INTO v_notificacion;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Notificación no encontrada'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'notificacion', row_to_json(v_notificacion)
    );
END;
$$;

COMMENT ON FUNCTION marcar_notificacion_enviada IS 'Marca una notificación como enviada o fallida';

-- ===========================================
-- FUNCIÓN RPC: obtener_historial_notificaciones
-- Obtiene historial de notificaciones enviadas a un cliente
-- ===========================================

CREATE OR REPLACE FUNCTION obtener_historial_notificaciones(
    p_cliente_id UUID,
    p_dias INTEGER DEFAULT 30,
    p_tipo VARCHAR(50) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_historial JSONB;
BEGIN
    -- Obtener notificaciones de los últimos N días
    SELECT jsonb_agg(row_to_json(np))
    INTO v_historial
    FROM notificaciones_programadas np
    WHERE np.cliente_id = p_cliente_id
      AND np.created_at >= NOW() - (p_dias || ' days')::INTERVAL
      AND (p_tipo IS NULL OR np.tipo = p_tipo)
    ORDER BY np.created_at DESC;

    IF v_historial IS NULL THEN
        v_historial := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'historial', v_historial,
        'total', COALESCE(jsonb_array_length(v_historial), 0)
    );
END;
$$;

COMMENT ON FUNCTION obtener_historial_notificaciones IS 'Obtiene historial de notificaciones de un cliente en los últimos N días';

-- ===========================================
-- FUNCIÓN RPC: contar_notificaciones_hoy
-- Cuenta cuántas notificaciones de un tipo se enviaron hoy a un cliente
-- ===========================================

CREATE OR REPLACE FUNCTION contar_notificaciones_hoy(
    p_cliente_id UUID,
    p_tipo VARCHAR(50)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notificaciones_programadas
    WHERE cliente_id = p_cliente_id
      AND tipo = p_tipo
      AND DATE(created_at) = CURRENT_DATE;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_count,
        'tipo', p_tipo
    );
END;
$$;

COMMENT ON FUNCTION contar_notificaciones_hoy IS 'Cuenta cuántas notificaciones de un tipo se enviaron hoy a un cliente';

-- ===========================================
-- FUNCIÓN RPC: cleanup_notificaciones_antiguas
-- Limpia notificaciones enviadas hace más de 90 días
-- ===========================================

CREATE OR REPLACE FUNCTION cleanup_notificaciones_antiguas(
    p_dias INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM notificaciones_programadas
    WHERE enviada = true
      AND created_at < NOW() - (p_dias || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'message', format('Se eliminaron %s notificaciones antiguas', v_deleted_count)
    );
END;
$$;

COMMENT ON FUNCTION cleanup_notificaciones_antiguas IS 'Limpia notificaciones enviadas hace más de N días';

-- ===========================================
-- POLÍTICAS RLS
-- Solo service role puede acceder (el bot usa service role key)
-- ===========================================

ALTER TABLE cliente_preferencias_notificaciones ENABLE ROW LEVEL SECURITY;

-- Política: Solo service role puede leer preferencias
CREATE POLICY cliente_preferencias_select_policy
    ON cliente_preferencias_notificaciones
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Política: Solo service role puede insertar preferencias
CREATE POLICY cliente_preferencias_insert_policy
    ON cliente_preferencias_notificaciones
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Política: Solo service role puede actualizar preferencias
CREATE POLICY cliente_preferencias_update_policy
    ON cliente_preferencias_notificaciones
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- Política: Solo service role puede eliminar preferencias
CREATE POLICY cliente_preferencias_delete_policy
    ON cliente_preferencias_notificaciones
    FOR DELETE
    USING (auth.role() = 'service_role');

ALTER TABLE notificaciones_programadas ENABLE ROW LEVEL SECURITY;

-- Política: Solo service role puede leer notificaciones
CREATE POLICY notificaciones_programadas_select_policy
    ON notificaciones_programadas
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Política: Solo service role puede insertar notificaciones
CREATE POLICY notificaciones_programadas_insert_policy
    ON notificaciones_programadas
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Política: Solo service role puede actualizar notificaciones
CREATE POLICY notificaciones_programadas_update_policy
    ON notificaciones_programadas
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- Política: Solo service role puede eliminar notificaciones
CREATE POLICY notificaciones_programadas_delete_policy
    ON notificaciones_programadas
    FOR DELETE
    USING (auth.role() = 'service_role');

COMMIT;

-- ===========================================
-- VERIFICACIÓN
-- ===========================================

-- Verificar que las tablas existen
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'cliente_preferencias_notificaciones'
    ) THEN
        RAISE NOTICE '✓ Tabla cliente_preferencias_notificaciones creada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error: Tabla cliente_preferencias_notificaciones no fue creada';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'notificaciones_programadas'
    ) THEN
        RAISE NOTICE '✓ Tabla notificaciones_programadas creada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Error: Tabla notificaciones_programadas no fue creada';
    END IF;
END $$;

-- Verificar que las funciones RPC existen
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_cliente_preferencia_notificacion') THEN
        RAISE NOTICE '✓ Función upsert_cliente_preferencia_notificacion creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_cliente_preferencias_notificaciones') THEN
        RAISE NOTICE '✓ Función get_cliente_preferencias_notificaciones creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'programar_notificacion') THEN
        RAISE NOTICE '✓ Función programar_notificacion creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'obtener_notificaciones_pendientes') THEN
        RAISE NOTICE '✓ Función obtener_notificaciones_pendientes creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'marcar_notificacion_enviada') THEN
        RAISE NOTICE '✓ Función marcar_notificacion_enviada creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'obtener_historial_notificaciones') THEN
        RAISE NOTICE '✓ Función obtener_historial_notificaciones creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'contar_notificaciones_hoy') THEN
        RAISE NOTICE '✓ Función contar_notificaciones_hoy creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_notificaciones_antiguas') THEN
        RAISE NOTICE '✓ Función cleanup_notificaciones_antiguas creada';
    END IF;

    -- Verificar restricciones de check
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tipo_notificacion') THEN
        RAISE NOTICE '✓ Restricción chk_tipo_notificacion creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_frecuencia_maxima') THEN
        RAISE NOTICE '✓ Restricción chk_frecuencia_maxima creada';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tipo_notificacion_prog') THEN
        RAISE NOTICE '✓ Restricción chk_tipo_notificacion_prog creada';
    END IF;

    RAISE NOTICE '✓ Migración 20260124_notificaciones_programadas completada con éxito';
END $$;
