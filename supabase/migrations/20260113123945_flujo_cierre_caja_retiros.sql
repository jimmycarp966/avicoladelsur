-- ===========================================
-- MIGRACIÓN: Flujo de Cierre de Caja y Retiros de Sucursales
-- Fecha: 2026-01-13
-- ===========================================

-- 1. Agregar zona_id a sucursales
-- ===========================================
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS zona_id UUID REFERENCES zonas(id);

-- 2. Crear tabla rutas_retiros (si no existe)
-- ===========================================
CREATE TABLE IF NOT EXISTS rutas_retiros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID REFERENCES rutas_reparto(id),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id),
    vehiculo_id UUID REFERENCES vehiculos(id),
    monto NUMERIC(14,2) NOT NULL,
    chofer_nombre VARCHAR(255),
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'validado', 'cancelado')),
    movimiento_egreso_id UUID REFERENCES tesoreria_movimientos(id),
    movimiento_ingreso_id UUID REFERENCES tesoreria_movimientos(id),
    validado_por UUID REFERENCES usuarios(id),
    validado_at TIMESTAMPTZ,
    created_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear tabla para arqueo de billetes
-- ===========================================
CREATE TABLE IF NOT EXISTS arqueo_billetes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cierre_caja_id UUID NOT NULL REFERENCES cierres_caja(id) ON DELETE CASCADE,
    denominacion NUMERIC(10,2) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(14,2) GENERATED ALWAYS AS (denominacion * cantidad) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Agregar campos de arqueo a cierres_caja
-- ===========================================
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_esperado NUMERIC(14,2);
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_real NUMERIC(14,2);
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_diferencia NUMERIC(14,2);
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_observaciones TEXT;

-- 5. Crear índices
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_sucursal ON rutas_retiros(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_ruta ON rutas_retiros(ruta_id);
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_estado ON rutas_retiros(estado);
CREATE INDEX IF NOT EXISTS idx_rutas_retiros_created_at ON rutas_retiros(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_arqueo_billetes_cierre ON arqueo_billetes(cierre_caja_id);
CREATE INDEX IF NOT EXISTS idx_arqueo_billetes_denominacion ON arqueo_billetes(denominacion);
CREATE INDEX IF NOT EXISTS idx_sucursales_zona ON sucursales(zona_id);

-- 6. RLS para rutas_retiros
-- ===========================================
ALTER TABLE rutas_retiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_rutas_retiros" ON rutas_retiros
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "repartidor_zona_access_rutas_retiros" ON rutas_retiros
    USING (
        current_setting('jwt.claims.role', true) = 'repartidor' AND
        EXISTS (
            SELECT 1 FROM sucursales s
            WHERE s.id = rutas_retiros.sucursal_id
            AND s.zona_id = (current_setting('jwt.claims.zona_id', true))::UUID
        )
    );

CREATE POLICY "sucursal_own_retiros" ON rutas_retiros
    USING (
        current_setting('jwt.claims.sucursal_id', true)::UUID = sucursal_id OR
        current_setting('jwt.claims.role', true) = 'admin'
    );

-- 7. RLS para arqueo_billetes
-- ===========================================
ALTER TABLE arqueo_billetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_arqueo_billetes" ON arqueo_billetes
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "sucursal_own_arqueo" ON arqueo_billetes
    USING (
        EXISTS (
            SELECT 1 FROM cierres_caja cc
            JOIN tesoreria_cajas tc ON cc.caja_id = tc.id
            WHERE cc.id = arqueo_billetes.cierre_caja_id
            AND tc.sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::UUID
        ) OR current_setting('jwt.claims.role', true) = 'admin'
    );

CREATE POLICY "repartidor_zona_access_arqueo" ON arqueo_billetes
    USING (
        current_setting('jwt.claims.role', true) = 'repartidor' AND
        EXISTS (
            SELECT 1 FROM cierres_caja cc
            JOIN tesoreria_cajas tc ON cc.caja_id = tc.id
            JOIN sucursales s ON tc.sucursal_id = s.id
            WHERE cc.id = arqueo_billetes.cierre_caja_id
            AND s.zona_id = (current_setting('jwt.claims.zona_id', true))::UUID
        )
    );

CREATE POLICY "users_read_sucursal_zona" ON sucursales
    FOR SELECT
    USING (true);

-- 8. Triggers y funciones
-- ===========================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at_rutas_retiros()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_rutas_retiros
    BEFORE UPDATE ON rutas_retiros
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at_rutas_retiros();

CREATE OR REPLACE FUNCTION fn_obtener_zona_sucursal(p_sucursal_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN zona_id FROM sucursales WHERE id = p_sucursal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_calcular_total_arqueo(p_cierre_caja_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(subtotal), 0) INTO v_total
    FROM arqueo_billetes
    WHERE cierre_caja_id = p_cierre_caja_id;
    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
