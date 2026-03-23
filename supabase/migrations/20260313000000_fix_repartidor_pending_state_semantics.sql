BEGIN;

ALTER TABLE public.entregas
  DROP CONSTRAINT IF EXISTS entregas_estado_pago_check;

ALTER TABLE public.entregas
  ADD CONSTRAINT entregas_estado_pago_check
  CHECK (
    (estado_pago)::text = ANY (
      ARRAY[
        'pendiente'::character varying,
        'pagado'::character varying,
        'pagara_despues'::character varying,
        'rechazado'::character varying,
        'cuenta_corriente'::character varying,
        'parcial'::character varying,
        'fiado'::character varying,
        'pago_parcial'::character varying
      ]::text[]
    )
  );

UPDATE public.entregas
SET
  estado_pago = NULL,
  updated_at = now()
WHERE estado_pago = 'pendiente'
  AND COALESCE(monto_cobrado, 0) = 0
  AND NULLIF(metodo_pago, '') IS NULL
  AND COALESCE(lower(notas_pago), '') NOT LIKE '%pagara%';

CREATE OR REPLACE FUNCTION public.fn_recalcular_detalle_ruta_agrupado(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_detalle_id uuid;
  v_total_entregas integer;
  v_terminales integer;
  v_rechazadas integer;
  v_en_camino integer;
  v_pagos_definidos integer;
  v_monto_cobrado numeric;
  v_estado_agregado varchar;
  v_metodo_pago varchar;
  v_notas_pago text;
  v_numero_transaccion varchar;
  v_comprobante_url varchar;
  v_comprobante_storage_path text;
  v_fecha_hora_entrega timestamptz;
  v_motivo_rechazo text;
BEGIN
  SELECT dr.id
  INTO v_detalle_id
  FROM public.detalles_ruta dr
  WHERE dr.pedido_id = p_pedido_id
  ORDER BY dr.created_at ASC
  LIMIT 1;

  IF v_detalle_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontro detalle_ruta para el pedido agrupado'
    );
  END IF;

  WITH entregas_normalizadas AS (
    SELECT
      e.*,
      CASE
        WHEN e.estado_entrega IN ('fallido', 'cancelado') THEN 'rechazado'
        WHEN e.estado_entrega IS NULL THEN 'pendiente'
        ELSE e.estado_entrega
      END AS estado_entrega_norm,
      CASE
        WHEN e.estado_entrega IN ('rechazado', 'fallido', 'cancelado') THEN 'rechazado'
        WHEN e.estado_pago = 'pago_parcial' THEN 'parcial'
        WHEN e.estado_pago = 'fiado' THEN 'cuenta_corriente'
        WHEN e.estado_pago IN ('pagado', 'parcial', 'cuenta_corriente', 'rechazado', 'pagara_despues') THEN e.estado_pago
        WHEN e.estado_pago = 'pendiente' AND NULLIF(e.metodo_pago, '') IS NOT NULL THEN 'pendiente'
        WHEN e.metodo_pago = 'cuenta_corriente' THEN 'cuenta_corriente'
        WHEN COALESCE(e.monto_cobrado, 0) > 0 AND COALESCE(e.total, 0) > COALESCE(e.monto_cobrado, 0) THEN 'parcial'
        WHEN COALESCE(e.monto_cobrado, 0) > 0 THEN 'pagado'
        WHEN NULLIF(e.metodo_pago, '') IS NOT NULL THEN 'pendiente'
        WHEN COALESCE(lower(e.notas_pago), '') LIKE '%pagara despues%' THEN 'pagara_despues'
        WHEN COALESCE(lower(e.notas_pago), '') LIKE '%pagara%' THEN 'pagara_despues'
        ELSE NULL
      END AS estado_pago_norm
    FROM public.entregas e
    WHERE e.pedido_id = p_pedido_id
  ),
  resumen AS (
    SELECT
      COUNT(*) AS total_entregas,
      COUNT(*) FILTER (WHERE estado_entrega_norm IN ('entregado', 'rechazado')) AS terminales,
      COUNT(*) FILTER (WHERE estado_entrega_norm = 'rechazado') AS rechazadas,
      COUNT(*) FILTER (WHERE estado_entrega_norm = 'en_camino') AS en_camino,
      COUNT(*) FILTER (WHERE estado_pago_norm IS NOT NULL) AS pagos_definidos,
      COALESCE(SUM(COALESCE(monto_cobrado, 0)), 0) AS monto_cobrado,
      MAX(fecha_hora_entrega) FILTER (WHERE estado_entrega_norm IN ('entregado', 'rechazado')) AS fecha_hora_entrega,
      CASE
        WHEN COUNT(DISTINCT NULLIF(metodo_pago, '')) = 1 THEN MAX(NULLIF(metodo_pago, ''))
        WHEN COUNT(DISTINCT NULLIF(metodo_pago, '')) > 1 THEN 'multiple'
        ELSE NULL
      END AS metodo_pago,
      CASE
        WHEN COUNT(DISTINCT NULLIF(numero_transaccion, '')) = 1 THEN MAX(NULLIF(numero_transaccion, ''))
        ELSE NULL
      END AS numero_transaccion,
      CASE
        WHEN COUNT(DISTINCT NULLIF(comprobante_url, '')) = 1 THEN MAX(NULLIF(comprobante_url, ''))
        ELSE NULL
      END AS comprobante_url,
      CASE
        WHEN COUNT(DISTINCT NULLIF(comprobante_storage_path, '')) = 1 THEN MAX(NULLIF(comprobante_storage_path, ''))
        ELSE NULL
      END AS comprobante_storage_path,
      STRING_AGG(DISTINCT NULLIF(notas_pago, ''), ' | ') FILTER (WHERE NULLIF(notas_pago, '') IS NOT NULL) AS notas_pago,
      STRING_AGG(DISTINCT NULLIF(motivo_rechazo, ''), ' | ') FILTER (WHERE NULLIF(motivo_rechazo, '') IS NOT NULL) AS motivo_rechazo
    FROM entregas_normalizadas
  )
  SELECT
    total_entregas,
    terminales,
    rechazadas,
    en_camino,
    pagos_definidos,
    monto_cobrado,
    metodo_pago,
    notas_pago,
    numero_transaccion,
    comprobante_url,
    comprobante_storage_path,
    fecha_hora_entrega,
    motivo_rechazo
  INTO
    v_total_entregas,
    v_terminales,
    v_rechazadas,
    v_en_camino,
    v_pagos_definidos,
    v_monto_cobrado,
    v_metodo_pago,
    v_notas_pago,
    v_numero_transaccion,
    v_comprobante_url,
    v_comprobante_storage_path,
    v_fecha_hora_entrega,
    v_motivo_rechazo
  FROM resumen;

  IF COALESCE(v_total_entregas, 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El pedido no tiene entregas hijas para recalcular'
    );
  END IF;

  v_estado_agregado := CASE
    WHEN v_terminales = v_total_entregas AND v_rechazadas = v_total_entregas THEN 'rechazado'
    WHEN v_terminales = v_total_entregas THEN 'entregado'
    WHEN COALESCE(v_en_camino, 0) > 0 THEN 'en_camino'
    ELSE 'pendiente'
  END;

  UPDATE public.detalles_ruta
  SET
    estado_entrega = v_estado_agregado,
    fecha_hora_entrega = CASE
      WHEN v_terminales = v_total_entregas THEN v_fecha_hora_entrega
      ELSE NULL
    END,
    pago_registrado = (v_pagos_definidos = v_total_entregas),
    monto_cobrado_registrado = COALESCE(v_monto_cobrado, 0),
    metodo_pago_registrado = v_metodo_pago,
    numero_transaccion_registrado = v_numero_transaccion,
    comprobante_url_registrado = v_comprobante_url,
    comprobante_storage_path = v_comprobante_storage_path,
    notas_pago = v_notas_pago,
    motivo_rechazo = v_motivo_rechazo,
    updated_at = now()
  WHERE id = v_detalle_id;

  RETURN jsonb_build_object(
    'success', true,
    'detalle_ruta_id', v_detalle_id,
    'estado_entrega_padre', v_estado_agregado,
    'pagos_definidos', v_pagos_definidos,
    'total_entregas', v_total_entregas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_detalles_ruta_completos(p_ruta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH detalles AS (
    SELECT
      dr.id,
      dr.id AS detalle_ruta_id,
      NULL::uuid AS detalle_ruta_id_padre,
      false AS es_pedido_agrupado,
      NULL::uuid AS entrega_id,
      dr.orden_entrega,
      CASE
        WHEN dr.estado_entrega IN ('fallido', 'cancelado') THEN 'rechazado'
        WHEN dr.estado_entrega IS NULL THEN 'pendiente'
        ELSE dr.estado_entrega
      END AS estado_entrega,
      dr.fecha_hora_entrega,
      CASE
        WHEN dr.estado_entrega IN ('rechazado', 'fallido', 'cancelado') THEN 'rechazado'
        WHEN dr.metodo_pago_registrado = 'cuenta_corriente' THEN 'cuenta_corriente'
        WHEN COALESCE(lower(dr.notas_pago), '') LIKE '%pagara despues%' THEN 'pagara_despues'
        WHEN COALESCE(lower(dr.notas_pago), '') LIKE '%pagara%' THEN 'pagara_despues'
        WHEN COALESCE(dr.monto_cobrado_registrado, 0) > 0
          AND COALESCE(p.total_final, p.total, 0) > COALESCE(dr.monto_cobrado_registrado, 0) THEN 'parcial'
        WHEN COALESCE(dr.monto_cobrado_registrado, 0) > 0 THEN 'pagado'
        WHEN NULLIF(dr.metodo_pago_registrado, '') IS NOT NULL THEN 'pendiente'
        ELSE NULL
      END AS estado_pago,
      CASE
        WHEN dr.estado_entrega IN ('rechazado', 'fallido', 'cancelado') THEN true
        WHEN dr.metodo_pago_registrado = 'cuenta_corriente' THEN true
        WHEN COALESCE(lower(dr.notas_pago), '') LIKE '%pagara%' THEN true
        WHEN COALESCE(dr.monto_cobrado_registrado, 0) > 0 THEN true
        WHEN NULLIF(dr.metodo_pago_registrado, '') IS NOT NULL THEN true
        ELSE false
      END AS pago_registrado,
      COALESCE(dr.monto_cobrado_registrado, 0) AS monto_cobrado_registrado,
      dr.metodo_pago_registrado,
      dr.numero_transaccion_registrado,
      dr.comprobante_url_registrado,
      dr.comprobante_storage_path,
      dr.notas_pago,
      dr.pedido_id,
      p.cliente_id,
      NULL::uuid AS presupuesto_id,
      NULL::int AS entrega_orden,
      jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        'total', COALESCE(p.total_final, p.total),
        'turno', p.turno,
        'pago_estado', p.pago_estado,
        'metodos_pago', p.metodos_pago,
        'instrucciones_repartidor', COALESCE(NULLIF(p.instruccion_repartidor, ''), NULLIF(p.observaciones, '')),
        'cliente', jsonb_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'telefono', c.telefono,
          'direccion', c.direccion,
          'zona_entrega', c.zona_entrega,
          'coordenadas', CASE
            WHEN c.coordenadas IS NOT NULL THEN jsonb_build_object(
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
              'producto_id', dp.producto_id,
              'producto', jsonb_build_object(
                'id', prod.id,
                'nombre', prod.nombre,
                'codigo', prod.codigo,
                'unidad_medida', prod.unidad_medida
              )
            )
            ORDER BY dp.created_at NULLS LAST, dp.id
          )
          FROM public.detalles_pedido dp
          LEFT JOIN public.productos prod ON prod.id = dp.producto_id
          WHERE dp.pedido_id = p.id
        )
      ) AS pedido,
      dr.orden_entrega AS sort_orden,
      dr.id::text AS sort_id
    FROM public.detalles_ruta dr
    LEFT JOIN public.pedidos p ON p.id = dr.pedido_id
    LEFT JOIN public.clientes c ON c.id = p.cliente_id
    WHERE dr.ruta_id = p_ruta_id
      AND p.cliente_id IS NOT NULL

    UNION ALL

    SELECT
      e.id,
      dr.id AS detalle_ruta_id,
      dr.id AS detalle_ruta_id_padre,
      true AS es_pedido_agrupado,
      e.id AS entrega_id,
      COALESCE(e.orden_entrega, dr.orden_entrega) AS orden_entrega,
      CASE
        WHEN e.estado_entrega IN ('fallido', 'cancelado') THEN 'rechazado'
        WHEN e.estado_entrega IS NULL THEN COALESCE(dr.estado_entrega, 'pendiente')
        ELSE e.estado_entrega
      END AS estado_entrega,
      COALESCE(e.fecha_hora_entrega, dr.fecha_hora_entrega) AS fecha_hora_entrega,
      CASE
        WHEN e.estado_entrega IN ('rechazado', 'fallido', 'cancelado') THEN 'rechazado'
        WHEN e.estado_pago = 'pago_parcial' THEN 'parcial'
        WHEN e.estado_pago = 'fiado' THEN 'cuenta_corriente'
        WHEN e.estado_pago IN ('pagado', 'parcial', 'cuenta_corriente', 'rechazado', 'pagara_despues') THEN e.estado_pago
        WHEN e.estado_pago = 'pendiente' AND NULLIF(e.metodo_pago, '') IS NOT NULL THEN 'pendiente'
        WHEN e.metodo_pago = 'cuenta_corriente' THEN 'cuenta_corriente'
        WHEN COALESCE(e.monto_cobrado, 0) > 0
          AND COALESCE(pres.total_final, e.total, p.total_final, p.total, 0) > COALESCE(e.monto_cobrado, 0) THEN 'parcial'
        WHEN COALESCE(e.monto_cobrado, 0) > 0 THEN 'pagado'
        WHEN NULLIF(e.metodo_pago, '') IS NOT NULL THEN 'pendiente'
        WHEN COALESCE(lower(e.notas_pago), '') LIKE '%pagara despues%' THEN 'pagara_despues'
        WHEN COALESCE(lower(e.notas_pago), '') LIKE '%pagara%' THEN 'pagara_despues'
        ELSE NULL
      END AS estado_pago,
      CASE
        WHEN e.estado_entrega IN ('rechazado', 'fallido', 'cancelado') THEN true
        WHEN e.estado_pago IN ('pagado', 'parcial', 'cuenta_corriente', 'rechazado', 'pagara_despues') THEN true
        WHEN e.estado_pago = 'pendiente' AND NULLIF(e.metodo_pago, '') IS NOT NULL THEN true
        WHEN e.metodo_pago = 'cuenta_corriente' THEN true
        WHEN COALESCE(e.monto_cobrado, 0) > 0 THEN true
        WHEN NULLIF(e.metodo_pago, '') IS NOT NULL THEN true
        WHEN COALESCE(lower(e.notas_pago), '') LIKE '%pagara%' THEN true
        ELSE false
      END AS pago_registrado,
      COALESCE(e.monto_cobrado, 0) AS monto_cobrado_registrado,
      COALESCE(e.metodo_pago, dr.metodo_pago_registrado) AS metodo_pago_registrado,
      COALESCE(e.numero_transaccion, dr.numero_transaccion_registrado) AS numero_transaccion_registrado,
      COALESCE(NULLIF(e.comprobante_url, ''), NULLIF(dr.comprobante_url_registrado, '')) AS comprobante_url_registrado,
      COALESCE(NULLIF(e.comprobante_storage_path, ''), NULLIF(dr.comprobante_storage_path, '')) AS comprobante_storage_path,
      COALESCE(e.notas_pago, dr.notas_pago) AS notas_pago,
      dr.pedido_id,
      e.cliente_id,
      e.presupuesto_id,
      e.orden_entrega AS entrega_orden,
      jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        'total', COALESCE(pres.total_final, e.total, p.total_final, p.total),
        'turno', p.turno,
        'pago_estado', COALESCE(e.estado_pago, p.pago_estado),
        'metodos_pago', p.metodos_pago,
        'instrucciones_repartidor', COALESCE(
          NULLIF(p.instruccion_repartidor, ''),
          NULLIF(e.instruccion_repartidor, ''),
          NULLIF(p.observaciones, '')
        ),
        'cliente', jsonb_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'telefono', c.telefono,
          'direccion', COALESCE(NULLIF(e.direccion, ''), c.direccion),
          'zona_entrega', c.zona_entrega,
          'coordenadas', CASE
            WHEN e.coordenadas IS NOT NULL THEN jsonb_build_object(
              'lat', ST_Y(e.coordenadas::geometry),
              'lng', ST_X(e.coordenadas::geometry)
            )
            WHEN c.coordenadas IS NOT NULL THEN jsonb_build_object(
              'lat', ST_Y(c.coordenadas::geometry),
              'lng', ST_X(c.coordenadas::geometry)
            )
            ELSE NULL
          END
        ),
        'detalle_pedido', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', pi.id,
              'cantidad', COALESCE(pi.peso_final, pi.cantidad_solicitada),
              'producto_id', pi.producto_id,
              'precio_unitario', COALESCE(pi.precio_unit_final, pi.precio_unit_est),
              'subtotal', COALESCE(pi.subtotal_final, pi.subtotal_est),
              'producto', jsonb_build_object(
                'id', prod.id,
                'nombre', prod.nombre,
                'codigo', prod.codigo,
                'unidad_medida', prod.unidad_medida
              )
            )
            ORDER BY pi.created_at NULLS LAST, pi.id
          )
          FROM public.presupuesto_items pi
          LEFT JOIN public.productos prod ON prod.id = pi.producto_id
          WHERE pi.presupuesto_id = e.presupuesto_id
        )
      ) AS pedido,
      COALESCE(e.orden_entrega, dr.orden_entrega) AS sort_orden,
      (dr.id::text || ':' || e.id::text) AS sort_id
    FROM public.detalles_ruta dr
    LEFT JOIN public.pedidos p ON p.id = dr.pedido_id
    LEFT JOIN public.entregas e ON e.pedido_id = p.id
    LEFT JOIN public.clientes c ON c.id = e.cliente_id
    LEFT JOIN public.presupuestos pres ON pres.id = e.presupuesto_id
    WHERE dr.ruta_id = p_ruta_id
      AND p.cliente_id IS NULL
      AND e.id IS NOT NULL
  )
  SELECT COALESCE(
    jsonb_agg(
      (to_jsonb(detalle) - 'sort_orden' - 'sort_id')
      ORDER BY detalle.sort_orden, detalle.sort_id
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM detalles detalle;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

SELECT public.fn_recalcular_detalle_ruta_agrupado(dr.pedido_id)
FROM public.detalles_ruta dr
JOIN public.pedidos p ON p.id = dr.pedido_id
WHERE p.cliente_id IS NULL;

COMMIT;
