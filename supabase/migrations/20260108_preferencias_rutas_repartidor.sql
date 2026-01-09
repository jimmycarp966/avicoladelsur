-- Migración: Preferencias de Rutas del Repartidor
-- Fecha: 2026-01-08
-- Descripción: Tabla para guardar preferencias aprendidas de rutas

-- Tabla de preferencias
CREATE TABLE IF NOT EXISTS preferencias_rutas_repartidor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  preferencia TEXT NOT NULL CHECK (preferencia IN ('mas_corta', 'mas_rapida', 'sin_autopista')),
  conteo INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(repartidor_id, preferencia)
);

-- Índice para búsquedas por repartidor
CREATE INDEX IF NOT EXISTS idx_preferencias_rutas_repartidor_id 
ON preferencias_rutas_repartidor(repartidor_id);

-- Función RPC para registrar preferencia (upsert con incremento)
CREATE OR REPLACE FUNCTION fn_registrar_preferencia_ruta(
  p_repartidor_id UUID,
  p_preferencia TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO preferencias_rutas_repartidor (repartidor_id, preferencia, conteo, updated_at)
  VALUES (p_repartidor_id, p_preferencia, 1, now())
  ON CONFLICT (repartidor_id, preferencia) 
  DO UPDATE SET 
    conteo = preferencias_rutas_repartidor.conteo + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE preferencias_rutas_repartidor ENABLE ROW LEVEL SECURITY;

-- Repartidores pueden leer sus propias preferencias
CREATE POLICY preferencias_repartidor_read ON preferencias_rutas_repartidor
  FOR SELECT
  USING (repartidor_id = auth.uid());

-- Repartidores pueden insertar/actualizar sus propias preferencias
CREATE POLICY preferencias_repartidor_write ON preferencias_rutas_repartidor
  FOR ALL
  USING (repartidor_id = auth.uid())
  WITH CHECK (repartidor_id = auth.uid());

-- Admins pueden ver todas las preferencias
CREATE POLICY preferencias_admin_read ON preferencias_rutas_repartidor
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Grant para función RPC
GRANT EXECUTE ON FUNCTION fn_registrar_preferencia_ruta TO authenticated;
