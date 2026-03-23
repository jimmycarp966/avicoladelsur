-- ===========================================
-- MIGRACION: Auditoria de ejecuciones WebMCP
-- Fecha: 2026-02-14
-- Descripcion: Registro trazable de herramientas ejecutadas via WebMCP
-- ===========================================

BEGIN;

CREATE TABLE IF NOT EXISTS webmcp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id),
    user_role VARCHAR(50) NOT NULL,
    tool_id VARCHAR(120) NOT NULL,
    tool_kind VARCHAR(20) NOT NULL CHECK (tool_kind IN ('navigation', 'api')),
    risk VARCHAR(20) NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
    confirmation_mode VARCHAR(20) NOT NULL CHECK (confirmation_mode IN ('none', 'soft', 'hard')),
    confirmation_provided BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'blocked')),
    endpoint TEXT,
    method VARCHAR(10),
    request_input JSONB,
    response_payload JSONB,
    http_status INTEGER,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webmcp_audit_logs_user_id ON webmcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webmcp_audit_logs_tool_id ON webmcp_audit_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_webmcp_audit_logs_status ON webmcp_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_webmcp_audit_logs_created_at ON webmcp_audit_logs(created_at DESC);

ALTER TABLE webmcp_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webmcp_audit_insert_own" ON webmcp_audit_logs;
CREATE POLICY "webmcp_audit_insert_own" ON webmcp_audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "webmcp_audit_select_own_or_admin" ON webmcp_audit_logs;
CREATE POLICY "webmcp_audit_select_own_or_admin" ON webmcp_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.rol = 'admin'
              AND u.activo = true
        )
    );

COMMENT ON TABLE webmcp_audit_logs IS 'Trazabilidad de ejecuciones y bloqueos de tools WebMCP';
COMMENT ON COLUMN webmcp_audit_logs.request_input IS 'Input sanitizado (sin secretos)';
COMMENT ON COLUMN webmcp_audit_logs.response_payload IS 'Respuesta resumida o error del endpoint ejecutado';

COMMIT;;
