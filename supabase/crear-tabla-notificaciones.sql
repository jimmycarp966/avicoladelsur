-- Tabla para notificaciones del sistema
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(50) NOT NULL, -- 'pedido_whatsapp', 'reclamo', 'stock_bajo', etc
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB, -- Datos adicionales (pedido_id, cliente_id, etc)
    leida BOOLEAN DEFAULT false,
    usuario_destinatario UUID REFERENCES usuarios(id), -- NULL = todos los admins
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX idx_notificaciones_created_at ON notificaciones(created_at);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_destinatario);

-- Desactivar RLS
ALTER TABLE notificaciones DISABLE ROW LEVEL SECURITY;

-- Función para crear notificación
CREATE OR REPLACE FUNCTION crear_notificacion(
    p_tipo VARCHAR(50),
    p_titulo VARCHAR(255),
    p_mensaje TEXT,
    p_datos JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notificacion_id UUID;
BEGIN
    INSERT INTO notificaciones (tipo, titulo, mensaje, datos)
    VALUES (p_tipo, p_titulo, p_mensaje, p_datos)
    RETURNING id INTO v_notificacion_id;
    
    RETURN v_notificacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION crear_notificacion(VARCHAR, VARCHAR, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION crear_notificacion(VARCHAR, VARCHAR, TEXT, JSONB) TO authenticated;

