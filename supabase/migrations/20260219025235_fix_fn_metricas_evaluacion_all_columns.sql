CREATE OR REPLACE FUNCTION public.fn_obtener_metricas_evaluacion(p_empleado_id uuid, p_mes integer, p_anio integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_puntualidad JSONB;
  v_rendimiento JSONB;
  v_responsabilidad JSONB;
  v_trabajo_equipo JSONB;
  v_actitud JSONB;
  v_empleado RECORD;
  v_usuario_id UUID;
BEGIN
  v_fecha_inicio := make_date(p_anio, p_mes, 1);
  v_fecha_fin := (v_fecha_inicio + interval '1 month' - interval '1 day')::DATE;

  SELECT e.*, c.nombre AS categoria_nombre
  INTO v_empleado
  FROM rrhh_empleados e
  LEFT JOIN rrhh_categorias c ON e.categoria_id = c.id
  WHERE e.id = p_empleado_id;

  SELECT usuario_id INTO v_usuario_id FROM rrhh_empleados WHERE id = p_empleado_id;

  -- 1. PUNTUALIDAD
  SELECT jsonb_build_object(
    'dias_presentes', COUNT(*) FILTER (WHERE estado = 'presente'),
    'dias_tarde', COUNT(*) FILTER (WHERE estado = 'tarde'),
    'dias_ausente', COUNT(*) FILTER (WHERE estado = 'ausente'),
    'dias_licencia', COUNT(*) FILTER (WHERE estado = 'licencia'),
    'faltas_sin_aviso', COUNT(*) FILTER (WHERE falta_sin_aviso = true),
    'retraso_promedio_min', COALESCE(ROUND(AVG(retraso_minutos) FILTER (WHERE retraso_minutos > 0), 1), 0),
    'retraso_total_min', COALESCE(SUM(retraso_minutos), 0),
    'total_dias_registrados', COUNT(*)
  ) INTO v_puntualidad
  FROM rrhh_asistencia
  WHERE empleado_id = p_empleado_id
    AND fecha BETWEEN v_fecha_inicio AND v_fecha_fin;

  v_puntualidad := v_puntualidad || jsonb_build_object(
    'licencias_aprobadas', (
      SELECT COUNT(*)
      FROM rrhh_licencias
      WHERE empleado_id = p_empleado_id
        AND aprobado = true
        AND fecha_inicio <= v_fecha_fin
        AND fecha_fin >= v_fecha_inicio
    )
  );

  -- 2. RENDIMIENTO
  v_rendimiento := jsonb_build_object(
    'ventas', (
      SELECT jsonb_build_object(
        'total_pedidos', COUNT(*),
        'monto_total', COALESCE(SUM(total), 0),
        'pedidos_entregados', COUNT(*) FILTER (WHERE estado = 'entregado'),
        'pedidos_cancelados', COUNT(*) FILTER (WHERE estado = 'cancelado')
      )
      FROM pedidos
      WHERE usuario_vendedor = v_usuario_id
        AND fecha_pedido::date BETWEEN v_fecha_inicio AND v_fecha_fin
    ),
    'produccion', (
      SELECT jsonb_build_object(
        'ordenes_completadas', COUNT(*) FILTER (WHERE estado = 'completada'),
        'ordenes_total', COUNT(*),
        'kg_producidos', COALESCE(SUM(peso_total_salida), 0)
      )
      FROM ordenes_produccion
      WHERE operario_id = v_usuario_id
        AND fecha_produccion::date BETWEEN v_fecha_inicio AND v_fecha_fin
    ),
    'reparto', (
      SELECT jsonb_build_object(
        'rutas_completadas', COUNT(*) FILTER (WHERE estado = 'completada'),
        'rutas_total', COUNT(*),
        'entregas_exitosas', (
          SELECT COUNT(*)
          FROM detalles_ruta dr
          JOIN rutas_reparto rr ON dr.ruta_id = rr.id
          WHERE rr.repartidor_id = v_usuario_id
            AND rr.fecha_ruta::date BETWEEN v_fecha_inicio AND v_fecha_fin
            AND dr.estado_entrega = 'entregado'
        ),
        'entregas_fallidas', (
          SELECT COUNT(*)
          FROM detalles_ruta dr
          JOIN rutas_reparto rr ON dr.ruta_id = rr.id
          WHERE rr.repartidor_id = v_usuario_id
            AND rr.fecha_ruta::date BETWEEN v_fecha_inicio AND v_fecha_fin
            AND dr.estado_entrega IN ('no_entregado', 'rechazado')
        )
      )
      FROM rutas_reparto
      WHERE repartidor_id = v_usuario_id
        AND fecha_ruta::date BETWEEN v_fecha_inicio AND v_fecha_fin
    ),
    'categoria', COALESCE(v_empleado.categoria_nombre, 'Sin categoría')
  );

  -- 3. RESPONSABILIDAD
  -- cierres_caja no tiene FK directa al usuario, se omite (null)
  v_responsabilidad := jsonb_build_object(
    'caja', null,
    'descuentos', (
      SELECT jsonb_build_object(
        'total_descuentos', COUNT(*),
        'multas', COUNT(*) FILTER (WHERE tipo = 'multa'),
        'monto_total', COALESCE(SUM(monto), 0)
      )
      FROM rrhh_descuentos
      WHERE empleado_id = p_empleado_id
        AND fecha BETWEEN v_fecha_inicio AND v_fecha_fin
    )
  );

  -- 4. TRABAJO EN EQUIPO
  v_trabajo_equipo := jsonb_build_object(
    'novedades_periodo', (
      SELECT COUNT(*)
      FROM rrhh_novedades
      WHERE activo = true
        AND fecha_publicacion BETWEEN v_fecha_inicio AND v_fecha_fin
        AND (
          tipo = 'general'
          OR sucursal_id = v_empleado.sucursal_id
        )
    ),
    'placeholder', 'Métricas de colaboración requieren datos adicionales'
  );

  -- 5. ACTITUD
  v_actitud := jsonb_build_object(
    'sanciones_periodo', (
      SELECT COUNT(*)
      FROM rrhh_descuentos
      WHERE empleado_id = p_empleado_id
        AND tipo = 'multa'
        AND fecha BETWEEN v_fecha_inicio AND v_fecha_fin
    ),
    'sanciones_historicas', (
      SELECT COUNT(*)
      FROM rrhh_descuentos
      WHERE empleado_id = p_empleado_id
        AND tipo = 'multa'
    ),
    'evaluaciones_previas', (
      SELECT jsonb_build_object(
        'cantidad', COUNT(*),
        'promedio_historico', COALESCE(ROUND(AVG(promedio), 2), 0),
        'ultima_evaluacion', MAX(fecha_evaluacion)
      )
      FROM rrhh_evaluaciones
      WHERE empleado_id = p_empleado_id
        AND estado = 'completada'
    )
  );

  RETURN jsonb_build_object(
    'empleado', jsonb_build_object(
      'id', v_empleado.id,
      'categoria', v_empleado.categoria_nombre,
      'sucursal_id', v_empleado.sucursal_id,
      'fecha_ingreso', v_empleado.fecha_ingreso
    ),
    'periodo', jsonb_build_object(
      'mes', p_mes,
      'anio', p_anio,
      'fecha_inicio', v_fecha_inicio,
      'fecha_fin', v_fecha_fin
    ),
    'puntualidad', v_puntualidad,
    'rendimiento', v_rendimiento,
    'responsabilidad', v_responsabilidad,
    'trabajo_equipo', v_trabajo_equipo,
    'actitud', v_actitud
  );
END;
$function$;
