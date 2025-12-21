-- ========================================================================
-- RPC Batch: Obtener detalles de ruta completos con clientes y coordenadas
-- Optimiza queries N+1 reduciendo ~20 queries a 1
-- ========================================================================

CREATE OR REPLACE FUNCTION fn_get_detalles_ruta_completos(p_ruta_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(detalle ORDER BY COALESCE(entrega_orden, detalle.orden_entrega))
  INTO v_result
  FROM (
    -- Para pedidos con cliente_id (pedidos simples)
    SELECT 
      dr.id,
      dr.orden_entrega,
      dr.estado_entrega,
      dr.fecha_hora_entrega,
      dr.pago_registrado,
      dr.monto_cobrado_registrado,
      dr.metodo_pago_registrado,
      dr.notas_pago,
      dr.pedido_id,
      NULL::int as entrega_orden,
      jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        'total', p.total,
        'turno', p.turno,
        'pago_estado', p.pago_estado,
        'metodos_pago', p.metodos_pago,
        'instrucciones_repartidor', p.observaciones,
        'cliente', jsonb_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'telefono', c.telefono,
          'direccion', c.direccion,
          'zona_entrega', c.zona_entrega,
          'coordenadas', CASE 
            WHEN c.coordenadas IS NOT NULL THEN 
              jsonb_build_object(
                'lat', ST_Y(c.coordenadas::geometry),
                'lng', ST_X(c.coordenadas::geometry)
              )
            ELSE NULL
          END
        ),
        'detalle_pedido', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', dp.id,
              'cantidad', dp.cantidad,
              'producto', jsonb_build_object(
                'id', prod.id,
                'nombre', prod.nombre,
                'codigo', prod.codigo,
                'unidad_medida', prod.unidad_medida
              )
            )
          )
          FROM detalles_pedido dp
          LEFT JOIN productos prod ON prod.id = dp.producto_id
          WHERE dp.pedido_id = p.id
        )
      ) as pedido
    FROM detalles_ruta dr
    LEFT JOIN pedidos p ON p.id = dr.pedido_id
    LEFT JOIN clientes c ON c.id = p.cliente_id
    WHERE dr.ruta_id = p_ruta_id
      AND p.cliente_id IS NOT NULL

    UNION ALL

    -- Para pedidos agrupados (sin cliente_id), expandir entregas individuales
    SELECT 
      e.id, -- Usar ID de la entrega
      dr.orden_entrega,
      COALESCE(e.estado_entrega, dr.estado_entrega) as estado_entrega,
      dr.fecha_hora_entrega,
      COALESCE(e.estado_pago = 'pagado', dr.pago_registrado) as pago_registrado,
      COALESCE(e.monto_cobrado, dr.monto_cobrado_registrado) as monto_cobrado_registrado,
      dr.metodo_pago_registrado,
      dr.notas_pago,
      dr.pedido_id,
      e.orden_entrega as entrega_orden,
      jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        'total', COALESCE(e.total, p.total),
        'turno', p.turno,
        'pago_estado', CASE WHEN e.estado_pago = 'pagado' THEN 'pagado' ELSE p.pago_estado END,
        'metodos_pago', p.metodos_pago,
        'instrucciones_repartidor', p.observaciones,
        'cliente', jsonb_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'telefono', c.telefono,
          'direccion', COALESCE(e.direccion, c.direccion),
          'zona_entrega', c.zona_entrega,
          'coordenadas', CASE 
            WHEN e.coordenadas IS NOT NULL THEN
              -- e.coordenadas es de tipo geometry (PostGIS), usar ST_Y/ST_X
              jsonb_build_object(
                'lat', ST_Y(e.coordenadas::geometry),
                'lng', ST_X(e.coordenadas::geometry)
              )
            WHEN c.coordenadas IS NOT NULL THEN 
              jsonb_build_object(
                'lat', ST_Y(c.coordenadas::geometry),
                'lng', ST_X(c.coordenadas::geometry)
              )
            ELSE NULL
          END
        ),
        'detalle_pedido', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', dp.id,
              'cantidad', dp.cantidad,
              'producto', jsonb_build_object(
                'id', prod.id,
                'nombre', prod.nombre,
                'codigo', prod.codigo,
                'unidad_medida', prod.unidad_medida
              )
            )
          )
          FROM detalles_pedido dp
          LEFT JOIN productos prod ON prod.id = dp.producto_id
          WHERE dp.pedido_id = p.id
        )
      ) as pedido
    FROM detalles_ruta dr
    LEFT JOIN pedidos p ON p.id = dr.pedido_id
    LEFT JOIN entregas e ON e.pedido_id = p.id
    LEFT JOIN clientes c ON c.id = e.cliente_id
    WHERE dr.ruta_id = p_ruta_id
      AND p.cliente_id IS NULL
      AND e.id IS NOT NULL
  ) detalle;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION fn_get_detalles_ruta_completos(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_detalles_ruta_completos(UUID) TO service_role;

COMMENT ON FUNCTION fn_get_detalles_ruta_completos IS 
'Obtiene todos los detalles de ruta con clientes y coordenadas en una sola query.
Optimiza el problema N+1 en la página de hoja de ruta del repartidor.
Expande automáticamente pedidos agrupados a entregas individuales.';
