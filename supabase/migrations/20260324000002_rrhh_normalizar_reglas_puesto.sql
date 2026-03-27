BEGIN;

CREATE OR REPLACE FUNCTION public.fn_rrhh_normalizar_codigo_puesto(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT regexp_replace(
    replace(
      replace(
        replace(
          lower(translate(coalesce(p_text, ''), 'áéíóúäëïöüñÁÉÍÓÚÄËÏÖÜÑ', 'aeiouaeiounAEIOUAEIOUN')),
          'sucursales',
          'suc'
        ),
        'sucursal',
        'suc'
      ),
      'asistente',
      'asist'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$function$;

DROP FUNCTION IF EXISTS public.fn_rrhh_resolver_regla_puesto(uuid, integer, integer, text);

CREATE FUNCTION public.fn_rrhh_resolver_regla_puesto(
  p_empleado_id uuid,
  p_mes integer,
  p_anio integer,
  p_puesto_override text DEFAULT NULL
)
RETURNS TABLE (
  puesto_codigo text,
  grupo_base_dias text,
  dias_base integer,
  horas_jornada decimal,
  tarifa_turno_trabajado decimal,
  tarifa_turno_especial decimal,
  habilita_cajero boolean,
  tarifa_diferencia_cajero decimal,
  sueldo_basico decimal,
  valor_jornal decimal,
  valor_hora decimal,
  tipo_calculo text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_empleado RECORD;
  v_regla_periodo RECORD;
  v_regla_puesto RECORD;
  v_puesto TEXT;
  v_puesto_norm TEXT;
  v_grupo TEXT;
  v_dias INTEGER;
  v_horas DECIMAL;
  v_sueldo DECIMAL;
  v_valor_jornal DECIMAL;
  v_valor_hora DECIMAL;
BEGIN
  SELECT
    e.id,
    e.categoria_id,
    e.sueldo_actual,
    c.nombre AS categoria_nombre,
    c.sueldo_basico AS categoria_sueldo
  INTO v_empleado
  FROM public.rrhh_empleados e
  LEFT JOIN public.rrhh_categorias c ON c.id = e.categoria_id
  WHERE e.id = p_empleado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado % no encontrado', p_empleado_id;
  END IF;

  SELECT *
  INTO v_regla_periodo
  FROM public.rrhh_liquidacion_reglas_periodo
  WHERE periodo_mes = p_mes
    AND periodo_anio = p_anio
    AND activo = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT
      27 AS dias_base_galpon,
      31 AS dias_base_sucursales,
      22 AS dias_base_rrhh,
      26 AS dias_base_lun_sab
    INTO v_regla_periodo;
  END IF;

  v_puesto := lower(trim(COALESCE(NULLIF(p_puesto_override, ''), NULLIF(v_empleado.categoria_nombre, ''), 'general')));
  v_puesto_norm := public.fn_rrhh_normalizar_codigo_puesto(v_puesto);

  SELECT *
  INTO v_regla_puesto
  FROM public.rrhh_liquidacion_reglas_puesto rp
  WHERE rp.activo = true
    AND (
      (rp.categoria_id IS NOT NULL AND rp.categoria_id = v_empleado.categoria_id)
      OR lower(trim(rp.puesto_codigo)) = v_puesto
      OR public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) = v_puesto_norm
      OR public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) LIKE v_puesto_norm || '%'
      OR v_puesto_norm LIKE public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) || '%'
    )
  ORDER BY
    CASE
      WHEN rp.categoria_id = v_empleado.categoria_id THEN 0
      WHEN lower(trim(rp.puesto_codigo)) = v_puesto THEN 1
      WHEN public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) = v_puesto_norm THEN 2
      WHEN public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) LIKE v_puesto_norm || '%' THEN 3
      WHEN v_puesto_norm LIKE public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) || '%' THEN 4
      ELSE 5
    END,
    rp.updated_at DESC
  LIMIT 1;

  v_grupo := COALESCE(
    v_regla_puesto.grupo_base_dias,
    CASE
      WHEN v_puesto LIKE '%tesoreria%' THEN 'lun_sab'
      WHEN v_puesto LIKE '%rrhh%' THEN 'rrhh'
      WHEN v_puesto LIKE '%suc%' OR v_puesto LIKE '%encargado%' OR v_puesto LIKE '%asistente%' THEN 'sucursales'
      ELSE 'galpon'
    END
  );

  v_dias := CASE
    WHEN v_grupo = 'sucursales' THEN
      EXTRACT(DAY FROM (make_date(p_anio, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day'))::integer
    WHEN v_grupo = 'rrhh' THEN v_regla_periodo.dias_base_rrhh
    WHEN v_grupo = 'lun_sab' THEN v_regla_periodo.dias_base_lun_sab
    ELSE v_regla_periodo.dias_base_galpon
  END;

  v_horas := GREATEST(COALESCE(v_regla_puesto.horas_jornada, 9), 1);
  v_sueldo := COALESCE(v_empleado.sueldo_actual, v_empleado.categoria_sueldo, 0);
  v_valor_jornal := ROUND(v_sueldo / NULLIF(v_dias, 0), 2);
  v_valor_hora := ROUND(v_valor_jornal / NULLIF(v_horas, 0), 2);

  RETURN QUERY
  SELECT
    v_puesto,
    v_grupo,
    v_dias,
    v_horas,
    COALESCE(v_regla_puesto.tarifa_turno_trabajado, 0),
    COALESCE(v_regla_puesto.tarifa_turno_especial, 0),
    COALESCE(v_regla_puesto.habilita_cajero, false),
    COALESCE(v_regla_puesto.tarifa_diferencia_cajero, 0),
    v_sueldo,
    v_valor_jornal,
    v_valor_hora,
    COALESCE(v_regla_puesto.tipo_calculo, 'hora')::text;
END;
$function$;

WITH matches AS (
  SELECT
    rp.id,
    c.id AS categoria_id,
    ROW_NUMBER() OVER (
      PARTITION BY rp.id
      ORDER BY
        CASE
          WHEN public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) = public.fn_rrhh_normalizar_codigo_puesto(c.nombre) THEN 0
          WHEN public.fn_rrhh_normalizar_codigo_puesto(c.nombre) LIKE public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) || '%' THEN 1
          WHEN public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) LIKE public.fn_rrhh_normalizar_codigo_puesto(c.nombre) || '%' THEN 2
          ELSE 3
        END,
        c.nombre
    ) AS rn,
    COUNT(*) OVER (PARTITION BY rp.id) AS total_matches
  FROM public.rrhh_liquidacion_reglas_puesto rp
  JOIN public.rrhh_categorias c
    ON c.activo = true
   AND (
     public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) = public.fn_rrhh_normalizar_codigo_puesto(c.nombre)
     OR public.fn_rrhh_normalizar_codigo_puesto(c.nombre) LIKE public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) || '%'
     OR public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) LIKE public.fn_rrhh_normalizar_codigo_puesto(c.nombre) || '%'
   )
  WHERE rp.categoria_id IS NULL
)
UPDATE public.rrhh_liquidacion_reglas_puesto rp
SET categoria_id = matches.categoria_id,
    updated_at = NOW()
FROM matches
WHERE rp.id = matches.id
  AND matches.rn = 1
  AND matches.total_matches = 1;

COMMIT;
