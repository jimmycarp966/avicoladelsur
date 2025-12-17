-- DIAGNÓSTICO: Rutas para Repartidor
-- Ejecuta este script en Supabase SQL Editor para verificar el estado de las rutas

-- 1. Ver todas las rutas de hoy
SELECT 
  r.id,
  r.numero_ruta,
  r.fecha_ruta,
  r.estado,
  r.turno,
  r.repartidor_id,
  u.nombre as repartidor_nombre,
  u.apellido as repartidor_apellido,
  v.patente as vehiculo_patente,
  (SELECT COUNT(*) FROM detalles_ruta dr WHERE dr.ruta_id = r.id) as total_detalles
FROM rutas_reparto r
LEFT JOIN usuarios u ON r.repartidor_id = u.id
LEFT JOIN vehiculos v ON r.vehiculo_id = v.id
WHERE r.fecha_ruta >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY r.fecha_ruta DESC, r.created_at DESC
LIMIT 20;

-- 2. Ver usuarios con rol repartidor
SELECT 
  id,
  nombre,
  apellido,
  email,
  rol
FROM usuarios
WHERE rol = 'repartidor'
ORDER BY nombre;

-- 3. Ver rutas activas (planificada o en_curso)
SELECT 
  r.id,
  r.numero_ruta,
  r.fecha_ruta,
  r.estado,
  r.repartidor_id,
  u.nombre || ' ' || COALESCE(u.apellido, '') as repartidor_nombre,
  (SELECT COUNT(*) FROM detalles_ruta dr WHERE dr.ruta_id = r.id) as total_entregas
FROM rutas_reparto r
LEFT JOIN usuarios u ON r.repartidor_id = u.id
WHERE r.estado IN ('planificada', 'en_curso')
ORDER BY r.fecha_ruta DESC;

-- 4. Ver detalles de ruta con pedidos
SELECT 
  dr.id as detalle_id,
  dr.ruta_id,
  dr.orden_entrega,
  dr.estado_entrega,
  p.numero_pedido,
  p.cliente_id,
  c.nombre as cliente_nombre
FROM detalles_ruta dr
JOIN rutas_reparto r ON dr.ruta_id = r.id
LEFT JOIN pedidos p ON dr.pedido_id = p.id
LEFT JOIN clientes c ON p.cliente_id = c.id
WHERE r.estado IN ('planificada', 'en_curso')
ORDER BY r.fecha_ruta DESC, dr.orden_entrega
LIMIT 50;

-- 5. Verificar políticas RLS activas en rutas_reparto
SELECT 
  policyname,
  cmd,
  qual::text
FROM pg_policies
WHERE tablename = 'rutas_reparto'
ORDER BY policyname;
