-- ================================================
-- Migración: Sistema de Aprendizaje de Pesajes
-- Fecha: 2026-01-09
-- Descripción: Tablas para historial de pesajes y estadísticas por producto
-- ================================================

-- Tabla: historial de pesajes individuales
-- Guarda cada pesaje con el feedback del usuario
CREATE TABLE IF NOT EXISTS pesajes_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  peso_solicitado DECIMAL(10,3) NOT NULL,
  peso_real DECIMAL(10,3) NOT NULL,
  diferencia_kg DECIMAL(10,3) GENERATED ALWAYS AS (peso_real - peso_solicitado) STORED,
  diferencia_pct DECIMAL(6,2) GENERATED ALWAYS AS (
    CASE WHEN peso_solicitado > 0 
    THEN ((peso_real - peso_solicitado) / peso_solicitado * 100)
    ELSE 0 END
  ) STORED,
  fue_anomalia BOOLEAN DEFAULT false,
  usuario_acepto BOOLEAN DEFAULT true,  -- true=aceptó, false=rechazó, null=sin feedback
  motivo_anomalia TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_pesajes_historial_producto ON pesajes_historial(producto_id);
CREATE INDEX IF NOT EXISTS idx_pesajes_historial_created ON pesajes_historial(created_at DESC);

-- Tabla: estadísticas agregadas por producto
-- Se actualiza automáticamente con cada pesaje
CREATE TABLE IF NOT EXISTS productos_estadisticas_pesaje (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  peso_promedio DECIMAL(10,3) DEFAULT 0,
  peso_minimo DECIMAL(10,3),
  peso_maximo DECIMAL(10,3),
  desviacion_estandar DECIMAL(10,3) DEFAULT 0,
  total_pesajes INT DEFAULT 0,
  pesajes_aceptados INT DEFAULT 0,
  pesajes_rechazados INT DEFAULT 0,
  umbral_inferior DECIMAL(10,3),  -- promedio - 2*desviacion
  umbral_superior DECIMAL(10,3),  -- promedio + 2*desviacion
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_productos_estadisticas_producto ON productos_estadisticas_pesaje(producto_id);

-- Función: Actualizar estadísticas después de cada pesaje
CREATE OR REPLACE FUNCTION fn_actualizar_estadisticas_pesaje()
RETURNS TRIGGER AS $$
DECLARE
  v_promedio DECIMAL(10,3);
  v_desviacion DECIMAL(10,3);
  v_minimo DECIMAL(10,3);
  v_maximo DECIMAL(10,3);
  v_total INT;
  v_aceptados INT;
  v_rechazados INT;
BEGIN
  -- Calcular estadísticas de los últimos 100 pesajes del producto
  SELECT 
    AVG(peso_real),
    COALESCE(STDDEV_SAMP(peso_real), 0),
    MIN(peso_real),
    MAX(peso_real),
    COUNT(*),
    COUNT(*) FILTER (WHERE usuario_acepto = true),
    COUNT(*) FILTER (WHERE usuario_acepto = false)
  INTO v_promedio, v_desviacion, v_minimo, v_maximo, v_total, v_aceptados, v_rechazados
  FROM (
    SELECT peso_real, usuario_acepto
    FROM pesajes_historial
    WHERE producto_id = NEW.producto_id
    ORDER BY created_at DESC
    LIMIT 100
  ) ultimos;

  -- Insertar o actualizar estadísticas
  INSERT INTO productos_estadisticas_pesaje (
    producto_id, peso_promedio, peso_minimo, peso_maximo,
    desviacion_estandar, total_pesajes, pesajes_aceptados, pesajes_rechazados,
    umbral_inferior, umbral_superior, last_updated
  )
  VALUES (
    NEW.producto_id,
    v_promedio,
    v_minimo,
    v_maximo,
    v_desviacion,
    v_total,
    v_aceptados,
    v_rechazados,
    GREATEST(0, v_promedio - (2 * v_desviacion)),
    v_promedio + (2 * v_desviacion),
    now()
  )
  ON CONFLICT (producto_id) DO UPDATE SET
    peso_promedio = EXCLUDED.peso_promedio,
    peso_minimo = EXCLUDED.peso_minimo,
    peso_maximo = EXCLUDED.peso_maximo,
    desviacion_estandar = EXCLUDED.desviacion_estandar,
    total_pesajes = EXCLUDED.total_pesajes,
    pesajes_aceptados = EXCLUDED.pesajes_aceptados,
    pesajes_rechazados = EXCLUDED.pesajes_rechazados,
    umbral_inferior = EXCLUDED.umbral_inferior,
    umbral_superior = EXCLUDED.umbral_superior,
    last_updated = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Ejecutar después de cada insert en pesajes_historial
DROP TRIGGER IF EXISTS trg_actualizar_estadisticas_pesaje ON pesajes_historial;
CREATE TRIGGER trg_actualizar_estadisticas_pesaje
  AFTER INSERT ON pesajes_historial
  FOR EACH ROW
  EXECUTE FUNCTION fn_actualizar_estadisticas_pesaje();

-- RLS: Políticas de seguridad
ALTER TABLE pesajes_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_estadisticas_pesaje ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pesajes_historial_select_authenticated" ON pesajes_historial
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pesajes_historial_insert_authenticated" ON pesajes_historial
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "productos_estadisticas_select_authenticated" ON productos_estadisticas_pesaje
  FOR SELECT TO authenticated USING (true);

-- Comentarios para documentación
COMMENT ON TABLE pesajes_historial IS 'Historial de todos los pesajes para aprendizaje automático';
COMMENT ON TABLE productos_estadisticas_pesaje IS 'Estadísticas agregadas por producto calculadas automáticamente';
COMMENT ON COLUMN productos_estadisticas_pesaje.umbral_inferior IS 'Peso mínimo esperado (promedio - 2*desviación)';
COMMENT ON COLUMN productos_estadisticas_pesaje.umbral_superior IS 'Peso máximo esperado (promedio + 2*desviación)';
