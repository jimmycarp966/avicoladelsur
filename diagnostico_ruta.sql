SELECT
  r.numero_ruta,
  dr.id as detalle_id,
  dr.orden_entrega,
  p.id as pedido_id,
  p.numero_pedido,
  p.cliente_id as pedido_cliente_id,
  p.total as pedido_total,
  e.id as entrega_id,
  e.cliente_id as entrega_cliente_id,
  c.nombre as nombre_cliente_entrega,
  e.total as entrega_total,
  e.direccion as entrega_direccion,
  e.estado_entrega
FROM rutas_reparto r
JOIN detalles_ruta dr ON dr.ruta_id = r.id
JOIN pedidos p ON dr.pedido_id = p.id
LEFT JOIN entregas e ON e.pedido_id = p.id
LEFT JOIN clientes c ON e.cliente_id = c.id
WHERE r.numero_ruta = 'RUT-000000029';
