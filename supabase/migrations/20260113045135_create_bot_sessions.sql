-- Tabla para sesiones del bot con Vertex AI
-- Gestiona memoria conversacional y contexto de clientes

CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  messages JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_bot_sessions_phone ON bot_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_session_id ON bot_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_expires ON bot_sessions(expires_at);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_bot_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER bot_sessions_updated_at
  BEFORE UPDATE ON bot_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_sessions_updated_at();

-- Función para agregar mensaje al array
CREATE OR REPLACE FUNCTION append_bot_session_message(
  p_session_id VARCHAR,
  p_message JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE bot_sessions
  SET messages = messages || p_message,
      updated_at = NOW()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Comentario sobre la tabla
COMMENT ON TABLE bot_sessions IS 'Sesiones del bot WhatsApp con Vertex AI - almacena historial de conversaciones y contexto del cliente';
COMMENT ON COLUMN bot_sessions.session_id IS 'ID único de sesión (formato: whatsapp_NUMERO)';
COMMENT ON COLUMN bot_sessions.phone_number IS 'Número de teléfono del cliente';
COMMENT ON COLUMN bot_sessions.messages IS 'Array de mensajes [{role, content, timestamp}]';
COMMENT ON COLUMN bot_sessions.context IS 'Contexto adicional del cliente (preferencias, historial, etc.)';
COMMENT ON COLUMN bot_sessions.expires_at IS 'Fecha de expiración de la sesión (24 horas por defecto)';
;
