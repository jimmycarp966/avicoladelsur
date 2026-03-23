-- ===========================================
-- MIGRACIÓN: Bot Inteligente con Dialogflow y Speech-to-Text
-- Fecha: 19/01/2025
-- Objetivo: Crear tablas para historial de conversaciones, transcripciones de audio y métricas del bot
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: conversaciones_bot
-- Historial de conversaciones con el bot
-- ===========================================

CREATE TABLE IF NOT EXISTS conversaciones_bot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    numero_whatsapp VARCHAR(20) NOT NULL,
    mensaje_cliente TEXT NOT NULL,
    mensaje_bot TEXT,
    intent_detectado VARCHAR(100), -- Intención detectada por Dialogflow
    confianza DECIMAL(5,4), -- Confianza de la detección (0-1)
    contexto JSONB, -- Contexto de la conversación
    tipo_mensaje VARCHAR(20) DEFAULT 'texto', -- 'texto', 'audio', 'imagen'
    procesado_por VARCHAR(50) DEFAULT 'dialogflow', -- 'dialogflow', 'basico'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conversaciones_cliente_id ON conversaciones_bot(cliente_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_numero ON conversaciones_bot(numero_whatsapp);
CREATE INDEX IF NOT EXISTS idx_conversaciones_intent ON conversaciones_bot(intent_detectado);
CREATE INDEX IF NOT EXISTS idx_conversaciones_created_at ON conversaciones_bot(created_at DESC);

-- Comentarios
COMMENT ON TABLE conversaciones_bot IS 'Historial de conversaciones con el bot de WhatsApp usando Dialogflow';
COMMENT ON COLUMN conversaciones_bot.intent_detectado IS 'Intención detectada por Dialogflow (pedido, consulta_stock, etc.)';
COMMENT ON COLUMN conversaciones_bot.confianza IS 'Confianza de la detección de intención (0-1)';
COMMENT ON COLUMN conversaciones_bot.contexto IS 'Contexto de la conversación para mantener estado';

-- ===========================================
-- TABLA: transcripciones_audio
-- Transcripciones de mensajes de voz
-- ===========================================

CREATE TABLE IF NOT EXISTS transcripciones_audio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversacion_id UUID REFERENCES conversaciones_bot(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    audio_url TEXT, -- URL del audio en Supabase Storage
    audio_base64 TEXT, -- Audio en base64 (temporal)
    transcripcion TEXT NOT NULL,
    confianza DECIMAL(5,4), -- Confianza de la transcripción (0-1)
    idioma_detectado VARCHAR(10) DEFAULT 'es-AR',
    palabras JSONB, -- Array de palabras con timestamps
    alternativas JSONB, -- Alternativas de transcripción
    procesado_por VARCHAR(50) DEFAULT 'speech-to-text',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transcripciones_conversacion_id ON transcripciones_audio(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_transcripciones_cliente_id ON transcripciones_audio(cliente_id);
CREATE INDEX IF NOT EXISTS idx_transcripciones_created_at ON transcripciones_audio(created_at DESC);

-- Comentarios
COMMENT ON TABLE transcripciones_audio IS 'Transcripciones de mensajes de voz procesados con Speech-to-Text';
COMMENT ON COLUMN transcripciones_audio.transcripcion IS 'Texto transcrito del audio';
COMMENT ON COLUMN transcripciones_audio.palabras IS 'Array de palabras con timestamps: [{word, startTime, endTime}]';
COMMENT ON COLUMN transcripciones_audio.alternativas IS 'Alternativas de transcripción con diferentes niveles de confianza';

-- ===========================================
-- TABLA: metricas_bot
-- Métricas agregadas del bot
-- ===========================================

CREATE TABLE IF NOT EXISTS metricas_bot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL,
    semana INTEGER,
    mes INTEGER NOT NULL,
    año INTEGER NOT NULL,
    total_mensajes INTEGER DEFAULT 0,
    mensajes_por_voz INTEGER DEFAULT 0,
    pedidos_creados INTEGER DEFAULT 0,
    consultas_stock INTEGER DEFAULT 0,
    consultas_precio INTEGER DEFAULT 0,
    tasa_exito DECIMAL(5,2) DEFAULT 0, -- % de mensajes procesados exitosamente
    tiempo_promedio_respuesta DECIMAL(5,2) DEFAULT 0, -- Segundos
    confianza_promedio DECIMAL(5,4) DEFAULT 0, -- Confianza promedio de detección
    intenciones_mas_comunes JSONB, -- {intent: count}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fecha)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_metricas_bot_fecha ON metricas_bot(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_bot_semana ON metricas_bot(año, semana);
CREATE INDEX IF NOT EXISTS idx_metricas_bot_mes ON metricas_bot(año, mes);

-- Comentarios
COMMENT ON TABLE metricas_bot IS 'Métricas agregadas del bot por día/semana/mes';
COMMENT ON COLUMN metricas_bot.tasa_exito IS 'Porcentaje de mensajes procesados exitosamente';
COMMENT ON COLUMN metricas_bot.tiempo_promedio_respuesta IS 'Tiempo promedio de respuesta en segundos';
COMMENT ON COLUMN metricas_bot.intenciones_mas_comunes IS 'JSON con conteo de intenciones: {"pedido": 45, "consulta_stock": 12}';

-- ===========================================
-- FUNCIÓN: fn_registrar_conversacion_bot
-- Registra una nueva conversación del bot
-- ===========================================

CREATE OR REPLACE FUNCTION fn_registrar_conversacion_bot(
    p_cliente_id UUID,
    p_numero_whatsapp VARCHAR(20),
    p_mensaje_cliente TEXT,
    p_mensaje_bot TEXT DEFAULT NULL,
    p_intent_detectado VARCHAR(100) DEFAULT NULL,
    p_confianza DECIMAL DEFAULT NULL,
    p_contexto JSONB DEFAULT NULL,
    p_tipo_mensaje VARCHAR(20) DEFAULT 'texto',
    p_procesado_por VARCHAR(50) DEFAULT 'dialogflow'
)
RETURNS UUID AS $$
DECLARE
    v_conversacion_id UUID;
BEGIN
    INSERT INTO conversaciones_bot (
        cliente_id,
        numero_whatsapp,
        mensaje_cliente,
        mensaje_bot,
        intent_detectado,
        confianza,
        contexto,
        tipo_mensaje,
        procesado_por
    ) VALUES (
        p_cliente_id,
        p_numero_whatsapp,
        p_mensaje_cliente,
        p_mensaje_bot,
        p_intent_detectado,
        p_confianza,
        p_contexto,
        p_tipo_mensaje,
        p_procesado_por
    )
    RETURNING id INTO v_conversacion_id;

    -- Actualizar métricas del día
    PERFORM fn_actualizar_metricas_bot(
        CURRENT_DATE,
        p_tipo_mensaje = 'audio',
        p_intent_detectado,
        p_confianza
    );

    RETURN v_conversacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_registrar_transcripcion_audio
-- Registra una transcripción de audio
-- ===========================================

CREATE OR REPLACE FUNCTION fn_registrar_transcripcion_audio(
    p_conversacion_id UUID,
    p_cliente_id UUID,
    p_transcripcion TEXT,
    p_audio_url TEXT DEFAULT NULL,
    p_confianza DECIMAL DEFAULT NULL,
    p_idioma_detectado VARCHAR(10) DEFAULT 'es-AR',
    p_palabras JSONB DEFAULT NULL,
    p_alternativas JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_transcripcion_id UUID;
BEGIN
    INSERT INTO transcripciones_audio (
        conversacion_id,
        cliente_id,
        audio_url,
        transcripcion,
        confianza,
        idioma_detectado,
        palabras,
        alternativas
    ) VALUES (
        p_conversacion_id,
        p_cliente_id,
        p_audio_url,
        p_transcripcion,
        p_confianza,
        p_idioma_detectado,
        p_palabras,
        p_alternativas
    )
    RETURNING id INTO v_transcripcion_id;

    RETURN v_transcripcion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_actualizar_metricas_bot
-- Actualiza las métricas agregadas del bot
-- ===========================================

CREATE OR REPLACE FUNCTION fn_actualizar_metricas_bot(
    p_fecha DATE,
    p_es_audio BOOLEAN DEFAULT false,
    p_intent VARCHAR(100) DEFAULT NULL,
    p_confianza DECIMAL DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_semana INTEGER;
    v_mes INTEGER;
    v_año INTEGER;
    v_intenciones JSONB;
BEGIN
    v_semana := EXTRACT(WEEK FROM p_fecha);
    v_mes := EXTRACT(MONTH FROM p_fecha);
    v_año := EXTRACT(YEAR FROM p_fecha);

    -- Obtener intenciones actuales
    SELECT intenciones_mas_comunes INTO v_intenciones
    FROM metricas_bot
    WHERE fecha = p_fecha;

    -- Actualizar conteo de intenciones
    IF p_intent IS NOT NULL THEN
        IF v_intenciones IS NULL THEN
            v_intenciones := jsonb_build_object(p_intent, 1);
        ELSE
            v_intenciones := jsonb_set(
                v_intenciones,
                ARRAY[p_intent],
                to_jsonb(COALESCE((v_intenciones->>p_intent)::INTEGER, 0) + 1)
            );
        END IF;
    END IF;

    INSERT INTO metricas_bot (
        fecha,
        semana,
        mes,
        año,
        total_mensajes,
        mensajes_por_voz,
        intenciones_mas_comunes
    ) VALUES (
        p_fecha,
        v_semana,
        v_mes,
        v_año,
        1,
        CASE WHEN p_es_audio THEN 1 ELSE 0 END,
        v_intenciones
    )
    ON CONFLICT (fecha) DO UPDATE SET
        total_mensajes = metricas_bot.total_mensajes + 1,
        mensajes_por_voz = metricas_bot.mensajes_por_voz + CASE WHEN p_es_audio THEN 1 ELSE 0 END,
        intenciones_mas_comunes = v_intenciones,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_obtener_metricas_bot_semana
-- Obtiene métricas agregadas de la semana
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_metricas_bot_semana(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
    v_semana INTEGER;
    v_año INTEGER;
    v_result JSONB;
BEGIN
    v_semana := EXTRACT(WEEK FROM p_fecha);
    v_año := EXTRACT(YEAR FROM p_fecha);

    SELECT jsonb_build_object(
        'total_mensajes', COALESCE(SUM(total_mensajes), 0),
        'mensajes_por_voz', COALESCE(SUM(mensajes_por_voz), 0),
        'pedidos_creados', COALESCE(SUM(pedidos_creados), 0),
        'tasa_exito', COALESCE(AVG(tasa_exito), 0),
        'tiempo_promedio_respuesta', COALESCE(AVG(tiempo_promedio_respuesta), 0),
        'confianza_promedio', COALESCE(AVG(confianza_promedio), 0)
    )
    INTO v_result
    FROM metricas_bot
    WHERE EXTRACT(WEEK FROM fecha) = v_semana
      AND EXTRACT(YEAR FROM fecha) = v_año;

    RETURN COALESCE(v_result, jsonb_build_object(
        'total_mensajes', 0,
        'mensajes_por_voz', 0,
        'pedidos_creados', 0,
        'tasa_exito', 0,
        'tiempo_promedio_respuesta', 0,
        'confianza_promedio', 0
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos
GRANT SELECT, INSERT ON conversaciones_bot TO authenticated;
GRANT SELECT, INSERT ON transcripciones_audio TO authenticated;
GRANT SELECT ON metricas_bot TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_conversacion_bot TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_transcripcion_audio TO authenticated;
GRANT EXECUTE ON FUNCTION fn_actualizar_metricas_bot TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_metricas_bot_semana TO authenticated;

COMMIT;

