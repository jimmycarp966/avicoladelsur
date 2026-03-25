DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_recalcular_liquidacion(uuid, uuid)'::regprocedure)
  INTO v_def;

  v_def := regexp_replace(
    v_def,
    $$WHEN r\.grupo_base_dias = 'sucursales' THEN true$$,
    $$WHEN r.grupo_base_dias IN ('sucursales', 'lun_sab') THEN true$$,
    'g'
  );

  v_def := regexp_replace(
    v_def,
    $$WHEN coalesce\(regla_dia\.grupo_base_dias, 'galpon'\) = 'sucursales' THEN 0$$,
    $$WHEN coalesce(regla_dia.grupo_base_dias, 'galpon') IN ('sucursales', 'lun_sab') THEN 0$$,
    'g'
  );

  EXECUTE v_def;
END
$$;

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)'::regprocedure)
  INTO v_def;

  v_def := regexp_replace(
    v_def,
    $$WHEN coalesce\(v_regla\.grupo_base_dias, 'galpon'\) = 'sucursales' THEN true$$,
    $$WHEN coalesce(v_regla.grupo_base_dias, 'galpon') IN ('sucursales', 'lun_sab') THEN true$$,
    'g'
  );

  v_def := regexp_replace(
    v_def,
    $$coalesce\(v_regla\.grupo_base_dias, 'galpon'\) <> 'sucursales'$$,
    $$coalesce(v_regla.grupo_base_dias, 'galpon') NOT IN ('sucursales', 'lun_sab')$$,
    'g'
  );

  EXECUTE v_def;
END
$$;
