-- Tabla de Recordatorios de Cobranza (Moratoria)
CREATE TABLE IF NOT EXISTS clientes_recordatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    nota TEXT NOT NULL,
    tipo TEXT DEFAULT 'llamada' CHECK (tipo IN ('llamada', 'visita', 'whatsapp', 'email', 'otro')),
    fecha_proximo_contacto DATE,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado', 'sin_respuesta')),
    resultado TEXT,
    created_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_recordatorios_cliente ON clientes_recordatorios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_recordatorios_fecha ON clientes_recordatorios(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_recordatorios_estado ON clientes_recordatorios(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_recordatorios_proximo ON clientes_recordatorios(fecha_proximo_contacto);

-- RLS
ALTER TABLE clientes_recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recordatorios viewable by authenticated users"
ON clientes_recordatorios FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Recordatorios manageable by staff"
ON clientes_recordatorios FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('admin', 'vendedor', 'tesorero', 'encargado_sucursal')
    )
);

-- Comentario
COMMENT ON TABLE clientes_recordatorios IS 'Bitácora de gestión de cobranza y recordatorios de pago para clientes morosos';;
