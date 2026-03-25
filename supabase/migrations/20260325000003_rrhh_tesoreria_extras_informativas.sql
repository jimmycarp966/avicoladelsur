DO $mig$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_recalcular_liquidacion(uuid, uuid)'::regprocedure)
  INTO v_def;

  v_def := regexp_replace(
    v_def,
    $pattern$WHEN r\.grupo_base_dias = 'sucursales' THEN true$pattern$,
    $replacement$WHEN r.grupo_base_dias IN ('sucursales', 'lun_sab') THEN true$replacement$,
    'g'
  );

  v_def := regexp_replace(
    v_def,
    $pattern$WHEN coalesce\(regla_dia\.grupo_base_dias, 'galpon'\) = 'sucursales' THEN 0$pattern$,
    $replacement$WHEN coalesce(regla_dia.grupo_base_dias, 'galpon') IN ('sucursales', 'lun_sab') THEN 0$replacement$,
    'g'
  );

  EXECUTE v_def;
END
$mig$;

DO $mig$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)'::regprocedure)
  INTO v_def;

  v_def := regexp_replace(
    v_def,
    $pattern$WHEN coalesce\(v_regla\.grupo_base_dias, 'galpon'\) = 'sucursales' THEN true$pattern$,
    $replacement$WHEN coalesce(v_regla.grupo_base_dias, 'galpon') IN ('sucursales', 'lun_sab') THEN true$replacement$,
    'g'
  );

  v_def := regexp_replace(
    v_def,
    $pattern$coalesce\(v_regla\.grupo_base_dias, 'galpon'\) <> 'sucursales'$pattern$,
    $replacement$coalesce(v_regla.grupo_base_dias, 'galpon') NOT IN ('sucursales', 'lun_sab')$replacement$,
    'g'
  );

  EXECUTE v_def;
END
$mig$;
