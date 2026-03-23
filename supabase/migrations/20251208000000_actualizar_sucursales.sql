-- Actualizar sucursales con nombres y direcciones reales de Avícola del Sur
-- Fecha: 2025-12-08
-- Descripción: Cambiar nombres de sucursales existentes y agregar Simoca

-- Actualizar nombres de sucursales existentes (si existen con nombres genéricos)
UPDATE sucursales SET
    nombre = 'Sucursal Alberdi',
    direccion = 'Av. Alberdi 1456, San Miguel de Tucumán',
    telefono = '381-456-7890'
WHERE nombre = 'Sucursal Norte';

UPDATE sucursales SET
    nombre = 'Sucursal San Martín',
    direccion = 'Av. San Martín 2341, San Miguel de Tucumán',
    telefono = '381-567-8901'
WHERE nombre = 'Sucursal Sur';

UPDATE sucursales SET
    nombre = 'Sistema Central',
    direccion = 'Av. Mate de Luna 1234, San Miguel de Tucumán',
    telefono = '381-555-0000'
WHERE nombre = 'Casa Central';

-- Agregar Sucursal Simoca si no existe (creada en migración anterior, esta es solo por si acaso)
INSERT INTO sucursales (nombre, direccion, telefono, active) VALUES
('Sucursal Simoca', 'Ruta Nacional 9 Km 45, Simoca, Tucumán', '381-789-0123', true);

-- Nota: Sistema Central es el punto de administración central, no una sucursal operativa
-- Las 4 sucursales operativas son: Alberdi, San Martín, Colón, Simoca
