-- Tabla para registrar notificaciones enviadas a clientes
CREATE TABLE IF NOT EXISTS notificaciones_clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- presupuesto_creado, pedido_confirmado, en_camino, entregado, cancelado
    mensaje TEXT NOT NULL,
    referencia_id UUID, -- ID del presupuesto, pedido, etc.
    canal VARCHAR(20) DEFAULT 'whatsapp', -- whatsapp, sms, email
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, enviada, fallida
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enviada_at TIMESTAMPTZ
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_notificaciones_cliente_id ON notificaciones_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones_clientes(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones_clientes(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON notificaciones_clientes(created_at DESC);

COMMENT ON TABLE notificaciones_clientes IS 'Historial de notificaciones enviadas a clientes por distintos canales';
COMMENT ON COLUMN notificaciones_clientes.tipo IS 'Tipo de notificación: presupuesto_creado, pedido_confirmado, en_camino, entregado, cancelado';
COMMENT ON COLUMN notificaciones_clientes.canal IS 'Canal de envío: whatsapp, sms, email';
