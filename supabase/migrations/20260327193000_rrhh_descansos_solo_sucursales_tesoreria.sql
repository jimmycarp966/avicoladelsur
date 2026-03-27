-- RRHH: los descansos mensuales automaticos solo aplican a sucursales y tesoreria.
-- Corrige el generador, agrega una verificacion reusable y limpia descansos ya creados fuera de regla.

CREATE OR REPLACE FUNCTION public.fn_rrhh_empleado_habilitado_descanso_mensual(
  p_empleado_id uuid,
  p_mes integer,
  p_anio integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria_id uuid;
  v_categoria_nombre text;
  v_categoria_norm text;
  v_grupo_base text;
  v_puesto_norm text;
BEGIN
  SELECT
    e.categoria_id,
    c.nombre,
    COALESCE(public.fn_rrhh_normalizar_codigo_puesto(c.nombre), '')
  INTO
    v_categoria_id,
    v_categoria_nombre,
    v_categoria_norm
  FROM public.rrhh_empleados e
  LEFT JOIN public.rrhh_categorias c ON c.id = e.categoria_id
  WHERE e.id = p_empleado_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT
    rp.grupo_base_dias,
    COALESCE(public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo), '')
  INTO
    v_grupo_base,
    v_puesto_norm
  FROM public.rrhh_liquidacion_reglas_puesto rp
  WHERE COALESCE(rp.activo, true) = true
    AND (
      (v_categoria_id IS NOT NULL AND rp.categoria_id = v_categoria_id)
      OR COALESCE(public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo), '') = v_categoria_norm
      OR COALESCE(public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo), '') LIKE v_categoria_norm || '%'
      OR v_categoria_norm LIKE COALESCE(public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo), '') || '%'
    )
  ORDER BY
    CASE
      WHEN rp.categoria_id = v_categoria_id THEN 0
      WHEN COALESCE(public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo), '') = v_categoria_norm THEN 1
      WHEN COALESCE(public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo), '') LIKE v_categoria_norm || '%' THEN 2
      WHEN v_categoria_norm LIKE COALESCE(public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo), '') || '%' THEN 3
      ELSE 4
    END,
    rp.updated_at DESC
  LIMIT 1;

  RETURN COALESCE(v_grupo_base, 'galpon') = 'sucursales'
    OR v_puesto_norm LIKE '%tesoreria%'
    OR v_categoria_norm LIKE '%tesoreria%';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_generar_descansos_mensuales(
  p_anio integer,
  p_mes integer,
  p_empleado_id uuid DEFAULT NULL,
  p_seed text DEFAULT NULL
)
RETURNS TABLE(empleado_id uuid, generados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio date;
  v_fin date;
  v_target uuid;
  v_existentes integer;
  v_faltantes integer;
  v_insertados integer;
BEGIN
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: %', p_mes;
  END IF;

  IF p_anio < 2020 THEN
    RAISE EXCEPTION 'Anio invalido: %', p_anio;
  END IF;

  v_inicio := make_date(p_anio, p_mes, 1);
  v_fin := (date_trunc('month', v_inicio::timestamp) + interval '1 month - 1 day')::date;

  FOR v_target IN
    SELECT e.id
    FROM public.rrhh_empleados e
    WHERE e.activo = true
      AND (p_empleado_id IS NULL OR e.id = p_empleado_id)
      AND public.fn_rrhh_empleado_habilitado_descanso_mensual(e.id, p_mes, p_anio)
  LOOP
    SELECT COUNT(*)::integer
    INTO v_existentes
    FROM public.rrhh_descansos_mensuales d
    WHERE d.empleado_id = v_target
      AND d.periodo_anio = p_anio
      AND d.periodo_mes = p_mes
      AND d.estado <> 'cancelado';

    v_faltantes := GREATEST(2 - COALESCE(v_existentes, 0), 0);

    IF v_faltantes = 0 THEN
      empleado_id := v_target;
      generados := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.rrhh_descansos_mensuales (
      empleado_id,
      periodo_mes,
      periodo_anio,
      fecha,
      turno,
      estado,
      origen,
      observaciones
    )
    SELECT
      v_target,
      p_mes,
      p_anio,
      gs.fecha,
      'medio_turno_tarde',
      'programado',
      'auto',
      'Descanso mensual de empresa (medio turno tarde)'
    FROM (
      SELECT d::date AS fecha
      FROM generate_series(v_inicio::timestamp, v_fin::timestamp, interval '1 day') d
      WHERE extract(dow FROM d) BETWEEN 1 AND 6
        AND NOT EXISTS (
          SELECT 1
          FROM public.rrhh_feriados f
          WHERE f.activo = true
            AND f.fecha = d::date
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.rrhh_descansos_mensuales x
          WHERE x.empleado_id = v_target
            AND x.periodo_mes = p_mes
            AND x.periodo_anio = p_anio
            AND x.fecha = d::date
            AND x.estado <> 'cancelado'
        )
      ORDER BY md5(v_target::text || d::date::text || coalesce(p_seed, to_char(now(), 'YYYYMMDD')))
      LIMIT v_faltantes
    ) gs
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_insertados = ROW_COUNT;

    empleado_id := v_target;
    generados := COALESCE(v_insertados, 0);
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_limpiar_descansos_fuera_de_regla(
  p_anio integer DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_actor uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  descansos_cancelados integer,
  asistencias_restauradas integer,
  asistencias_eliminadas integer,
  jornadas_eliminadas integer,
  liquidaciones_recalculadas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_descanso RECORD;
  v_asistencia RECORD;
  v_jornada RECORD;
  v_liquidacion_id uuid;
  v_liquidaciones uuid[] := ARRAY[]::uuid[];
  v_descansos_cancelados integer := 0;
  v_asistencias_restauradas integer := 0;
  v_asistencias_eliminadas integer := 0;
  v_jornadas_eliminadas integer := 0;
  v_liquidaciones_recalculadas integer := 0;
BEGIN
  FOR v_descanso IN
    SELECT
      d.id,
      d.empleado_id,
      d.periodo_mes,
      d.periodo_anio,
      d.fecha,
      d.observaciones
    FROM public.rrhh_descansos_mensuales d
    WHERE d.estado <> 'cancelado'
      AND (p_anio IS NULL OR d.periodo_anio = p_anio)
      AND (p_mes IS NULL OR d.periodo_mes = p_mes)
      AND NOT public.fn_rrhh_empleado_habilitado_descanso_mensual(d.empleado_id, d.periodo_mes, d.periodo_anio)
  LOOP
    UPDATE public.rrhh_descansos_mensuales
    SET
      estado = 'cancelado',
      origen = 'manual',
      observaciones = CASE
        WHEN COALESCE(NULLIF(v_descanso.observaciones, ''), '') <> '' THEN
          v_descanso.observaciones || ' | Cancelado automaticamente: descanso fuera de regla (solo sucursales y tesoreria)'
        ELSE
          'Cancelado automaticamente: descanso fuera de regla (solo sucursales y tesoreria)'
      END,
      updated_at = now()
    WHERE id = v_descanso.id;

    v_descansos_cancelados := v_descansos_cancelados + 1;

    SELECT
      a.id,
      a.estado,
      a.observaciones,
      a.hora_entrada,
      a.hora_salida,
      a.horas_trabajadas,
      a.retraso_minutos
    INTO v_asistencia
    FROM public.rrhh_asistencia a
    WHERE a.empleado_id = v_descanso.empleado_id
      AND a.fecha = v_descanso.fecha
    LIMIT 1;

    IF FOUND AND (
      COALESCE(v_asistencia.estado, '') = 'licencia'
      OR lower(COALESCE(v_asistencia.observaciones, '')) LIKE '%descanso mensual de empresa%'
    ) THEN
      IF COALESCE(v_asistencia.hora_entrada, v_asistencia.hora_salida) IS NOT NULL
        OR COALESCE(v_asistencia.horas_trabajadas, 0) > 0
        OR COALESCE(v_asistencia.retraso_minutos, 0) > 0 THEN
        UPDATE public.rrhh_asistencia
        SET
          estado = CASE
            WHEN COALESCE(v_asistencia.retraso_minutos, 0) > 0 THEN 'tarde'
            ELSE 'presente'
          END,
          observaciones = 'Restaurado automaticamente luego de quitar descanso fuera de regla',
          updated_at = now()
        WHERE id = v_asistencia.id;

        v_asistencias_restauradas := v_asistencias_restauradas + 1;
      ELSE
        DELETE FROM public.rrhh_asistencia
        WHERE id = v_asistencia.id;

        v_asistencias_eliminadas := v_asistencias_eliminadas + 1;
      END IF;
    END IF;

    FOR v_jornada IN
      SELECT j.id, j.liquidacion_id
      FROM public.rrhh_liquidacion_jornadas j
      WHERE j.empleado_id = v_descanso.empleado_id
        AND j.fecha = v_descanso.fecha
        AND j.origen = 'auto_licencia_descanso'
    LOOP
      DELETE FROM public.rrhh_liquidacion_jornadas
      WHERE id = v_jornada.id;

      v_jornadas_eliminadas := v_jornadas_eliminadas + 1;

      IF NOT (v_jornada.liquidacion_id = ANY(v_liquidaciones)) THEN
        v_liquidaciones := array_append(v_liquidaciones, v_jornada.liquidacion_id);
      END IF;
    END LOOP;
  END LOOP;

  IF COALESCE(array_length(v_liquidaciones, 1), 0) > 0 THEN
    FOREACH v_liquidacion_id IN ARRAY v_liquidaciones
    LOOP
      PERFORM public.fn_rrhh_recalcular_liquidacion(v_liquidacion_id, p_actor);
      v_liquidaciones_recalculadas := v_liquidaciones_recalculadas + 1;
    END LOOP;
  END IF;

  descansos_cancelados := v_descansos_cancelados;
  asistencias_restauradas := v_asistencias_restauradas;
  asistencias_eliminadas := v_asistencias_eliminadas;
  jornadas_eliminadas := v_jornadas_eliminadas;
  liquidaciones_recalculadas := v_liquidaciones_recalculadas;

  RETURN NEXT;
END;
$function$;

DO $do$
DECLARE
  v_result RECORD;
BEGIN
  SELECT *
  INTO v_result
  FROM public.fn_rrhh_limpiar_descansos_fuera_de_regla(NULL, NULL, NULL);

  RAISE NOTICE
    'RRHH descansos fuera de regla limpiados. Descansos cancelados: %, asistencias restauradas: %, asistencias eliminadas: %, jornadas eliminadas: %, liquidaciones recalculadas: %',
    COALESCE(v_result.descansos_cancelados, 0),
    COALESCE(v_result.asistencias_restauradas, 0),
    COALESCE(v_result.asistencias_eliminadas, 0),
    COALESCE(v_result.jornadas_eliminadas, 0),
    COALESCE(v_result.liquidaciones_recalculadas, 0);
END
$do$;
