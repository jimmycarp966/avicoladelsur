-- ===========================================
-- CREAR CATEGORÍAS DE EMPLEADOS
-- Fecha: 2025-11-26
-- ===========================================
-- Crea las categorías basadas en los puestos únicos de la lista de empleados

-- Insertar categorías si no existen
INSERT INTO rrhh_categorias (nombre, descripcion, sueldo_basico, adicional_cajero, adicional_produccion, activo)
SELECT * FROM (VALUES
    ('Repartidor', 'Personal de reparto y entregas', 700000.00, 0, 0, true),
    ('Tesoreria', 'Personal de tesorería y finanzas', 700000.00, 0, 0, true),
    ('Almacen', 'Personal de almacén y logística', 650000.00, 0, 0, true),
    ('Asistente Sucursal', 'Asistente de sucursal', 620000.00, 0, 0, true),
    ('Encargado Sucursal', 'Encargado de sucursal', 650000.00, 0, 0, true),
    ('Produccion', 'Personal de producción', 600000.00, 0, 0, true),
    ('Ventas', 'Personal de ventas', 650000.00, 0, 0, true),
    ('RRHH', 'Personal de recursos humanos', 900000.00, 0, 0, true),
    ('Limpieza', 'Personal de limpieza', 550000.00, 0, 0, true),
    ('Asist. 1/2 día Sucursal', 'Asistente de sucursal medio día', 310000.00, 0, 0, true)
) AS v(nombre, descripcion, sueldo_basico, adicional_cajero, adicional_produccion, activo)
WHERE NOT EXISTS (
    SELECT 1 FROM rrhh_categorias WHERE rrhh_categorias.nombre = v.nombre
);

-- Nota: Se usa WHERE NOT EXISTS para evitar duplicados si las categorías ya existen

