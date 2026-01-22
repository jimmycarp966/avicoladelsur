-- ===========================================
-- MIGRACIÓN: Sistema de Remitos
-- Fecha: 22/01/2026
-- Objetivo: Crear estructura para remitos internos y externos
-- ===========================================

BEGIN;

-- 1. Secuencia para numeración
CREATE SEQUENCE IF NOT EXISTS seq_remito_numero START 1;

-- 2. Tabla de Remitos
CREATE TABLE IF NOT EXISTS remitos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero VARCHAR(20) UNIQUE NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('externo', 'interno_traslado', 'interno_produccion')),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    
    -- Actores
    emisor_id UUID REFERENCES auth.users(id),
    receptor_id UUID REFERENCES auth.users(id), -- Solo para internos si hay receptor de sistema
    receptor_nombre VARCHAR(255), -- Para externos o cuando no es usuario de sistema
    
    -- Ubicaciones
    sucursal_origen_id UUID REFERENCES sucursales(id),
    sucursal_destino_id UUID REFERENCES sucursales(id),
    cliente_id UUID REFERENCES clientes(id),
    
    -- Relación con entidades core
    entidad_relacionada_id UUID NOT NULL,
    entidad_relacionada_tipo VARCHAR(50) NOT NULL CHECK (entidad_relacionada_tipo IN ('entrega', 'transferencia', 'produccion')),
    
    -- Datos y Multimedia
    datos_snapshot JSONB NOT NULL, -- Detalle de items: [{id, nombre, cantidad, peso, unidad}]
    archivo_url TEXT, -- Link al PDF en Storage
    firma_url TEXT,   -- Link a la imagen de firma en Storage
    
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_remitos_entidad ON remitos(entidad_relacionada_tipo, entidad_relacionada_id);
CREATE INDEX IF NOT EXISTS idx_remitos_numero ON remitos(numero);
CREATE INDEX IF NOT EXISTS idx_remitos_fecha ON remitos(fecha DESC);

-- 4. Función para generar el próximo número (puedes llamar desde action)
CREATE OR REPLACE FUNCTION fn_generar_numero_remito()
RETURNS TEXT AS $$
DECLARE
    v_numero INTEGER;
BEGIN
    v_numero := nextval('seq_remito_numero');
    RETURN 'REM-' || LPAD(v_numero::TEXT, 8, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER para updated_at
CREATE OR REPLACE FUNCTION fn_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropear si existe para evitar error en re-run
DROP TRIGGER IF EXISTS tr_remitos_updated_at ON remitos;
CREATE TRIGGER tr_remitos_updated_at
BEFORE UPDATE ON remitos
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at_column();

-- 6. RLS
ALTER TABLE remitos ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Remitos: lectura para todos los autenticados" ON remitos;
CREATE POLICY "Remitos: lectura para todos los autenticados"
ON remitos FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Remitos: inserción para todos los autenticados" ON remitos;
CREATE POLICY "Remitos: inserción para todos los autenticados"
ON remitos FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Remitos: actualización solo para admins" ON remitos;
CREATE POLICY "Remitos: actualización solo para admins"
ON remitos FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin');

COMMIT;
