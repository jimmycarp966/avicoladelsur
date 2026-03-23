-- Corrección de sucursales duplicadas y faltantes
-- Fecha: 2025-12-09
-- Descripción: Limpiar duplicados y agregar sucursales faltantes

-- 1. Actualizar empleados que referencian el Sistema Central duplicado
-- Cambiar todas las referencias del ID duplicado al ID especial
UPDATE rrhh_empleados
SET sucursal_id = '00000000-0000-0000-0000-000000000001'
WHERE sucursal_id = '6eee5c7b-c124-4ca3-9429-da801781b02e';

-- 2. Ahora sí podemos eliminar el registro duplicado de Sistema Central
DELETE FROM sucursales
WHERE nombre = 'Sistema Central'
  AND id = '6eee5c7b-c124-4ca3-9429-da801781b02e';

-- 3. Agregar Sucursal Colón si no existe
INSERT INTO sucursales (nombre, direccion, telefono, active) VALUES
('Sucursal Colón', 'Av. Colón 3456, San Miguel de Tucumán', '381-678-9012', true);

-- 4. Verificar estado final
SELECT id, nombre, direccion, telefono, active
FROM sucursales
ORDER BY nombre;
