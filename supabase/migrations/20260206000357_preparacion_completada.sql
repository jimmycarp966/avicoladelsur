-- Agregar columnas para tracking de preparación en cámara frigorífica
ALTER TABLE presupuestos
ADD COLUMN IF NOT EXISTS preparacion_completada BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preparacion_completada_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS preparado_por UUID REFERENCES auth.users(id);

-- Comentario en las columnas
COMMENT ON COLUMN presupuestos.preparacion_completada IS 'Indica si los productos ya fueron preparados en cámara frigorífica y están listos para pesaje';
COMMENT ON COLUMN presupuestos.preparacion_completada_at IS 'Timestamp de cuando se marcó como completada la preparación';
COMMENT ON COLUMN presupuestos.preparado_por IS 'Usuario que marcó la preparación como completada';

-- Índice para filtrar rápidamente presupuestos pendientes de preparación
CREATE INDEX IF NOT EXISTS idx_presupuestos_preparacion
ON presupuestos(estado, preparacion_completada)
WHERE preparacion_completada = FALSE;;
