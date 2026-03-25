DROP FUNCTION IF EXISTS public.fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid);

CREATE FUNCTION public.fn_rrhh_preparar_liquidacion_mensual(
  p_empleado_id uuid,
  p_mes integer,
  p_anio integer,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_liquidacion_id uuid;
  v_regla RECORD;
  v_empleado RECORD;
  v_hoy_argentina date := public.fn_today_argentina();
BEGIN
  SELECT *
  INTO v_regla
  FROM public.fn_rrhh_resolver_regla_puesto(p_empleado_id, p_mes, p_anio, NULL);

  SELECT
    e.sucursal_id,
    s.nombre AS sucursal_nombre
  INTO v_empleado
  FROM public.rrhh_empleados e
  LEFT JOIN public.sucursales s ON s.id = e.sucursal_id
  WHERE e.id = p_empleado_id;

  INSERT INTO public.rrhh_liquidaciones (
    empleado_id,
    periodo_mes,
    periodo_anio,
    fecha_liquidacion,
    sueldo_basico,
    valor_hora_extra,
    total_bruto,
    total_neto,
    estado,
    created_by,
    dias_base,
    horas_jornada,
    valor_jornal,
    valor_hora,
    grupo_base_snapshot,
    sucursal_snapshot_id,
    sucursal_snapshot_nombre,
    presentismo_teorico,
    presentismo_perdido,
    presentismo_pagado
  ) VALUES (
    p_empleado_id,
    p_mes,
    p_anio,
    CURRENT_DATE,
    coalesce(v_regla.sueldo_basico, 0),
    coalesce(v_regla.valor_hora, 0),
    0,
    0,
    'calculada',
    p_created_by,
    coalesce(v_regla.dias_base, 30),
    coalesce(v_regla.horas_jornada, 9),
    coalesce(v_regla.valor_jornal, 0),
    coalesce(v_regla.valor_hora, 0),
    coalesce(v_regla.grupo_base_dias, 'galpon'),
    v_empleado.sucursal_id,
    v_empleado.sucursal_nombre,
    coalesce(v_regla.valor_jornal, 0),
    0,
    coalesce(v_regla.valor_jornal, 0)
  )
  ON CONFLICT (empleado_id, periodo_mes, periodo_anio)
  DO UPDATE SET
    updated_at = now(),
    created_by = coalesce(EXCLUDED.created_by, rrhh_liquidaciones.created_by),
    fecha_liquidacion = CURRENT_DATE,
    sueldo_basico = EXCLUDED.sueldo_basico,
    dias_base = EXCLUDED.dias_base,
    horas_jornada = EXCLUDED.horas_jornada,
    valor_jornal = EXCLUDED.valor_jornal,
    valor_hora = EXCLUDED.valor_hora,
    valor_hora_extra = EXCLUDED.valor_hora_extra,
    grupo_base_snapshot = EXCLUDED.grupo_base_snapshot,
    sucursal_snapshot_id = EXCLUDED.sucursal_snapshot_id,
    sucursal_snapshot_nombre = EXCLUDED.sucursal_snapshot_nombre,
    presentismo_teorico = EXCLUDED.presentismo_teorico,
    presentismo_pagado = EXCLUDED.presentismo_pagado
  RETURNING id INTO v_liquidacion_id;

  PERFORM public.fn_rrhh_propagar_descansos_periodo(p_mes, p_anio, p_empleado_id);

  DROP TABLE IF EXISTS tmp_rrhh_jornada_aprobaciones;
  CREATE TEMP TABLE tmp_rrhh_jornada_aprobaciones ON COMMIT DROP AS
  SELECT
    fecha,
    origen,
    horas_extra_aprobadas,
    horas_extra_aprobadas_por,
    horas_extra_aprobadas_at
  FROM public.rrhh_liquidacion_jornadas
  WHERE liquidacion_id = v_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'auto_suspension');

  DELETE FROM public.rrhh_liquidacion_jornadas
  WHERE liquidacion_id = v_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'auto_suspension');

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    horas_extra_aprobadas_por,
    horas_extra_aprobadas_at,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    base.fecha,
    base.turno,
    base.tarea,
    base.horas_mensuales,
    base.horas_adicionales,
    0,
    base.tarifa_hora_base,
    base.tarifa_hora_extra,
    coalesce(v_regla.tarifa_turno_especial, 0),
    CASE
      WHEN base.horas_adicionales <= 0 THEN true
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN true
      WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'sucursales' THEN true
      ELSE coalesce(prev.horas_extra_aprobadas, false)
    END,
    CASE
      WHEN base.horas_adicionales > 0 AND coalesce(v_regla.grupo_base_dias, 'galpon') <> 'sucursales' AND coalesce(prev.horas_extra_aprobadas, false)
        THEN prev.horas_extra_aprobadas_por
      ELSE NULL
    END,
    CASE
      WHEN base.horas_adicionales > 0 AND coalesce(v_regla.grupo_base_dias, 'galpon') <> 'sucursales' AND coalesce(prev.horas_extra_aprobadas, false)
        THEN prev.horas_extra_aprobadas_at
      ELSE NULL
    END,
    base.origen,
    base.observaciones
  FROM (
    SELECT
      a.fecha,
      coalesce(a.turno, 'general') AS turno,
      coalesce(nullif(a.observaciones, ''), 'Asistencia diaria') AS tarea,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN
          CASE
            WHEN lower(coalesce(a.turno, '')) IN ('medio_turno_manana', 'medio_turno_tarde', 'manana', 'tarde')
              OR lower(coalesce(a.turno, '')) LIKE 'ma%ana'
              THEN 0.5
            ELSE 1
          END
        WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'sucursales'
          AND (
            extract(dow FROM a.fecha) = 0
            OR EXISTS (
              SELECT 1
              FROM public.rrhh_feriados f
              WHERE f.fecha = a.fecha
                AND f.activo = true
            )
          )
          THEN 9
        ELSE least(coalesce(a.horas_trabajadas, 0), coalesce(v_regla.horas_jornada, 9))
      END AS horas_mensuales,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
        WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'sucursales'
          AND (
            extract(dow FROM a.fecha) = 0
            OR EXISTS (
              SELECT 1
              FROM public.rrhh_feriados f
              WHERE f.fecha = a.fecha
                AND f.activo = true
            )
          )
          THEN greatest(coalesce(a.horas_trabajadas, 0) - 9, 0)
        ELSE greatest(coalesce(a.horas_trabajadas, 0) - coalesce(v_regla.horas_jornada, 9), 0)
      END AS horas_adicionales,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno'
          THEN coalesce(nullif(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
        ELSE coalesce(v_regla.valor_hora, 0)
      END AS tarifa_hora_base,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
        ELSE coalesce(v_regla.valor_hora, 0)
      END AS tarifa_hora_extra,
      CASE
        WHEN lower(coalesce(a.observaciones, '')) LIKE '%hik%' THEN 'auto_hik'
        ELSE 'auto_asistencia'
      END AS origen,
      a.observaciones
    FROM public.rrhh_asistencia a
    WHERE a.empleado_id = p_empleado_id
      AND extract(MONTH FROM a.fecha) = p_mes
      AND extract(YEAR FROM a.fecha) = p_anio
      AND a.estado IN ('presente', 'tarde')
      AND coalesce(a.horas_trabajadas, 0) > 0
      AND (
        p_anio <> extract(YEAR FROM v_hoy_argentina)::integer
        OR p_mes <> extract(MONTH FROM v_hoy_argentina)::integer
        OR a.fecha <= v_hoy_argentina
      )
  ) base
  LEFT JOIN tmp_rrhh_jornada_aprobaciones prev
    ON prev.fecha = base.fecha
   AND prev.origen = base.origen;

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    a.fecha,
    'descanso',
    'Descanso programado',
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,
    0,
    0,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN coalesce(nullif(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    0,
    true,
    'auto_licencia_descanso',
    coalesce(a.observaciones, 'Descanso programado')
  FROM public.rrhh_asistencia a
  WHERE a.empleado_id = p_empleado_id
    AND extract(MONTH FROM a.fecha) = p_mes
    AND extract(YEAR FROM a.fecha) = p_anio
    AND a.estado = 'licencia'
    AND lower(coalesce(a.observaciones, '')) LIKE '%descanso%'
    AND NOT EXISTS (
      SELECT 1
      FROM public.rrhh_liquidacion_jornadas j
      WHERE j.liquidacion_id = v_liquidacion_id
        AND j.fecha = a.fecha
    );

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    d.fecha,
    'vacaciones',
    CASE WHEN l.tipo = 'descanso_programado' THEN 'Descanso programado' ELSE 'Vacaciones' END,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,
    0,
    0,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN coalesce(nullif(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    0,
    true,
    'auto_licencia_descanso',
    coalesce(l.observaciones, 'Licencia aprobada')
  FROM public.rrhh_licencias l
  CROSS JOIN LATERAL (
    SELECT generate_series(
      greatest(l.fecha_inicio, make_date(p_anio, p_mes, 1))::timestamp,
      least(l.fecha_fin, (date_trunc('month', make_date(p_anio, p_mes, 1)) + interval '1 month - 1 day')::date)::timestamp,
      interval '1 day'
    )::date AS fecha
  ) d
  WHERE l.empleado_id = p_empleado_id
    AND l.aprobado = true
    AND l.tipo IN ('vacaciones', 'descanso_programado')
    AND l.fecha_inicio <= (date_trunc('month', make_date(p_anio, p_mes, 1)) + interval '1 month - 1 day')::date
    AND l.fecha_fin >= make_date(p_anio, p_mes, 1)
    AND NOT EXISTS (
      SELECT 1
      FROM public.rrhh_liquidacion_jornadas j
      WHERE j.liquidacion_id = v_liquidacion_id
        AND j.fecha = d.fecha
    );

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    s.fecha,
    coalesce(s.turno_codigo, 'suspension_completa'),
    'Suspension disciplinaria',
    0,
    0,
    0,
    0,
    0,
    0,
    true,
    'auto_suspension',
    coalesce(s.descripcion, 'Suspension disciplinaria')
  FROM public.fn_rrhh_suspensiones_periodo(p_empleado_id, p_mes, p_anio) s;

  PERFORM public.fn_rrhh_recalcular_liquidacion(v_liquidacion_id, p_created_by);

  RETURN v_liquidacion_id;
END;
$function$;
