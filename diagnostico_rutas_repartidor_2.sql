-- DIAGNÓSTICO PARTE 2: Verificar rutas activas y sus repartidores

-- 1. Ver las rutas activas con información del repartidor
SELECT 
  r.id as ruta_id,
  r.numero_ruta,
  r.fecha_ruta,
  r.estado,
  r.turno,
  r.repartidor_id,
  u.nombre as repartidor_nombre,
  u.apellido as repartidor_apellido,
  u.email as repartidor_email
FROM rutas_reparto r
LEFT JOIN usuarios u ON r.repartidor_id = u.id
WHERE r.estado IN ('planificada', 'en_curso')
ORDER BY r.fecha_ruta DESC;

-- 2. Verificar las entregas de los pedidos agrupados (donde cliente_id en pedidos es null)
SELECT 
  e.id as entrega_id,
  e.pedido_id,
  e.cliente_id as entrega_cliente_id,
  c.nombre as cliente_nombre,
  c.direccion,
  e.estado_entrega,
  e.orden_entrega,
  e.total
FROM entregas e
LEFT JOIN clientes c ON e.cliente_id = c.id
WHERE e.pedido_id IN (
  SELECT p.id FROM pedidos p
  JOIN detalles_ruta dr ON dr.pedido_id = p.id
  JOIN rutas_reparto r ON dr.ruta_id = r.id
  WHERE r.estado IN ('planificada', 'en_curso')
)
ORDER BY e.pedido_id, e.orden_entrega;

-- 3. Ver el usuario actual autenticado (para comparar con repartidor_id)
-- NOTA: Este es solo para referencia, necesitas saber cuál es el ID del usuario que está logueado como repartidor
SELECT 
  id, 
  nombre, 
  apellido, 
  email, 
  rol 
FROM usuarios 
WHERE rol = 'repartidor';
