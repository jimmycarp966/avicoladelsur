-- ================================================
-- MIGRACIÓN: Mejoras Conciliación Bancaria v3
-- Fecha: 2026-02-03
-- ================================================

-- 1. TABLA: Jobs de Procesamiento Async
CREATE TABLE IF NOT EXISTS conciliacion_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estado VARCHAR(20) DEFAULT 'pendiente',
    usuario_id UUID REFERENCES usuarios(id) NOT NULL,
    archivo_sabana TEXT NOT NULL,
    total_comprobantes INTEGER DEFAULT 0,
    comprobantes_procesados INTEGER DEFAULT 0,
    progreso_porcentaje INTEGER DEFAULT 0,
    sesion_id UUID REFERENCES sesiones_conciliacion(id),
    error_mensaje TEXT,
    resultado_resumen JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: Hashes de Comprobantes
CREATE TABLE IF NOT EXISTS comprobantes_hashes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hash_sha256 TEXT UNIQUE NOT NULL,
    sesion_id UUID REFERENCES sesiones_conciliacion(id),
    comprobante_id UUID REFERENCES comprobantes_conciliacion(id),
    nombre_archivo TEXT,
    fecha_subida TIMESTAMPTZ DEFAULT NOW(),
    usuario_id UUID REFERENCES usuarios(id)
);

-- 3. TABLA: Alertas de Validación
CREATE TABLE IF NOT EXISTS conciliacion_alertas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sesion_id UUID REFERENCES sesiones_conciliacion(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    mensaje TEXT NOT NULL,
    detalles JSONB DEFAULT '{}',
    resuelta BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CAMPOS ADICIONALES
ALTER TABLE comprobantes_conciliacion ADD COLUMN IF NOT EXISTS hash_archivo TEXT;
ALTER TABLE comprobantes_conciliacion ADD COLUMN IF NOT EXISTS metadata_validacion JSONB DEFAULT '{}';

-- 5. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_jobs_estado ON conciliacion_jobs(estado);
CREATE INDEX IF NOT EXISTS idx_jobs_usuario ON conciliacion_jobs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_jobs_sesion ON conciliacion_jobs(sesion_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON conciliacion_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_hashes_hash ON comprobantes_hashes(hash_sha256);
CREATE INDEX IF NOT EXISTS idx_hashes_sesion ON comprobantes_hashes(sesion_id);

CREATE INDEX IF NOT EXISTS idx_alertas_sesion ON conciliacion_alertas(sesion_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON conciliacion_alertas(tipo);

CREATE INDEX IF NOT EXISTS idx_comprobantes_hash ON comprobantes_conciliacion(hash_archivo);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado_cliente ON comprobantes_conciliacion(estado_validacion, cliente_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_monto ON comprobantes_conciliacion(monto);
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha ON comprobantes_conciliacion(fecha);

-- 6. RLS
ALTER TABLE conciliacion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacion_alertas ENABLE ROW LEVEL SECURITY;

-- Comentarios
COMMENT ON TABLE conciliacion_jobs IS 'Cola de procesamiento async para conciliaciones';
COMMENT ON TABLE comprobantes_hashes IS 'Hashes SHA-256 para deduplicación';
COMMENT ON TABLE conciliacion_alertas IS 'Alertas de validación de conciliaciones';
