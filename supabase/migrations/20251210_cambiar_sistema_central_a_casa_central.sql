-- Cambiar "Sistema Central" por "Casa Central"
-- Fecha: 2025-12-10
-- Descripción: Actualizar el nombre del punto central de administración

-- Actualizar el nombre de Sistema Central a Casa Central
UPDATE sucursales SET
    nombre = 'Casa Central'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND nombre = 'Sistema Central';

-- Verificar el cambio
SELECT id, nombre, direccion, telefono, active
FROM sucursales
WHERE id = '00000000-0000-0000-0000-000000000001';
