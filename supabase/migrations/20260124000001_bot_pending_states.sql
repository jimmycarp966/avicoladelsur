-- ===========================================
-- MIGRACIÓN: Tabla de Estados Pendientes del Bot
-- Fecha: 2026-01-24
-- Descripción: Almacena estados de flujos pendientes del bot (registro, reclamos, confirmaciones)
--              para persistencia en Vercel serverless
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: bot_pending_states
-- ===========================================

CREATE TABLE IF NOT EXISTS bot_pending_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    state_type VARCHAR(50) NOT NULL CHECK (state_type IN ('registro', 'reclamo', 'confirmacion')),
    state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Índice único: un cliente solo puede tener un estado pendiente de cada tipo
    CONSTRAINT unique_phone_state UNIQUE (phone_number, state_type)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_bot_pending_states_phone ON bot_pending_states(phone_number);
CREATE INDEX IF NOT EXISTS idx_bot_pending_states_expires ON bot_pending_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_bot_pending_states_type ON bot_pending_states(state_type);

-- Comentarios para documentación
COMMENT ON TABLE bot_pending_states IS 'Almacena estados de flujos conversacionales pendientes del bot WhatsApp';
COMMENT ON COLUMN bot_pending_states.phone_number IS 'Número de teléfono del cliente (formato: +5491234567890)';
COMMENT ON COLUMN bot_pending_states.state_type IS 'Tipo de flujo: registro (nuevo cliente), reclamo, confirmacion (pedido)';
COMMENT ON COLUMN bot_pending_states.state_data IS 'Datos del estado en formato JSON (estructura depende del tipo)';
COMMENT ON COLUMN bot_pending_states.expires_at IS 'Timestamp de expiración (default: 1 hora desde creación)';

-- ===========================================
-- FUNCIÓN RPC: upsert_bot_pending_state
-- Inserta o actualiza un estado pendiente
-- ===========================================

CREATE OR REPLACE FUNCTION upsert_bot_pending_state(
    p_phone_number VARCHAR(20),
    p_state_type VARCHAR(50),
    p_state_data JSONB,
    p_expires_in_minutes INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_state RECORD;
BEGIN
    -- Validar tipo de estado
    IF p_state_type NOT IN ('registro', 'reclamo', 'confirmacion') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Tipo de estado inválido. Debe ser: registro, reclamo o confirmacion'
        );
    END IF;

    -- Insertar o actualizar estado
    INSERT INTO bot_pending_states (
        phone_number,
        state_type,
        state_data,
        expires_at,
        updated_at
    )
    VALUES (
        p_phone_number,
        p_state_type,
        p_state_data,
        NOW() + (p_expires_in_minutes || ' minutes')::INTERVAL,
        NOW()
    )
    ON CONFLICT (phone_number, state_type)
    DO UPDATE SET
        state_data = EXCLUDED.state_data,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    RETURNING * INTO v_state;

    RETURN jsonb_build_object(
        'success', true,
        'state', row_to_json(v_state)
    );
END;
$$;

COMMENT ON FUNCTION upsert_bot_pending_state IS 'Inserta o actualiza un estado pendiente del bot. Parámetros: phone_number, state_type, state_data, expires_in_minutes (default 60)';

-- ===========================================
-- FUNCIÓN RPC: get_bot_pending_state
-- Obtiene un estado pendiente si existe y no ha expirado
-- ===========================================

CREATE OR REPLACE FUNCTION get_bot_pending_state(
    p_phone_number VARCHAR(20),
    p_state_type VARCHAR(50)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_state RECORD;
BEGIN
    -- Buscar estado no expirado
    SELECT * INTO v_state
    FROM bot_pending_states
    WHERE phone_number = p_phone_number
      AND state_type = p_state_type
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Estado no encontrado o expirado'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'state', row_to_json(v_state)
    );
END;
$$;

COMMENT ON FUNCTION get_bot_pending_state IS 'Obtiene un estado pendiente del bot si existe y no ha expirado. Parámetros: phone_number, state_type';

-- ===========================================
-- FUNCIÓN RPC: delete_bot_pending_state
-- Elimina un estado pendiente
-- ===========================================

CREATE OR REPLACE FUNCTION delete_bot_pending_state(
    p_phone_number VARCHAR(20),
    p_state_type VARCHAR(50)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM bot_pending_states
    WHERE phone_number = p_phone_number
      AND state_type = p_state_type;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Estado no encontrado'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Estado eliminado correctamente'
    );
END;
$$;

COMMENT ON FUNCTION delete_bot_pending_state IS 'Elimina un estado pendiente del bot. Parámetros: phone_number, state_type';

-- ===========================================
-- FUNCIÓN RPC: cleanup_expired_bot_states
-- Limpia estados expirados (para ejecutar periódicamente)
-- ===========================================

CREATE OR REPLACE FUNCTION cleanup_expired_bot_states()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM bot_pending_states
    WHERE expires_at <= NOW();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'message', format('Se eliminaron %s estados expirados', v_deleted_count)
    );
END;
$$;

COMMENT ON FUNCTION cleanup_expired_bot_states IS 'Limpia todos los estados pendientes expirados. Ejecutar periódicamente con cron.';

-- ===========================================
-- POLÍTICAS RLS
-- Solo service role puede acceder (el bot usa service role key)
-- ===========================================

ALTER TABLE bot_pending_states ENABLE ROW LEVEL SECURITY;

-- Política: Solo service role puede leer
CREATE POLICY bot_pending_states_select_policy
    ON bot_pending_states
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Política: Solo service role puede insertar
CREATE POLICY bot_pending_states_insert_policy
    ON bot_pending_states
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Política: Solo service role puede actualizar
CREATE POLICY bot_pending_states_update_policy
    ON bot_pending_states
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- Política: Solo service role puede eliminar
CREATE POLICY bot_pending_states_delete_policy
    ON bot_pending_states
    FOR DELETE
    USING (auth.role() = 'service_role');

COMMIT;

-- ===========================================
-- VERIFICACIÓN
-- ===========================================

-- Verificar que la tabla existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'bot_pending_states'
    ) THEN
        RAISE NOTICE '✓ Tabla bot_pending_states creada exitosamente';
    ELSE
        RAISE EXCEPTION '✗ Error: Tabla bot_pending_states no fue creada';
    END IF;
END $$;

-- Verificar que las funciones existen
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_bot_pending_state') THEN
        RAISE NOTICE '✓ Función upsert_bot_pending_state creada';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_bot_pending_state') THEN
        RAISE NOTICE '✓ Función get_bot_pending_state creada';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_bot_pending_state') THEN
        RAISE NOTICE '✓ Función delete_bot_pending_state creada';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_bot_states') THEN
        RAISE NOTICE '✓ Función cleanup_expired_bot_states creada';
    END IF;
END $$;
