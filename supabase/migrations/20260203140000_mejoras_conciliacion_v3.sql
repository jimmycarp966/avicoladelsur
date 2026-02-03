-- ================================================
-- MIGRACIÓN: Mejoras Conciliación Bancaria v3
-- Fecha: 2026-02-03
-- Descripción: Deduplicación, validación de montos, jobs async
-- ================================================

-- ================================
-- 1. TABLA: Jobs de Procesamiento Async
-- ================================
CREATE TABLE IF NOT EXISTS conciliacion_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, procesando, completado, error, cancelado
    usuario_id UUID REFERENCES usuarios(id) NOT NULL,
    archivo_sabana TEXT NOT NULL,
    total_comprobantes INTEGER DEFAULT 0,
    comprobantes_procesados INTEGER DEFAULT 0,
    progreso_porcentaje INTEGER DEFAULT 0,
    sesion_id UUID REFERENCES sesiones_conciliacion(id),
    error_mensaje TEXT,
    resultado_resumen JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}', -- Para guardar hashes de archivos, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para jobs
CREATE INDEX IF NOT EXISTS idx_jobs_estado ON conciliacion_jobs(estado);
CREATE INDEX IF NOT EXISTS idx_jobs_usuario ON conciliacion_jobs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_jobs_sesion ON conciliacion_jobs(sesion_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON conciliacion_jobs(created_at);

-- ================================
-- 2. TABLA: Hashes de Comprobantes (Deduplicación)
-- ================================
CREATE TABLE IF NOT EXISTS comprobantes_hashes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hash_sha256 TEXT UNIQUE NOT NULL,
    sesion_id UUID REFERENCES sesiones_conciliacion(id),
    comprobante_id UUID REFERENCES comprobantes_conciliacion(id),
    nombre_archivo TEXT,
    fecha_subida TIMESTAMPTZ DEFAULT NOW(),
    usuario_id UUID REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_hashes_hash ON comprobantes_hashes(hash_sha256);
CREATE INDEX IF NOT EXISTS idx_hashes_sesion ON comprobantes_hashes(sesion_id);

-- ================================
-- 3. CAMPOS ADICIONALES EN COMPROBANTES
-- ================================

-- Agregar campo hash a comprobantes_conciliacion si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comprobantes_conciliacion' 
                   AND column_name = 'hash_archivo') THEN
        ALTER TABLE comprobantes_conciliacion ADD COLUMN hash_archivo TEXT;
    END IF;
END $$;

-- Agregar campo de metadatos de validación
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'comprobantes_conciliacion' 
                   AND column_name = 'metadata_validacion') THEN
        ALTER TABLE comprobantes_conciliacion ADD COLUMN metadata_validacion JSONB DEFAULT '{}';
    END IF;
END $$;

-- Agregar índice para hash_archivo
CREATE INDEX IF NOT EXISTS idx_comprobantes_hash ON comprobantes_conciliacion(hash_archivo);

-- ================================
-- 4. TABLA DE ALERTAS DE VALIDACIÓN
-- ================================
CREATE TABLE IF NOT EXISTS conciliacion_alertas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sesion_id UUID REFERENCES sesiones_conciliacion(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL, -- error, warning, info
    codigo VARCHAR(50) NOT NULL,
    mensaje TEXT NOT NULL,
    detalles JSONB DEFAULT '{}',
    resuelta BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_sesion ON conciliacion_alertas(sesion_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON conciliacion_alertas(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta ON conciliacion_alertas(resuelta);

-- ================================
-- 5. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ================================

-- Índice compuesto para búsquedas frecuentes en comprobantes
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado_cliente ON comprobantes_conciliacion(estado_validacion, cliente_id);

-- Índice para búsqueda por monto (útil para detección de duplicados)
CREATE INDEX IF NOT EXISTS idx_comprobantes_monto ON comprobantes_conciliacion(monto);

-- Índice para búsqueda por fecha
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha ON comprobantes_conciliacion(fecha);

-- ================================
-- 6. RLS PARA NUEVAS TABLAS
-- ================================

ALTER TABLE conciliacion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacion_alertas ENABLE ROW LEVEL SECURITY;

-- Políticas para conciliacion_jobs
CREATE POLICY "Admin y tesorero pueden ver todos los jobs"
    ON conciliacion_jobs FOR SELECT
    USING (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

CREATE POLICY "Admin y tesorero pueden crear jobs"
    ON conciliacion_jobs FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

CREATE POLICY "Admin y tesorero pueden actualizar jobs"
    ON conciliacion_jobs FOR UPDATE
    USING (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

-- Políticas para comprobantes_hashes
CREATE POLICY "Admin y tesorero pueden ver hashes"
    ON comprobantes_hashes FOR SELECT
    USING (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

CREATE POLICY "Admin y tesorero pueden crear hashes"
    ON comprobantes_hashes FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

-- Políticas para conciliacion_alertas
CREATE POLICY "Admin y tesorero pueden ver alertas"
    ON conciliacion_alertas FOR SELECT
    USING (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

CREATE POLICY "Admin y tesorero pueden crear alertas"
    ON conciliacion_alertas FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

CREATE POLICY "Admin y tesorero pueden actualizar alertas"
    ON conciliacion_alertas FOR UPDATE
    USING (auth.jwt() ->> 'role' IN ('admin', 'tesorero'));

-- ================================
-- 7. FUNCIÓN PARA LIMPIAR JOBS VIEJOS
-- ================================
CREATE OR REPLACE FUNCTION limpiar_jobs_antiguos()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Eliminar jobs completados o con error de más de 30 días
    DELETE FROM conciliacion_jobs 
    WHERE estado IN ('completado', 'error', 'cancelado')
    AND created_at < NOW() - INTERVAL '30 days';
    
    -- Eliminar hashes de más de 90 días (los comprobantes ya están procesados)
    DELETE FROM comprobantes_hashes 
    WHERE fecha_subida < NOW() - INTERVAL '90 days';
END;
$$;

-- ================================
-- 8. TRIGGER PARA ACTUALIZAR updated_at EN JOBS
-- ================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_conciliacion_jobs_updated_at ON conciliacion_jobs;
CREATE TRIGGER update_conciliacion_jobs_updated_at
    BEFORE UPDATE ON conciliacion_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- 9. COMENTARIOS DE DOCUMENTACIÓN
-- ================================
COMMENT ON TABLE conciliacion_jobs IS 'Cola de procesamiento asíncrono para conciliaciones grandes';
COMMENT ON TABLE comprobantes_hashes IS 'Hashes SHA-256 de comprobantes para detección de duplicados';
COMMENT ON TABLE conciliacion_alertas IS 'Alertas generadas durante la validación de conciliaciones';

COMMENT ON COLUMN comprobantes_conciliacion.hash_archivo IS 'Hash SHA-256 del archivo para deduplicación';
COMMENT ON COLUMN comprobantes_conciliacion.metadata_validacion IS 'Metadatos adicionales del proceso de validación';
