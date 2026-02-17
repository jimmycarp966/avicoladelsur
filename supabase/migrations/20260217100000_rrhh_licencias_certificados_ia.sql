-- ===========================================
-- RRHH LICENCIAS: CERTIFICADOS + AUDITORIA IA
-- Fecha: 2026-02-17
-- Objetivo:
--   - Exigir soporte documental para licencias.
--   - Registrar auditoria IA del certificado.
--   - Soportar SLA de presentacion (24h) con excepciones.
-- ===========================================

BEGIN;

ALTER TABLE rrhh_licencias
  ADD COLUMN IF NOT EXISTS fecha_sintomas TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS diagnostico_reportado TEXT,
  ADD COLUMN IF NOT EXISTS excepcion_plazo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_excepcion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_presentacion_certificado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_limite_presentacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS presentado_en_termino BOOLEAN,
  ADD COLUMN IF NOT EXISTS certificado_url TEXT,
  ADD COLUMN IF NOT EXISTS certificado_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS certificado_nombre_archivo TEXT,
  ADD COLUMN IF NOT EXISTS certificado_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS certificado_tamano_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS estado_revision VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS revision_manual_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS revisado_por UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ia_certificado_valido BOOLEAN,
  ADD COLUMN IF NOT EXISTS ia_confianza NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ia_observaciones TEXT,
  ADD COLUMN IF NOT EXISTS ia_nombre_detectado TEXT,
  ADD COLUMN IF NOT EXISTS ia_diagnostico_detectado TEXT;

CREATE INDEX IF NOT EXISTS idx_rrhh_licencias_estado_revision
  ON rrhh_licencias(estado_revision);

CREATE INDEX IF NOT EXISTS idx_rrhh_licencias_fecha_limite_presentacion
  ON rrhh_licencias(fecha_limite_presentacion);

CREATE INDEX IF NOT EXISTS idx_rrhh_licencias_revision_manual_required
  ON rrhh_licencias(revision_manual_required);

COMMIT;

