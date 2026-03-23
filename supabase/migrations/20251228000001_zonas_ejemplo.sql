-- ===========================================
-- MIGRACIÓN: ZONAS DE EJEMPLO
-- Fecha: 2025-12-28
-- Descripción: Agrega zonas de entrega de ejemplo para el selector
-- ===========================================

-- ===========================================
-- INSERTAR ZONAS DE EJEMPLO
-- ===========================================

INSERT INTO zonas (nombre, descripcion, activo) VALUES
('Monteros Centro', 'Zona céntrica de Monteros', true),
('Monteros Norte', 'Zona norte de Monteros', true),
('Monteros Sur', 'Zona sur de Monteros', true),
('Famaillá', 'Localidad de Famaillá', true),
('Simoca', 'Localidad de Simoca', true),
('Concepción', 'Localidad de Concepción', true),
('Alderetes', 'Localidad de Alderetes', true),
('Bella Vista', 'Localidad de Bella Vista', true),
('Ruta 38', 'Zona rural ruta 38', true)
ON CONFLICT (nombre) DO NOTHING;

-- ===========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ===========================================

COMMENT ON TABLE zonas IS 'Zonas de entrega geográficas para organizar las rutas de reparto';
COMMENT ON COLUMN zonas.nombre IS 'Nombre único de la zona de entrega';
COMMENT ON COLUMN zonas.descripcion IS 'Descripción opcional de la zona';
COMMENT ON COLUMN zonas.activo IS 'Indica si la zona está activa para asignaciones';
