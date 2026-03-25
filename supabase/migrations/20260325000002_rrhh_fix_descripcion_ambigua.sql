CREATE OR REPLACE FUNCTION public.fn_rrhh_suspensiones_periodo(
  p_empleado_id uuid,
  p_mes integer,
  p_anio integer
)
RETURNS TABLE (
  fecha date,
  fraccion_suspension numeric,
  turno_codigo text,
  descripcion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_inicio_mes date := make_date(p_anio, p_mes, 1);
  v_fin_mes date := (date_trunc('month', make_date(p_anio, p_mes, 1)) + interval '1 month - 1 day')::date;
BEGIN
  RETURN QUERY
  WITH eventos AS (
    SELECT
      coalesce(
        nullif(e.metadata -> 'suspension' ->> 'fecha_inicio', '')::date,
        e.fecha_evento::date
      ) AS fecha_inicio,
      nullif(e.metadata -> 'suspension' ->> 'turno_inicio', '') AS turno_inicio,
      nullif(e.metadata -> 'suspension' ->> 'fecha_reintegro', '')::date AS fecha_reintegro,
      nullif(e.metadata -> 'suspension' ->> 'turno_reintegro', '') AS turno_reintegro,
      nullif(e.metadata -> 'suspension' ->> 'dias', '')::integer AS suspension_dias,
      coalesce(nullif(e.descripcion, ''), nullif(e.titulo, ''), 'Suspension disciplinaria') AS descripcion_evento
    FROM public.rrhh_legajo_eventos e
    WHERE e.empleado_id = p_empleado_id
      AND coalesce(e.metadata ->> 'flujo', '') = 'disciplinario'
      AND coalesce(e.metadata ->> 'etapa', '') = 'suspension'
  ),
  dias AS (
    SELECT
      gs::date AS fecha,
      public.fn_rrhh_suspension_fraccion_para_fecha(
        gs::date,
        e.fecha_inicio,
        e.turno_inicio,
        e.fecha_reintegro,
        e.turno_reintegro,
        e.suspension_dias
      ) AS fraccion_suspension,
      public.fn_rrhh_suspension_turno_para_fecha(
        gs::date,
        e.fecha_inicio,
        e.turno_inicio,
        e.fecha_reintegro,
        e.turno_reintegro,
        e.suspension_dias
      ) AS turno_codigo,
      e.descripcion_evento
    FROM eventos e
    CROSS JOIN LATERAL generate_series(
      greatest(e.fecha_inicio, v_inicio_mes)::timestamp,
      least(
        coalesce(
          e.fecha_reintegro,
          e.fecha_inicio + greatest(coalesce(e.suspension_dias, 1) - 1, 0)
        ),
        v_fin_mes
      )::timestamp,
      interval '1 day'
    ) gs
  )
  SELECT
    d.fecha,
    least(max(d.fraccion_suspension), 1)::numeric AS fraccion_suspension,
    (array_agg(d.turno_codigo ORDER BY d.fraccion_suspension DESC NULLS LAST))[1] AS turno_codigo,
    string_agg(d.descripcion_evento, ' | ' ORDER BY d.descripcion_evento) AS descripcion
  FROM dias d
  WHERE d.fraccion_suspension > 0
  GROUP BY d.fecha
  ORDER BY d.fecha;
END;
$function$;
