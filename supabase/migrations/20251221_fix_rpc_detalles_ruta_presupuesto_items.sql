-- ===========================================
-- MIGRACIÓN: Actualizar fn_get_detalles_ruta_completos
-- Fecha: 21/12/2025
-- Descripción: Corrige visualización de pedidos agrupados:
--   1. Obtiene productos de presupuesto_items (no detalles_pedido)
--   2. Incluye estado_pago completo (incluyendo cuenta_corriente, parcial)
--   3. Agrega entrega_id y presupuesto_id al resultado
-- ===========================================

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
    -- Para pedidos con cliente_id (pedidos simples/individuales)
    SELECT 
      dr.id,
      NULL::uuid as entrega_id,
      dr.orden_entrega,
      dr.estado_entrega,
      dr.fecha_hora_entrega,
      dr.pago_registrado,
      dr.monto_cobrado_registrado,
      dr.metodo_pago_registrado,
      'pagado' as estado_pago, -- Pedidos simples usan pago_registrado
      dr.notas_pago,
      dr.pedido_id,
      NULL::uuid as presupuesto_id,
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
    -- IMPORTANTE: Obtener productos de presupuesto_items en lugar de detalles_pedido
    SELECT 
      dr.id, -- ID del detalle_ruta (padre)
      e.id as entrega_id, -- ID de la entrega individual
      dr.orden_entrega,
      COALESCE(e.estado_entrega, dr.estado_entrega) as estado_entrega,
      dr.fecha_hora_entrega,
      -- pago_registrado: ahora incluye cuenta_corriente y parcial
      CASE 
        WHEN e.estado_pago IN ('pagado', 'cuenta_corriente', 'parcial') THEN true
        ELSE COALESCE(dr.pago_registrado, false)
      END as pago_registrado,
      COALESCE(e.monto_cobrado, dr.monto_cobrado_registrado, 0) as monto_cobrado_registrado,
      COALESCE(e.metodo_pago, dr.metodo_pago_registrado) as metodo_pago_registrado,
      COALESCE(e.estado_pago, 'pendiente') as estado_pago,
      COALESCE(e.notas_pago, dr.notas_pago) as notas_pago,
      dr.pedido_id,
      e.presupuesto_id,
      e.orden_entrega as entrega_orden,
      jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        -- Usar total del presupuesto, no del pedido agrupado
        'total', COALESCE(pres.total_final, e.total, p.total),
        'turno', p.turno,
        'pago_estado', CASE 
          WHEN e.estado_pago IN ('pagado', 'cuenta_corriente', 'parcial') THEN e.estado_pago 
          ELSE p.pago_estado 
        END,
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
        -- CAMBIO IMPORTANTE: Obtener productos de presupuesto_items, no de detalles_pedido
        'detalle_pedido', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', pi.id,
              'cantidad', COALESCE(pi.peso_final, pi.cantidad_solicitada),
              'precio_unitario', COALESCE(pi.precio_unit_final, pi.precio_unit_est),
              'subtotal', COALESCE(pi.subtotal_final, pi.subtotal_est),
              'producto', jsonb_build_object(
                'id', prod.id,
                'nombre', prod.nombre,
                'codigo', prod.codigo,
                'unidad_medida', prod.unidad_medida
              )
            )
          )
          FROM presupuesto_items pi
          LEFT JOIN productos prod ON prod.id = pi.producto_id
          WHERE pi.presupuesto_id = e.presupuesto_id
        )
      ) as pedido
    FROM detalles_ruta dr
    LEFT JOIN pedidos p ON p.id = dr.pedido_id
    LEFT JOIN entregas e ON e.pedido_id = p.id
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN presupuestos pres ON pres.id = e.presupuesto_id
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
Expande automáticamente pedidos agrupados a entregas individuales.
v2: Ahora obtiene productos de presupuesto_items para pedidos agrupados 
    e incluye estado_pago completo (cuenta_corriente, parcial).';
