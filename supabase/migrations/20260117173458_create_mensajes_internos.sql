-- Tabla para mensajes internos entre empleados
CREATE TABLE IF NOT EXISTS mensajes_internos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remitente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  destinatario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  asunto VARCHAR(255) NOT NULL,
  contenido TEXT NOT NULL,
  leido BOOLEAN DEFAULT false,
  archivado_remitente BOOLEAN DEFAULT false,
  archivado_destinatario BOOLEAN DEFAULT false,
  eliminado_remitente BOOLEAN DEFAULT false,
  eliminado_destinatario BOOLEAN DEFAULT false,
  fecha_lectura TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario ON mensajes_internos(destinatario_id, leido, eliminado_destinatario);
CREATE INDEX IF NOT EXISTS idx_mensajes_remitente ON mensajes_internos(remitente_id, eliminado_remitente);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON mensajes_internos(created_at DESC);

-- Habilitar RLS
ALTER TABLE mensajes_internos ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver mensajes donde son remitente o destinatario
CREATE POLICY "Usuarios pueden ver sus mensajes" ON mensajes_internos
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM usuarios WHERE id = remitente_id OR id = destinatario_id
    )
  );

-- Política: usuarios pueden insertar mensajes donde son el remitente
CREATE POLICY "Usuarios pueden enviar mensajes" ON mensajes_internos
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM usuarios WHERE id = remitente_id)
  );

-- Política: usuarios pueden actualizar mensajes donde son remitente o destinatario
CREATE POLICY "Usuarios pueden actualizar sus mensajes" ON mensajes_internos
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM usuarios WHERE id = remitente_id OR id = destinatario_id
    )
  );

-- Comentarios
COMMENT ON TABLE mensajes_internos IS 'Sistema de mensajería interna entre empleados';
COMMENT ON COLUMN mensajes_internos.remitente_id IS 'Usuario que envía el mensaje';
COMMENT ON COLUMN mensajes_internos.destinatario_id IS 'Usuario que recibe el mensaje';
COMMENT ON COLUMN mensajes_internos.leido IS 'Indica si el destinatario leyó el mensaje';
COMMENT ON COLUMN mensajes_internos.archivado_remitente IS 'Si el remitente archivó el mensaje';
COMMENT ON COLUMN mensajes_internos.archivado_destinatario IS 'Si el destinatario archivó el mensaje';;
