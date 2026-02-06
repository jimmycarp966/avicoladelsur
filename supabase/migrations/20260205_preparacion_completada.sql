-- ===========================================
-- PREPARACIÓN COMPLETADA EN CÁMARA FRIGORÍFICA
-- Fecha: 2025-02-05
-- ===========================================

-- Agregar columnas para tracking de preparación en cámara frigorífica
-- Estas columnas permiten marcar un presupuesto como "listo para pesaje"
-- sin cambiar el estado, manteniéndolo visible en "Presupuestos del Día"

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
WHERE preparacion_completada = FALSE;

-- Política RLS para permitir a almacenistas y admin marcar preparación
CREATE POLICY IF NOT EXISTS "Permitir a almacenistas marcar preparacion_completada"
ON presupuestos
FOR UPDATE
TO authenticated
USING (
    -- Solo admin o almacenista pueden marcar preparación
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('admin', 'almacenista')
    )
)
WITH CHECK (
    -- Solo pueden modificar estos campos específicos
    auth.uid() = ANY (
        SELECT id FROM usuarios
        WHERE rol IN ('admin', 'almacenista')
    )
);
