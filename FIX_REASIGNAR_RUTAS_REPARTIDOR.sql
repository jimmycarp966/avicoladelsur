-- ===========================================
-- FIX: Reasignar rutas del repartidor mock a Carlos García
-- Y limpiar el usuario mock
-- ===========================================

BEGIN;

-- 1. Primero verificar qué rutas están asignadas al repartidor mock
SELECT 
  r.id as ruta_id,
  r.numero_ruta,
  r.estado,
  r.repartidor_id,
  'MOCK (a reasignar)' as tipo
FROM rutas_reparto r
WHERE r.repartidor_id = 'f6abf55a-ba12-4ebd-91ea-cc9bae48fc68'; -- ID del mock

-- 2. Reasignar TODAS las rutas del mock a Carlos García
UPDATE rutas_reparto
SET 
  repartidor_id = '5cf1ee10-c98e-474f-bc72-b684c9ccc366', -- Carlos García
  updated_at = NOW()
WHERE repartidor_id = 'f6abf55a-ba12-4ebd-91ea-cc9bae48fc68'; -- Mock

-- 3. Verificar que se reasignaron
SELECT 
  r.id as ruta_id,
  r.numero_ruta,
  r.estado,
  r.repartidor_id,
  u.nombre as repartidor_nombre
FROM rutas_reparto r
LEFT JOIN usuarios u ON r.repartidor_id = u.id
WHERE r.estado IN ('planificada', 'en_curso');

-- 4. Limpiar ubicaciones del repartidor mock (si hay)
DELETE FROM ubicaciones_repartidores
WHERE repartidor_id = 'f6abf55a-ba12-4ebd-91ea-cc9bae48fc68';

-- 5. Eliminar el usuario mock
-- NOTA: Primero hay que eliminar de auth.users (si existe ahí también)
-- OJO: Si el mock está en auth.users, descomentar la siguiente línea y ejecutar como service_role:
-- DELETE FROM auth.users WHERE id = 'f6abf55a-ba12-4ebd-91ea-cc9bae48fc68';

-- Eliminar de la tabla usuarios (public)
DELETE FROM usuarios
WHERE id = 'f6abf55a-ba12-4ebd-91ea-cc9bae48fc68';

COMMIT;

-- 6. Verificación final - Mostrar rutas activas asignadas a Carlos García
SELECT 
  r.id as ruta_id,
  r.numero_ruta,
  r.fecha_ruta,
  r.estado,
  r.turno,
  r.repartidor_id,
  u.nombre as repartidor_nombre,
  u.apellido as repartidor_apellido,
  (SELECT COUNT(*) FROM detalles_ruta dr WHERE dr.ruta_id = r.id) as total_entregas
FROM rutas_reparto r
LEFT JOIN usuarios u ON r.repartidor_id = u.id
WHERE r.estado IN ('planificada', 'en_curso')
  AND r.repartidor_id = '5cf1ee10-c98e-474f-bc72-b684c9ccc366'
ORDER BY r.fecha_ruta DESC;
