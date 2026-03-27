BEGIN;

DO $mig$
DECLARE
  v_def text;
  v_target text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_recalcular_liquidacion(uuid, uuid)'::regprocedure)
  INTO v_def;

  v_target := $$      j.horas_extra_aprobadas,
      coalesce(base_rule.grupo_base_dias, 'galpon') AS grupo_base_dias,$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de regla base en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$      j.horas_extra_aprobadas,
      coalesce(base_rule.puesto_codigo, 'general') AS puesto_codigo_resuelto,
      coalesce(base_rule.grupo_base_dias, 'galpon') AS grupo_base_dias,$$
  );

  v_target := $$            WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN least(r.horas_asistencia, 9)
            ELSE least(r.horas_asistencia, r.horas_jornada_resueltas)$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de horas mensuales en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$            WHEN public.fn_rrhh_normalizar_codigo_puesto(coalesce(r.puesto_codigo_resuelto, '')) LIKE 'ventas%'
              AND r.es_domingo_o_feriado THEN
              CASE
                WHEN coalesce(r.horas_asistencia, 0) > 0 THEN 4
                ELSE 0
              END
            WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN least(r.horas_asistencia, 9)
            ELSE least(r.horas_asistencia, r.horas_jornada_resueltas)$$
  );

  v_target := $$        WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN greatest(r.horas_asistencia - 9, 0)
        ELSE greatest(r.horas_asistencia - r.horas_jornada_resueltas, 0)$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de horas adicionales en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$        WHEN public.fn_rrhh_normalizar_codigo_puesto(coalesce(r.puesto_codigo_resuelto, '')) LIKE 'ventas%'
          AND EXISTS (
            SELECT 1
            FROM public.rrhh_feriados f
            WHERE f.fecha = r.fecha
              AND f.activo = true
          ) THEN
          CASE
            WHEN coalesce(r.horas_asistencia, 0) > 4 THEN 4
            ELSE 0
          END
        WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN greatest(r.horas_asistencia - 9, 0)
        ELSE greatest(r.horas_asistencia - r.horas_jornada_resueltas, 0)$$
  );

  v_target := $$        WHEN r.grupo_base_dias IN ('sucursales', 'lun_sab') THEN true$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de aprobacion de extras en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$        WHEN public.fn_rrhh_normalizar_codigo_puesto(coalesce(r.puesto_codigo_resuelto, '')) LIKE 'ventas%'
          AND EXISTS (
            SELECT 1
            FROM public.rrhh_feriados f
            WHERE f.fecha = r.fecha
              AND f.activo = true
          ) THEN true
        WHEN r.grupo_base_dias IN ('sucursales', 'lun_sab') THEN true$$
  );

  EXECUTE v_def;
END
$mig$;

COMMIT;
