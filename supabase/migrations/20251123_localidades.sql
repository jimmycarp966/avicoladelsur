-- ===========================================
-- MIGRACIÓN: TABLA LOCALIDADES Y CAMPO EN CLIENTES
-- Fecha: 2025-11-23
-- Descripción: Crea tabla localidades y agrega campo localidad_id a clientes
-- ===========================================

-- ===========================================
-- CREAR TABLA LOCALIDADES
-- ===========================================

CREATE TABLE IF NOT EXISTS localidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    zona_id UUID NOT NULL REFERENCES zonas(id) ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_localidades_zona_id ON localidades(zona_id);
CREATE INDEX IF NOT EXISTS idx_localidades_activo ON localidades(activo) WHERE activo = true;

-- ===========================================
-- AGREGAR CAMPO LOCALIDAD_ID A CLIENTES
-- ===========================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS localidad_id UUID REFERENCES localidades(id) ON DELETE SET NULL;

-- Índice para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_clientes_localidad_id ON clientes(localidad_id);

-- ===========================================
-- FUNCIÓN RPC: OBTENER LOCALIDADES ACTIVAS
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_localidades_activas()
RETURNS TABLE (
    id UUID,
    nombre VARCHAR(100),
    zona_id UUID,
    zona_nombre VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.nombre,
        l.zona_id,
        z.nombre AS zona_nombre
    FROM localidades l
    INNER JOIN zonas z ON l.zona_id = z.id
    WHERE l.activo = true
    AND z.activo = true
    ORDER BY l.nombre ASC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ===========================================

COMMENT ON TABLE localidades IS 'Localidades geográficas asociadas a zonas de entrega';
COMMENT ON COLUMN localidades.zona_id IS 'Zona de entrega a la que pertenece la localidad';
COMMENT ON COLUMN clientes.localidad_id IS 'Localidad del cliente (opcional, puede usar zona_entrega como alternativa)';
COMMENT ON FUNCTION fn_obtener_localidades_activas() IS 'Retorna todas las localidades activas con su zona asociada, ordenadas por nombre';





























































