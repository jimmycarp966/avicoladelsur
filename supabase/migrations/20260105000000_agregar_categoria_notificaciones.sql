-- Agregar campo categoria a tabla notificaciones
-- Este campo es usado por la UI para filtrar y mostrar categorías de notificaciones

ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);

-- Crear índice para optimizar filtros por categoría
CREATE INDEX IF NOT EXISTS idx_notificaciones_categoria ON notificaciones(categoria) WHERE categoria IS NOT NULL;

-- Comentario
COMMENT ON COLUMN notificaciones.categoria IS 'Categoría de la notificación para filtrado (ej: stock, ventas, reparto, tesoreria)';
    