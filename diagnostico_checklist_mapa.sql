-- ===========================================
-- DIAGNÓSTICO: Problemas con Checklist y Mapa del Repartidor
-- Ejecutar en Supabase SQL Editor
-- ===========================================

-- 1. Verificar políticas RLS en checklists_vehiculos
SELECT 
  policyname,
  cmd,
  qual::text as condicion
FROM pg_policies
WHERE tablename = 'checklists_vehiculos'
ORDER BY policyname;

-- 2. Verificar si el repartidor puede insertar en checklists_vehiculos
-- (Simular la consulta que haría el repartidor)
SELECT 
  id,
  vehiculo_id,
  usuario_id,
  created_at
FROM checklists_vehiculos
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar columnas de la tabla checklists_vehiculos
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'checklists_vehiculos'
ORDER BY ordinal_position;

-- 4. Verificar que las entregas tienen cliente_id y coordenadas
SELECT 
  e.id as entrega_id,
  e.pedido_id,
  e.cliente_id,
  c.nombre as cliente_nombre,
  c.direccion,
  ST_AsText(c.coordenadas) as coordenadas_wkt,
  e.coordenadas as entrega_coords
FROM entregas e
LEFT JOIN clientes c ON e.cliente_id = c.id
WHERE e.pedido_id IN (
  SELECT p.id FROM pedidos p
  JOIN detalles_ruta dr ON dr.pedido_id = p.id
  JOIN rutas_reparto r ON dr.ruta_id = r.id
  WHERE r.estado IN ('planificada', 'en_curso')
)
LIMIT 20;

-- 5. Verificar permisos del repartidor en tabla checklists_vehiculos
-- Buscar si hay política para rol repartidor
SELECT 
  polname as policy_name,
  polcmd as command,
  rolname as role,
  pg_get_expr(polqual, polrelid) as using_expression,
  pg_get_expr(polwithcheck, polrelid) as with_check
FROM pg_policy
JOIN pg_class ON pg_policy.polrelid = pg_class.oid
JOIN pg_roles ON pg_roles.oid = ANY(pg_policy.polroles)
WHERE pg_class.relname = 'checklists_vehiculos';

-- 6. Verificar que rutas_planificadas tiene polyline y orden_visita
SELECT 
  rp.id,
  rp.ruta_reparto_id,
  rp.polyline IS NOT NULL as tiene_polyline,
  rp.orden_visita IS NOT NULL as tiene_orden_visita,
  jsonb_array_length(rp.orden_visita) as cantidad_entregas
FROM rutas_planificadas rp
JOIN rutas_reparto r ON r.id = rp.ruta_reparto_id
WHERE r.estado IN ('planificada', 'en_curso')
LIMIT 10;
