BEGIN;

CREATE OR REPLACE FUNCTION public.fn_rrhh_resolver_regla_puesto(
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
SET search_path TO public
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
  v_valor_jornal := trunc(v_sueldo / NULLIF(v_dias, 0), 2);
  v_valor_hora := trunc(v_valor_jornal / NULLIF(v_horas, 0), 2);

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

CREATE OR REPLACE FUNCTION public.fn_rrhh_resolver_regla_liquidacion_dia(
  p_liquidacion_id uuid,
  p_fecha date,
  p_puesto_fallback text DEFAULT NULL
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
SET search_path TO public
AS $function$
DECLARE
  v_liq public.rrhh_liquidaciones%ROWTYPE;
  v_puesto_tramo text;
  v_puesto_fallback_normalizado text;
  v_puesto_hs_extra_normalizado text;
  v_override text;
BEGIN
  SELECT *
  INTO v_liq
  FROM public.rrhh_liquidaciones
  WHERE id = p_liquidacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidacion % no encontrada', p_liquidacion_id;
  END IF;

  SELECT tp.puesto_codigo
  INTO v_puesto_tramo
  FROM public.rrhh_liquidacion_tramos_puesto tp
  WHERE tp.liquidacion_id = p_liquidacion_id
    AND p_fecha BETWEEN tp.fecha_desde AND tp.fecha_hasta
  ORDER BY tp.orden ASC, tp.fecha_desde ASC, tp.created_at ASC
  LIMIT 1;

  v_puesto_fallback_normalizado := public.fn_rrhh_normalizar_codigo_puesto(p_puesto_fallback);
  v_puesto_hs_extra_normalizado := public.fn_rrhh_normalizar_codigo_puesto(v_liq.puesto_hs_extra);

  v_override := CASE
    WHEN nullif(trim(coalesce(p_puesto_fallback, '')), '') IS NOT NULL
      AND nullif(trim(coalesce(v_liq.puesto_hs_extra, '')), '') IS NOT NULL
      AND v_puesto_fallback_normalizado = v_puesto_hs_extra_normalizado
      THEN coalesce(
        nullif(trim(p_puesto_fallback), ''),
        nullif(trim(v_puesto_tramo), ''),
        nullif(trim(v_liq.puesto_override), '')
      )
    ELSE coalesce(
      nullif(trim(v_puesto_tramo), ''),
      nullif(trim(p_puesto_fallback), ''),
      nullif(trim(v_liq.puesto_override), '')
    )
  END;

  RETURN QUERY
  SELECT *
  FROM public.fn_rrhh_resolver_regla_puesto(
    v_liq.empleado_id,
    v_liq.periodo_mes,
    v_liq.periodo_anio,
    v_override
  );
END;
$function$;

DO $mig$
DECLARE
  v_def text;
  v_target text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_recalcular_liquidacion(uuid, uuid)'::regprocedure)
  INTO v_def;

  v_target := $$      j.id,
      j.origen,$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque j.id/j.origen en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$      j.id,
      j.fecha,
      j.origen,$$
  );

  v_target := $$        WHEN r.origen = 'auto_licencia_descanso' THEN
          CASE
            WHEN r.tipo_calculo = 'turno' THEN
              CASE
                WHEN r.turno_actual IN ('medio_turno_manana', 'medio_turno_tarde', 'manana', 'tarde') THEN 0.5
                ELSE 1
              END
            ELSE r.horas_jornada_resueltas
          END$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque auto_licencia_descanso en fn_rrhh_recalcular_liquidacion(uuid, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$        WHEN r.origen = 'auto_licencia_descanso' THEN
          CASE
            WHEN r.grupo_base_dias = 'lun_sab' AND extract(dow FROM r.fecha) = 0 THEN 0
            WHEN r.tipo_calculo = 'turno' THEN
              CASE
                WHEN r.turno_actual IN ('medio_turno_manana', 'medio_turno_tarde', 'manana', 'tarde') THEN 0.5
                ELSE 1
              END
            ELSE r.horas_jornada_resueltas
          END$$
  );

  EXECUTE v_def;
END
$mig$;

DO $mig$
DECLARE
  v_def text;
  v_target text;
BEGIN
  SELECT pg_get_functiondef('public.fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)'::regprocedure)
  INTO v_def;

  v_target := $$    'Descanso programado',
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de descanso programado en fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$    'Descanso programado',
    CASE
      WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'lun_sab'
        AND extract(dow FROM a.fecha) = 0 THEN 0
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,$$
  );

  v_target := $$    CASE WHEN l.tipo = 'descanso_programado' THEN 'Descanso programado' ELSE 'Vacaciones' END,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,$$;
  IF position(v_target IN v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontro el bloque de vacaciones/licencias en fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid)';
  END IF;

  v_def := replace(
    v_def,
    v_target,
    $$    CASE WHEN l.tipo = 'descanso_programado' THEN 'Descanso programado' ELSE 'Vacaciones' END,
    CASE
      WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'lun_sab'
        AND extract(dow FROM d.fecha) = 0 THEN 0
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,$$
  );

  EXECUTE v_def;
