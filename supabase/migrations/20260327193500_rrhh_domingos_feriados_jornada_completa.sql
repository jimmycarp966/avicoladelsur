BEGIN;

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_recalcular_liquidacion(uuid, uuid)'::regprocedure)
  INTO v_def;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No se pudo leer fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := regexp_replace(
    v_def,
    'WHEN\s+r\.grupo_base_dias\s*=\s*''sucursales''\s+AND\s+r\.es_domingo_o_feriado\s+THEN\s+4\.5',
    'WHEN r.es_domingo_o_feriado THEN r.horas_jornada_resueltas / 2',
    'g'
  );

  v_def := regexp_replace(
    v_def,
    'WHEN\s+r\.grupo_base_dias\s*=\s*''sucursales''\s+AND\s+r\.es_domingo_o_feriado\s+THEN\s+least\(r\.horas_asistencia,\s*9\)',
    E'WHEN r.es_domingo_o_feriado THEN\n              CASE\n                WHEN coalesce(r.horas_asistencia, 0) > 0 THEN r.horas_jornada_resueltas\n                ELSE 0\n              END',
    'g'
  );

  v_def := regexp_replace(
    v_def,
    'WHEN\s+r\.grupo_base_dias\s*=\s*''sucursales''\s+AND\s+r\.es_domingo_o_feriado\s+THEN\s+greatest\(r\.horas_asistencia\s*-\s*9,\s*0\)',
    'WHEN r.es_domingo_o_feriado THEN greatest(r.horas_asistencia - 4, 0)',
    'g'
  );

  EXECUTE v_def;
END $$;

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)'::regprocedure)
  INTO v_def;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No se pudo leer fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)';
  END IF;

  v_def := regexp_replace(
    v_def,
    'WHEN\s+coalesce\(v_regla\.grupo_base_dias,\s*''galpon''\)\s*=\s*''sucursales''\s+AND\s+\(\s*extract\(dow FROM a\.fecha\)\s*=\s*0\s+OR\s+EXISTS\s*\(\s*SELECT 1\s+FROM public\.rrhh_feriados f\s+WHERE f\.fecha = a\.fecha\s+AND f\.activo = true\s*\)\s*\)\s+THEN\s+9',
    E'WHEN (\n            extract(dow FROM a.fecha) = 0\n            OR EXISTS (\n              SELECT 1\n              FROM public.rrhh_feriados f\n              WHERE f.fecha = a.fecha\n                AND f.activo = true\n            )\n          ) THEN\n          CASE\n            WHEN coalesce(a.horas_trabajadas, 0) > 0 THEN coalesce(v_regla.horas_jornada, 9)\n            ELSE 0\n          END',
    'g'
  );

  v_def := regexp_replace(
    v_def,
    'WHEN\s+coalesce\(v_regla\.grupo_base_dias,\s*''galpon''\)\s*=\s*''sucursales''\s+AND\s+\(\s*extract\(dow FROM a\.fecha\)\s*=\s*0\s+OR\s+EXISTS\s*\(\s*SELECT 1\s+FROM public\.rrhh_feriados f\s+WHERE f\.fecha = a\.fecha\s+AND f\.activo = true\s*\)\s*\)\s+THEN\s+greatest\(coalesce\(a\.horas_trabajadas,\s*0\)\s*-\s*9,\s*0\)',
    'WHEN (extract(dow FROM a.fecha) = 0 OR EXISTS (SELECT 1 FROM public.rrhh_feriados f WHERE f.fecha = a.fecha AND f.activo = true)) THEN greatest(coalesce(a.horas_trabajadas, 0) - 4, 0)',
    'g'
  );

  EXECUTE v_def;
END $$;

COMMIT;
