-- Tabla para almacenar mensajes del bot de WhatsApp
-- Permite visualizar conversaciones en tiempo real en el dashboard

CREATE TABLE IF NOT EXISTS bot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para consultas eficientes
CREATE INDEX idx_bot_messages_phone ON bot_messages(phone_number);
CREATE INDEX idx_bot_messages_created ON bot_messages(created_at DESC);
CREATE INDEX idx_bot_messages_cliente ON bot_messages(cliente_id);
CREATE INDEX idx_bot_messages_direction ON bot_messages(direction);

-- RLS (Row Level Security) para controlar acceso
ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;

-- Política: Solo usuarios autenticados pueden leer mensajes
CREATE POLICY "Usuarios autenticados pueden leer mensajes"
ON bot_messages FOR SELECT
TO authenticated
USING (true);

-- Política: Solo el sistema (service role) puede insertar mensajes
CREATE POLICY "Solo service role puede insertar mensajes"
ON bot_messages FOR INSERT
TO service_role
WITH CHECK (true);

-- Política: Nadie puede actualizar o eliminar mensajes (inmutable)
CREATE POLICY "No se pueden actualizar mensajes"
ON bot_messages FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No se pueden eliminar mensajes"
ON bot_messages FOR DELETE
TO authenticated
USING (false);

-- Comentario para documentación
COMMENT ON TABLE bot_messages IS 'Almacena mensajes del bot de WhatsApp para visualización en dashboard en tiempo real';
COMMENT ON COLUMN bot_messages.direction IS 'incoming: mensaje del cliente, outgoing: respuesta del bot';
COMMENT ON COLUMN bot_messages.metadata IS 'Información adicional como intención detectada, herramientas usadas, etc.';

-- Vista para obtener conversaciones agrupadas por cliente
CREATE OR REPLACE VIEW bot_conversations AS
SELECT 
  phone_number,
  cliente_id,
  MAX(created_at) AS last_message_at,
  COUNT(*) FILTER (WHERE direction = 'incoming') AS incoming_count,
  COUNT(*) FILTER (WHERE direction = 'outgoing') AS outgoing_count,
  (
    SELECT message 
    FROM bot_messages bm2 
    WHERE bm2.phone_number = bot_messages.phone_number 
    ORDER BY bm2.created_at DESC 
    LIMIT 1
  ) AS last_message
FROM bot_messages
GROUP BY phone_number, cliente_id
ORDER BY last_message_at DESC;

COMMENT ON VIEW bot_conversations IS 'Vista para listar todas las conversaciones activas del bot';