END
$mig$;

INSERT INTO public.rrhh_liquidacion_reglas_periodo (
  periodo_mes,
  periodo_anio,
  dias_base_galpon,
  dias_base_sucursales,
  dias_base_rrhh,
  dias_base_lun_sab,
  activo
)
VALUES (3, 2026, 27, 31, 22, 26, true)
ON CONFLICT (periodo_mes, periodo_anio)
DO UPDATE SET
  dias_base_galpon = EXCLUDED.dias_base_galpon,
  dias_base_sucursales = EXCLUDED.dias_base_sucursales,
  dias_base_rrhh = EXCLUDED.dias_base_rrhh,
  dias_base_lun_sab = EXCLUDED.dias_base_lun_sab,
  activo = true,
  updated_at = now();

WITH configuracion AS (
  SELECT *
  FROM (
    VALUES
      ('Repartidor', 700000::numeric, 'lun_sab'::text, 9::numeric, 'turno'::text, 26923.07::numeric, false, 0::numeric),
      ('Tesoreria', 700000::numeric, 'lun_sab'::text, 9::numeric, 'hora'::text, 0::numeric, true, 0::numeric),
      ('Almacen', 650000::numeric, 'lun_sab'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Asistente Sucursal', 620000::numeric, 'sucursales'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Encargado Sucursal', 650000::numeric, 'sucursales'::text, 9::numeric, 'hora'::text, 0::numeric, true, 0::numeric),
      ('Produccion', 600000::numeric, 'lun_sab'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Ventas', 600000::numeric, 'galpon'::text, 8::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('RRHH', 900000::numeric, 'rrhh'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Limpieza', 550000::numeric, 'lun_sab'::text, 8::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Asist. 1/2 dia Sucursal', 310000::numeric, 'sucursales'::text, 4.5::numeric, 'hora'::text, 0::numeric, false, 0::numeric)
  ) AS t(nombre_categoria, sueldo_basico, grupo_base_dias, horas_jornada, tipo_calculo, tarifa_turno_trabajado, habilita_cajero, tarifa_diferencia_cajero)
),
categorias_objetivo AS (
  SELECT
    c.id AS categoria_id,
    c.nombre AS categoria_nombre,
    conf.sueldo_basico,
    conf.grupo_base_dias,
    conf.horas_jornada,
    conf.tipo_calculo,
    conf.tarifa_turno_trabajado,
    conf.habilita_cajero,
    conf.tarifa_diferencia_cajero
  FROM public.rrhh_categorias c
  JOIN configuracion conf
    ON public.fn_rrhh_normalizar_codigo_puesto(c.nombre) = public.fn_rrhh_normalizar_codigo_puesto(conf.nombre_categoria)
)
UPDATE public.rrhh_categorias c
SET
  sueldo_basico = co.sueldo_basico,
  updated_at = now()
FROM categorias_objetivo co
WHERE c.id = co.categoria_id
  AND c.sueldo_basico IS DISTINCT FROM co.sueldo_basico;

WITH configuracion AS (
  SELECT *
  FROM (
    VALUES
      ('Repartidor', 700000::numeric, 'lun_sab'::text, 9::numeric, 'turno'::text, 26923.07::numeric, false, 0::numeric),
      ('Tesoreria', 700000::numeric, 'lun_sab'::text, 9::numeric, 'hora'::text, 0::numeric, true, 0::numeric),
      ('Almacen', 650000::numeric, 'lun_sab'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Asistente Sucursal', 620000::numeric, 'sucursales'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Encargado Sucursal', 650000::numeric, 'sucursales'::text, 9::numeric, 'hora'::text, 0::numeric, true, 0::numeric),
      ('Produccion', 600000::numeric, 'lun_sab'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Ventas', 600000::numeric, 'galpon'::text, 8::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('RRHH', 900000::numeric, 'rrhh'::text, 9::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Limpieza', 550000::numeric, 'lun_sab'::text, 8::numeric, 'hora'::text, 0::numeric, false, 0::numeric),
      ('Asist. 1/2 dia Sucursal', 310000::numeric, 'sucursales'::text, 4.5::numeric, 'hora'::text, 0::numeric, false, 0::numeric)
  ) AS t(nombre_categoria, sueldo_basico, grupo_base_dias, horas_jornada, tipo_calculo, tarifa_turno_trabajado, habilita_cajero, tarifa_diferencia_cajero)
),
categorias_objetivo AS (
  SELECT
    c.id AS categoria_id,
    conf.nombre_categoria,
    conf.grupo_base_dias,
    conf.horas_jornada,
    conf.tipo_calculo,
    conf.tarifa_turno_trabajado,
    conf.habilita_cajero,
    conf.tarifa_diferencia_cajero
  FROM public.rrhh_categorias c
  JOIN configuracion conf
    ON public.fn_rrhh_normalizar_codigo_puesto(c.nombre) = public.fn_rrhh_normalizar_codigo_puesto(conf.nombre_categoria)
)
UPDATE public.rrhh_liquidacion_reglas_puesto rp
SET
  categoria_id = co.categoria_id,
  grupo_base_dias = co.grupo_base_dias,
  horas_jornada = co.horas_jornada,
  tipo_calculo = co.tipo_calculo,
  tarifa_turno_trabajado = co.tarifa_turno_trabajado,
  habilita_cajero = co.habilita_cajero,
  tarifa_diferencia_cajero = co.tarifa_diferencia_cajero,
  activo = true,
  updated_at = now()
FROM categorias_objetivo co
WHERE rp.categoria_id = co.categoria_id
   OR public.fn_rrhh_normalizar_codigo_puesto(rp.puesto_codigo) = public.fn_rrhh_normalizar_codigo_puesto(co.nombre_categoria);

WITH configuracion AS (
  SELECT *
  FROM (
    VALUES
      ('Repartidor', 700000::numeric, 'lun_sab'::text, 9::numeric),
      ('Tesoreria', 700000::numeric, 'lun_sab'::text, 9::numeric),
      ('Almacen', 650000::numeric, 'lun_sab'::text, 9::numeric),
      ('Asistente Sucursal', 620000::numeric, 'sucursales'::text, 9::numeric),
      ('Encargado Sucursal', 650000::numeric, 'sucursales'::text, 9::numeric),
      ('Produccion', 600000::numeric, 'lun_sab'::text, 9::numeric),
      ('Ventas', 600000::numeric, 'galpon'::text, 8::numeric),
      ('RRHH', 900000::numeric, 'rrhh'::text, 9::numeric),
      ('Limpieza', 550000::numeric, 'lun_sab'::text, 8::numeric),
      ('Asist. 1/2 dia Sucursal', 310000::numeric, 'sucursales'::text, 4.5::numeric)
  ) AS t(nombre_categoria, sueldo_basico, grupo_base_dias, horas_jornada)
),
categorias_objetivo AS (
  SELECT
    c.id AS categoria_id,
    conf.sueldo_basico,
    conf.grupo_base_dias,
    conf.horas_jornada
  FROM public.rrhh_categorias c
  JOIN configuracion conf
    ON public.fn_rrhh_normalizar_codigo_puesto(c.nombre) = public.fn_rrhh_normalizar_codigo_puesto(conf.nombre_categoria)
),
empleados_actualizados AS (
  UPDATE public.rrhh_empleados e
  SET
    sueldo_actual = co.sueldo_basico,
    valor_jornal_presentismo = trunc(
      co.sueldo_basico / CASE
        WHEN co.grupo_base_dias = 'sucursales' THEN 31
        WHEN co.grupo_base_dias = 'rrhh' THEN 22
        WHEN co.grupo_base_dias = 'lun_sab' THEN 26
        ELSE 27
      END,
      2
    ),
    valor_hora = trunc(
      trunc(
        co.sueldo_basico / CASE
          WHEN co.grupo_base_dias = 'sucursales' THEN 31
          WHEN co.grupo_base_dias = 'rrhh' THEN 22
          WHEN co.grupo_base_dias = 'lun_sab' THEN 26
          ELSE 27
        END,
        2
      ) / nullif(co.horas_jornada, 0),
      2
    ),
    updated_at = now()
  FROM categorias_objetivo co
  WHERE e.categoria_id = co.categoria_id
    AND e.activo = true
  RETURNING e.id
)
SELECT count(*) FROM empleados_actualizados;

WITH candidatos AS (
  SELECT
    e.id,
    '01' || regexp_replace(coalesce(e.dni, ''), '\D', '', 'g') AS nuevo_legajo,
    COUNT(*) OVER (
      PARTITION BY '01' || regexp_replace(coalesce(e.dni, ''), '\D', '', 'g')
    ) AS repeticiones
  FROM public.rrhh_empleados e
  WHERE coalesce(trim(e.dni), '') <> ''
),
validos AS (
  SELECT id, nuevo_legajo
  FROM candidatos
  WHERE repeticiones = 1
    AND nuevo_legajo <> '01'
)
UPDATE public.rrhh_empleados e
SET
  legajo = v.nuevo_legajo,
  updated_at = now()
FROM validos v
WHERE e.id = v.id
  AND coalesce(e.legajo, '') <> v.nuevo_legajo;

DO $mig$
DECLARE
  v_empleado record;
BEGIN
  FOR v_empleado IN
    SELECT DISTINCT l.empleado_id
    FROM public.rrhh_liquidaciones l
    WHERE l.periodo_mes = 3
      AND l.periodo_anio = 2026
  LOOP
    PERFORM public.fn_rrhh_preparar_liquidacion_mensual(
      v_empleado.empleado_id,
      3,
      2026,
      NULL
    );
  END LOOP;
END
$mig$;

COMMIT;
