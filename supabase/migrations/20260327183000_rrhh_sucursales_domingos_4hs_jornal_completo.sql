BEGIN;

DO $mig$
DECLARE
  v_def text;
  v_target text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_recalcular_liquidacion(uuid, uuid)'::regprocedure)
  INTO v_def;

  v_target := $$      coalesce(base_rule.valor_hora, 0) AS valor_hora_base,$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque valor_hora_base en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$      coalesce(base_rule.valor_hora, 0) AS valor_hora_base,
      coalesce(base_rule.valor_jornal, 0) AS valor_jornal_base,$$
  );

  v_target := $$            WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN least(r.horas_asistencia, 9)$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de horas mensuales sucursal domingo/feriado en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$            WHEN r.grupo_base_dias = 'sucursales' AND extract(dow FROM r.fecha) = 0 THEN
              CASE
                WHEN coalesce(r.horas_asistencia, 0) > 0 THEN 4
                ELSE 0
              END
            WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN least(r.horas_asistencia, 9)$$
  );

  v_target := $$        WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN greatest(r.horas_asistencia - 9, 0)$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de horas adicionales sucursal domingo/feriado en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$        WHEN r.grupo_base_dias = 'sucursales' AND extract(dow FROM r.fecha) = 0 THEN greatest(r.horas_asistencia - 4, 0)
        WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN greatest(r.horas_asistencia - 9, 0)$$
  );

  v_target := $$      CASE
        WHEN r.origen = 'auto_suspension' THEN 0
        WHEN r.tipo_calculo = 'turno' THEN r.tarifa_turno_resuelta
        ELSE r.valor_hora_base
      END AS tarifa_hora_base_resuelta,$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de tarifa_hora_base_resuelta en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$      CASE
        WHEN r.origen = 'auto_suspension' THEN 0
        WHEN r.tipo_calculo = 'turno' THEN r.tarifa_turno_resuelta
        WHEN r.grupo_base_dias = 'sucursales'
          AND extract(dow FROM r.fecha) = 0
          AND coalesce(r.horas_asistencia, 0) > 0 THEN coalesce(r.valor_jornal_base / 4, 0)
        ELSE r.valor_hora_base
      END AS tarifa_hora_base_resuelta,$$
  );

  EXECUTE v_def;
END
$mig$;

COMMIT;
