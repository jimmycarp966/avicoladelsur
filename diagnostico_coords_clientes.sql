-- DIAGNÓSTICO RÁPIDO: Ver datos de entregas y clientes para la ruta activa

-- 1. Ver los datos raw que debería recibir el endpoint
SELECT 
  dr.id as detalle_ruta_id,
  dr.orden_entrega,
  p.id as pedido_id,
  p.cliente_id as pedido_cliente_id,
  c.id as cliente_id,
  c.nombre as cliente_nombre,
  ST_AsText(c.coordenadas) as coordenadas_wkt,
  ST_AsGeoJSON(c.coordenadas)::jsonb as coordenadas_geojson
FROM detalles_ruta dr
JOIN rutas_reparto r ON dr.ruta_id = r.id
LEFT JOIN pedidos p ON dr.pedido_id = p.id
LEFT JOIN clientes c ON p.cliente_id = c.id
WHERE r.estado IN ('planificada', 'en_curso')
ORDER BY r.fecha_ruta DESC, dr.orden_entrega
LIMIT 10;

-- 2. Ver las entregas para esos pedidos agrupados
SELECT 
  e.id as entrega_id,
  e.pedido_id,
  e.cliente_id as entrega_cliente_id,
  c.nombre as cliente_nombre,
  ST_AsText(c.coordenadas) as coordenadas_wkt,
  ST_AsGeoJSON(c.coordenadas)::jsonb as coordenadas_geojson
FROM entregas e
LEFT JOIN clientes c ON e.cliente_id = c.id
WHERE e.pedido_id IN (
  SELECT p.id FROM pedidos p
  JOIN detalles_ruta dr ON dr.pedido_id = p.id
  JOIN rutas_reparto r ON dr.ruta_id = r.id
  WHERE r.estado IN ('planificada', 'en_curso')
)
ORDER BY e.pedido_id, e.orden_entrega
LIMIT 20;
