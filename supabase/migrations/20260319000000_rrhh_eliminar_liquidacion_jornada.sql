-- RRHH liquidaciones: eliminar una jornada y limpiar el origen de descanso automatico

CREATE OR REPLACE FUNCTION public.fn_rrhh_eliminar_liquidacion_jornada(
  p_liquidacion_id uuid,
  p_jornada_id uuid,
  p_actor uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  liquidacion_id uuid,
  jornada_id uuid,
  descanso_cancelado boolean,
  asistencia_eliminada boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_liq RECORD;
  v_jornada RECORD;
  v_descanso RECORD;
  v_borrar_asistencia boolean := false;
  v_rows_deleted integer := 0;
BEGIN
  SELECT id, empleado_id, periodo_mes, periodo_anio
  INTO v_liq
  FROM public.rrhh_liquidaciones
  WHERE id = p_liquidacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidacion % no encontrada', p_liquidacion_id;
  END IF;

  SELECT id, fecha, origen, observaciones
  INTO v_jornada
  FROM public.rrhh_liquidacion_jornadas
  WHERE id = p_jornada_id
    AND liquidacion_id = p_liquidacion_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada % no encontrada para liquidacion %', p_jornada_id, p_liquidacion_id;
  END IF;

  liquidacion_id := p_liquidacion_id;
  jornada_id := p_jornada_id;
  descanso_cancelado := false;
  asistencia_eliminada := false;

  IF v_jornada.origen = 'auto_licencia_descanso' THEN
    SELECT id, estado, observaciones
    INTO v_descanso
    FROM public.rrhh_descansos_mensuales
    WHERE empleado_id = v_liq.empleado_id
      AND periodo_mes = v_liq.periodo_mes
      AND periodo_anio = v_liq.periodo_anio
      AND fecha = v_jornada.fecha::date
    LIMIT 1;

    IF FOUND THEN
      IF v_descanso.estado IS DISTINCT FROM 'cancelado' THEN
        UPDATE public.rrhh_descansos_mensuales
        SET
          estado = 'cancelado',
          origen = 'manual',
          observaciones = CASE
            WHEN COALESCE(NULLIF(v_descanso.observaciones, ''), '') <> '' THEN
              v_descanso.observaciones || ' | Descanso eliminado manualmente desde liquidacion'
            ELSE
              'Descanso eliminado manualmente desde liquidacion'
          END,
          updated_at = NOW()
        WHERE id = v_descanso.id;
      END IF;

      descanso_cancelado := true;
      v_borrar_asistencia := true;
    ELSIF lower(COALESCE(v_jornada.observaciones, '')) LIKE '%descanso%' THEN
      v_borrar_asistencia := true;
    END IF;

    IF v_borrar_asistencia THEN
      DELETE FROM public.rrhh_asistencia
      WHERE empleado_id = v_liq.empleado_id
        AND fecha = v_jornada.fecha::date;

      GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
      asistencia_eliminada := v_rows_deleted > 0;
    END IF;
  END IF;

  DELETE FROM public.rrhh_liquidacion_jornadas
  WHERE id = p_jornada_id
    AND liquidacion_id = p_liquidacion_id;

  PERFORM public.fn_rrhh_recalcular_liquidacion(p_liquidacion_id, p_actor);

  RETURN NEXT;
END;
$function$;
