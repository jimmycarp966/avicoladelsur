DO $mig$
DECLARE
  v_def text;
  v_target text;
  v_replacement text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)'::regprocedure)
  INTO v_def;

  v_target := $$    WHERE a.empleado_id = p_empleado_id
      AND extract(MONTH FROM a.fecha) = p_mes
      AND extract(YEAR FROM a.fecha) = p_anio
      AND a.estado IN ('presente', 'tarde')
      AND coalesce(a.horas_trabajadas, 0) > 0$$;

  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de insercion automatica de asistencia en fn_rrhh_preparar_liquidacion_mensual';
  END IF;

  v_replacement := $$    WHERE a.empleado_id = p_empleado_id
      AND extract(MONTH FROM a.fecha) = p_mes
      AND extract(YEAR FROM a.fecha) = p_anio
      AND a.estado IN ('presente', 'tarde')
      AND coalesce(a.horas_trabajadas, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.rrhh_liquidacion_jornadas j
        WHERE j.liquidacion_id = v_liquidacion_id
          AND j.fecha = a.fecha
          AND j.origen = 'manual'
      )$$;

  v_def := replace(v_def, v_target, v_replacement);

  EXECUTE v_def;
END;
$mig$;
