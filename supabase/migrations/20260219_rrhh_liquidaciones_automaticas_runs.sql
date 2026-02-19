BEGIN;

CREATE TABLE IF NOT EXISTS rrhh_liquidacion_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  periodo_mes INTEGER NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_anio INTEGER NOT NULL CHECK (periodo_anio >= 2000),
  fuente VARCHAR(20) NOT NULL CHECK (fuente IN ('cron', 'ui_fallback', 'manual')),
  estado VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (estado IN ('running', 'success', 'error', 'skipped')),
  ventana_fecha DATE NOT NULL DEFAULT ((timezone('America/Argentina/Buenos_Aires', now()))::date),
  iniciado_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  finalizado_at TIMESTAMP WITH TIME ZONE,
  resumen_json JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_liquidacion_runs_periodo
  ON rrhh_liquidacion_runs (periodo_anio, periodo_mes, estado);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rrhh_liquidacion_runs_periodo_fuente_ventana
  ON rrhh_liquidacion_runs (periodo_anio, periodo_mes, fuente, ventana_fecha);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rrhh_liquidacion_runs_running_periodo
  ON rrhh_liquidacion_runs (periodo_anio, periodo_mes)
  WHERE estado = 'running';

ALTER TABLE rrhh_liquidacion_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_liquidacion_runs" ON rrhh_liquidacion_runs;
CREATE POLICY "Admin full access on rrhh_liquidacion_runs"
ON rrhh_liquidacion_runs
FOR ALL
USING (auth.jwt() ->> 'rol' = 'admin');

COMMIT;
