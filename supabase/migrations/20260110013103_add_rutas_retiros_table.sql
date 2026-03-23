-- Tabla de Retiros de Sucursales (Transferencias de efectivo via repartidores)
CREATE TABLE IF NOT EXISTS rutas_retiros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruta_id UUID REFERENCES rutas_reparto(id) ON DELETE SET NULL,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE NOT NULL,
    vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL,
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    chofer_nombre TEXT NOT NULL,
    descripcion TEXT,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'validado', 'cancelado')),
    movimiento_egreso_id UUID REFERENCES tesoreria_movimientos(id),
    movimiento_ingreso_id UUID REFERENCES tesoreria_movimientos(id),
    validado_por UUID REFERENCES usuarios(id),
    validado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES usuarios(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_ruta ON rutas_retiros(ruta_id);
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_sucursal ON rutas_retiros(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_estado ON rutas_retiros(estado);
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_created ON rutas_retiros(created_at DESC);

-- RLS
ALTER TABLE rutas_retiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retiros viewable by authenticated users"
ON rutas_retiros FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Retiros insertable by sucursal staff"
ON rutas_retiros FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('admin', 'vendedor', 'encargado_sucursal', 'tesorero')
    )
);

CREATE POLICY "Retiros updatable by tesoreria"
ON rutas_retiros FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('admin', 'vendedor', 'tesorero')
    )
);

-- Comentario
COMMENT ON TABLE rutas_retiros IS 'Registro de retiros de efectivo de sucursales transportados por repartidores hacia Casa Central';;
