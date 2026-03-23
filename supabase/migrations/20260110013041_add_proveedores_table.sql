-- Tabla de Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    cuit TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    categoria TEXT,
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);

-- RLS
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proveedores viewable by authenticated users"
ON proveedores FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Proveedores manageable by admin and tesorero"
ON proveedores FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('admin', 'vendedor', 'tesorero')
    )
);

-- Comentario
COMMENT ON TABLE proveedores IS 'Gestión de proveedores para control de pagos y gastos';;
