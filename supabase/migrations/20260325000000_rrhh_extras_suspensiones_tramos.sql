BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.fn_rrhh_normalizar_codigo_puesto(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT regexp_replace(
    replace(
      replace(
        replace(
          lower(public.unaccent(coalesce(p_text, ''))),
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

ALTER TABLE public.rrhh_liquidacion_jornadas
  ADD COLUMN IF NOT EXISTS horas_extra_aprobadas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS horas_extra_aprobadas_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS horas_extra_aprobadas_at timestamptz;

UPDATE public.rrhh_liquidacion_jornadas
SET
  horas_extra_aprobadas = true,
  updated_at = now()
WHERE horas_extra_aprobadas IS DISTINCT FROM true;

UPDATE public.rrhh_liquidacion_jornadas
SET
  origen = 'manual',
  updated_at = now()
WHERE origen NOT IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'auto_suspension', 'manual');

ALTER TABLE public.rrhh_liquidacion_jornadas
  DROP CONSTRAINT IF EXISTS rrhh_liquidacion_jornadas_origen_check;

ALTER TABLE public.rrhh_liquidacion_jornadas
  ADD CONSTRAINT rrhh_liquidacion_jornadas_origen_check
  CHECK (
    origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'auto_suspension', 'manual')
  );

CREATE TABLE IF NOT EXISTS public.rrhh_liquidacion_tramos_puesto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id uuid NOT NULL REFERENCES public.rrhh_liquidaciones(id) ON DELETE CASCADE,
  fecha_desde date NOT NULL,
  fecha_hasta date NOT NULL,
  puesto_codigo text NOT NULL,
  orden integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_hasta >= fecha_desde)
);

ALTER TABLE public.rrhh_liquidacion_tramos_puesto
  DROP CONSTRAINT IF EXISTS rrhh_liquidacion_tramos_puesto_no_overlap;

ALTER TABLE public.rrhh_liquidacion_tramos_puesto
  ADD CONSTRAINT rrhh_liquidacion_tramos_puesto_no_overlap
  EXCLUDE USING gist (
    liquidacion_id WITH =,
    daterange(fecha_desde, fecha_hasta, '[]') WITH &&
  );

CREATE INDEX IF NOT EXISTS idx_rrhh_liquidacion_tramos_puesto_liquidacion
  ON public.rrhh_liquidacion_tramos_puesto(liquidacion_id, orden, fecha_desde);

ALTER TABLE public.rrhh_liquidacion_tramos_puesto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_liquidacion_tramos_puesto" ON public.rrhh_liquidacion_tramos_puesto;
CREATE POLICY "Admin full access on rrhh_liquidacion_tramos_puesto"
ON public.rrhh_liquidacion_tramos_puesto
FOR ALL
USING (auth.jwt() ->> 'rol' = 'admin')
WITH CHECK (auth.jwt() ->> 'rol' = 'admin');

CREATE OR REPLACE FUNCTION public.fn_rrhh_reemplazar_tramos_puesto(
  p_liquidacion_id uuid,
  p_actor uuid,
  p_tramos jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  DELETE FROM public.rrhh_liquidacion_tramos_puesto
  WHERE liquidacion_id = p_liquidacion_id;

  INSERT INTO public.rrhh_liquidacion_tramos_puesto (
    liquidacion_id,
    fecha_desde,
    fecha_hasta,
    puesto_codigo,
    orden,
    created_by
  )
  SELECT
    p_liquidacion_id,
    tramo.fecha_desde,
    tramo.fecha_hasta,
    tramo.puesto_codigo,
    coalesce(tramo.orden, row_number() OVER (ORDER BY tramo.fecha_desde, tramo.fecha_hasta, tramo.puesto_codigo)),
    p_actor
  FROM jsonb_to_recordset(coalesce(p_tramos, '[]'::jsonb)) AS tramo(
    fecha_desde date,
    fecha_hasta date,
    puesto_codigo text,
    orden integer
  )
  ORDER BY coalesce(tramo.orden, 2147483647), tramo.fecha_desde, tramo.fecha_hasta, tramo.puesto_codigo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_normalizar_turno_suspension(p_turno text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(trim(p_turno), '') = '' THEN 'turno_completo'
    WHEN public.fn_rrhh_normalizar_codigo_puesto(p_turno) LIKE '%tarde%' THEN 'tarde'
    WHEN public.fn_rrhh_normalizar_codigo_puesto(p_turno) LIKE '%manana%' THEN 'manana'
    ELSE 'turno_completo'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_suspension_fraccion_para_fecha(
  p_fecha_obj date,
  p_fecha_inicio date,
  p_turno_inicio text,
  p_fecha_reintegro date,
  p_turno_reintegro text,
  p_dias integer
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_turno_inicio text := public.fn_rrhh_normalizar_turno_suspension(p_turno_inicio);
  v_turno_reintegro text := public.fn_rrhh_normalizar_turno_suspension(p_turno_reintegro);
  v_fecha_fin date;
BEGIN
  IF p_fecha_inicio IS NULL OR p_fecha_obj IS NULL THEN
    RETURN 0;
  END IF;

  IF p_fecha_reintegro IS NOT NULL THEN
    IF p_fecha_obj < p_fecha_inicio OR p_fecha_obj > p_fecha_reintegro THEN
      RETURN 0;
    END IF;

    IF p_fecha_obj = p_fecha_inicio AND p_fecha_obj = p_fecha_reintegro THEN
      IF v_turno_inicio = 'tarde' OR v_turno_reintegro = 'tarde' THEN
        RETURN 0.5;
      END IF;
      RETURN 0;
    END IF;

    IF p_fecha_obj = p_fecha_inicio THEN
      IF v_turno_inicio = 'tarde' THEN
        RETURN 0.5;
      END IF;
      RETURN 1;
    END IF;

    IF p_fecha_obj = p_fecha_reintegro THEN
      IF v_turno_reintegro = 'tarde' THEN
        RETURN 0.5;
      END IF;
      RETURN 0;
    END IF;

    RETURN 1;
  END IF;

  v_fecha_fin := p_fecha_inicio + GREATEST(COALESCE(p_dias, 1) - 1, 0);

  IF p_fecha_obj < p_fecha_inicio OR p_fecha_obj > v_fecha_fin THEN
    RETURN 0;
  END IF;

  IF p_fecha_obj = p_fecha_inicio AND v_turno_inicio = 'tarde' THEN
    RETURN 0.5;
  END IF;

  RETURN 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_suspension_turno_para_fecha(
  p_fecha_obj date,
  p_fecha_inicio date,
  p_turno_inicio text,
  p_fecha_reintegro date,
  p_turno_reintegro text,
  p_dias integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_fraccion numeric := public.fn_rrhh_suspension_fraccion_para_fecha(
    p_fecha_obj,
    p_fecha_inicio,
    p_turno_inicio,
    p_fecha_reintegro,
    p_turno_reintegro,
    p_dias
  );
  v_turno_inicio text := public.fn_rrhh_normalizar_turno_suspension(p_turno_inicio);
  v_turno_reintegro text := public.fn_rrhh_normalizar_turno_suspension(p_turno_reintegro);
BEGIN
  IF v_fraccion >= 1 THEN
    RETURN 'suspension_completa';
  END IF;

  IF v_fraccion <= 0 THEN
    RETURN NULL;
  END IF;

  IF p_fecha_reintegro IS NOT NULL AND p_fecha_obj = p_fecha_reintegro AND v_turno_reintegro = 'tarde' THEN
    RETURN 'suspension_manana';
  END IF;

  IF p_fecha_obj = p_fecha_inicio AND v_turno_inicio = 'tarde' THEN
    RETURN 'suspension_tarde';
  END IF;

  RETURN 'suspension_manana';
END;
$function$;

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
        nullif(metadata -> 'suspension' ->> 'fecha_inicio', '')::date,
        fecha_evento::date
      ) AS fecha_inicio,
      nullif(metadata -> 'suspension' ->> 'turno_inicio', '') AS turno_inicio,
      nullif(metadata -> 'suspension' ->> 'fecha_reintegro', '')::date AS fecha_reintegro,
      nullif(metadata -> 'suspension' ->> 'turno_reintegro', '') AS turno_reintegro,
      nullif(metadata -> 'suspension' ->> 'dias', '')::integer AS suspension_dias,
      coalesce(nullif(descripcion, ''), nullif(titulo, ''), 'Suspension disciplinaria') AS descripcion
    FROM public.rrhh_legajo_eventos
    WHERE empleado_id = p_empleado_id
      AND coalesce(metadata ->> 'flujo', '') = 'disciplinario'
      AND coalesce(metadata ->> 'etapa', '') = 'suspension'
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
      e.descripcion
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
    string_agg(d.descripcion, ' | ' ORDER BY d.descripcion) AS descripcion
  FROM dias d
  WHERE d.fraccion_suspension > 0
  GROUP BY d.fecha
  ORDER BY d.fecha;
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

  v_override := coalesce(
    nullif(v_puesto_tramo, ''),
    nullif(p_puesto_fallback, ''),
    nullif(v_liq.puesto_override, '')
  );

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

CREATE OR REPLACE FUNCTION public.fn_rrhh_recalcular_liquidacion(
  p_liquidacion_id uuid,
  p_actor uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_liq rrhh_liquidaciones%ROWTYPE;
  v_regla RECORD;
  v_horas_mensuales DECIMAL := 0;
  v_horas_extras DECIMAL := 0;
  v_turno_especial DECIMAL := 0;
  v_monto_mensual DECIMAL := 0;
  v_monto_extra DECIMAL := 0;
  v_monto_turno DECIMAL := 0;
  v_dias_trabajados INTEGER := 0;
  v_turnos INTEGER := 0;
  v_descuento_presentismo DECIMAL := 0;
  v_presentismo_teorico DECIMAL := 0;
  v_presentismo_pagado DECIMAL := 0;
  v_descuentos_adicionales DECIMAL := 0;
  v_adel_mercaderia DECIMAL := 0;
  v_adel_efectivo DECIMAL := 0;
  v_adelantos_total DECIMAL := 0;
  v_total_cajero DECIMAL := 0;
  v_tarifa_cajero_aplicada DECIMAL := 0;
  v_total_s_descuentos DECIMAL := 0;
  v_descuentos_total DECIMAL := 0;
  v_total_neto DECIMAL := 0;
  v_limite_30 DECIMAL := 0;
  v_superado BOOLEAN := false;
  v_total_por_dia DECIMAL := 0;
  v_mes_completo BOOLEAN := false;
  v_tiene_infracciones BOOLEAN := false;
BEGIN
  SELECT * INTO v_liq FROM public.rrhh_liquidaciones WHERE id = p_liquidacion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidacion % no encontrada', p_liquidacion_id;
  END IF;

  SELECT *
  INTO v_regla
  FROM public.fn_rrhh_resolver_regla_puesto(v_liq.empleado_id, v_liq.periodo_mes, v_liq.periodo_anio, v_liq.puesto_override);

  WITH suspension_days AS (
    SELECT *
    FROM public.fn_rrhh_suspensiones_periodo(v_liq.empleado_id, v_liq.periodo_mes, v_liq.periodo_anio)
  ),
  recalculo AS (
    SELECT
      j.id,
      j.origen,
      j.turno,
      j.tarea,
      j.observaciones,
      j.horas_extra_aprobadas,
      coalesce(base_rule.grupo_base_dias, 'galpon') AS grupo_base_dias,
      coalesce(base_rule.tipo_calculo, 'hora') AS tipo_calculo,
      coalesce(base_rule.horas_jornada, 9) AS horas_jornada_resueltas,
      coalesce(base_rule.valor_hora, 0) AS valor_hora_base,
      coalesce(extra_rule.valor_hora, base_rule.valor_hora, 0) AS valor_hora_extra,
      coalesce(base_rule.tarifa_turno_especial, 0) AS tarifa_turno_especial_resuelta,
      coalesce(nullif(base_rule.tarifa_turno_trabajado, 0), base_rule.valor_jornal, 0) AS tarifa_turno_resuelta,
      coalesce(a.horas_trabajadas, 0) AS horas_asistencia,
      lower(coalesce(a.turno, j.turno, 'general')) AS turno_asistencia,
      coalesce(sd.fraccion_suspension, 0) AS fraccion_suspension,
      coalesce(sd.turno_codigo, 'suspension_completa') AS turno_suspension,
      coalesce(sd.descripcion, 'Suspension disciplinaria') AS descripcion_suspension,
      (
        extract(dow FROM j.fecha) = 0
        OR EXISTS (
          SELECT 1
          FROM public.rrhh_feriados f
          WHERE f.fecha = j.fecha
            AND f.activo = true
        )
      ) AS es_domingo_o_feriado,
      lower(coalesce(j.turno, '')) AS turno_actual,
      lower(coalesce(j.tarea, '')) AS tarea_actual
    FROM public.rrhh_liquidacion_jornadas j
    LEFT JOIN public.rrhh_asistencia a
      ON a.empleado_id = j.empleado_id
     AND a.fecha = j.fecha
    LEFT JOIN suspension_days sd
      ON sd.fecha = j.fecha
    CROSS JOIN LATERAL public.fn_rrhh_resolver_regla_liquidacion_dia(
      p_liquidacion_id,
      j.fecha,
      NULL
    ) base_rule
    CROSS JOIN LATERAL public.fn_rrhh_resolver_regla_liquidacion_dia(
      p_liquidacion_id,
      j.fecha,
      v_liq.puesto_hs_extra
    ) extra_rule
    WHERE j.liquidacion_id = p_liquidacion_id
      AND j.origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'auto_suspension')
  ),
  resueltas AS (
    SELECT
      r.id,
      r.grupo_base_dias,
      CASE
        WHEN r.origen = 'auto_suspension' THEN 0
        WHEN r.origen = 'auto_licencia_descanso' THEN
          CASE
            WHEN r.tipo_calculo = 'turno' THEN
              CASE
                WHEN r.turno_actual IN ('medio_turno_manana', 'medio_turno_tarde', 'manana', 'tarde') THEN 0.5
                ELSE 1
              END
            ELSE r.horas_jornada_resueltas
          END
        WHEN r.tipo_calculo = 'turno' THEN
          CASE
            WHEN r.fraccion_suspension >= 1 THEN 0
            WHEN r.fraccion_suspension >= 0.5 THEN 0.5
            WHEN r.turno_asistencia IN ('medio_turno_manana', 'medio_turno_tarde', 'manana', 'tarde')
              OR r.turno_asistencia LIKE 'ma%ana'
              THEN 0.5
            ELSE 1
          END
        ELSE
          CASE
            WHEN r.fraccion_suspension >= 1 THEN 0
            WHEN r.fraccion_suspension >= 0.5 THEN
              least(
                r.horas_asistencia,
                CASE
                  WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN 4.5
                  ELSE r.horas_jornada_resueltas / 2
                END
              )
            WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN least(r.horas_asistencia, 9)
            ELSE least(r.horas_asistencia, r.horas_jornada_resueltas)
          END
      END AS horas_mensuales_resueltas,
      CASE
        WHEN r.origen IN ('auto_licencia_descanso', 'auto_suspension') THEN 0
        WHEN r.tipo_calculo = 'turno' THEN 0
        WHEN r.fraccion_suspension > 0 THEN 0
        WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN greatest(r.horas_asistencia - 9, 0)
        ELSE greatest(r.horas_asistencia - r.horas_jornada_resueltas, 0)
      END AS horas_adicionales_resueltas,
      0::numeric AS turno_especial_unidades_resueltas,
      CASE
        WHEN r.origen = 'auto_suspension' THEN 0
        WHEN r.tipo_calculo = 'turno' THEN r.tarifa_turno_resuelta
        ELSE r.valor_hora_base
      END AS tarifa_hora_base_resuelta,
      CASE
        WHEN r.origen = 'auto_suspension' OR r.tipo_calculo = 'turno' THEN 0
        ELSE r.valor_hora_extra
      END AS tarifa_hora_extra_resuelta,
      CASE
        WHEN r.origen = 'auto_suspension' THEN 0
        ELSE r.tarifa_turno_especial_resuelta
      END AS tarifa_turno_especial_resuelta,
      CASE
        WHEN r.origen = 'auto_suspension' THEN r.turno_suspension
        ELSE NULL
      END AS turno_resuelto,
      CASE
        WHEN r.origen = 'auto_suspension' THEN 'Suspension disciplinaria'
        ELSE NULL
      END AS tarea_resuelta,
      CASE
        WHEN r.origen = 'auto_suspension' THEN r.descripcion_suspension
        ELSE NULL
      END AS observaciones_resueltas,
      CASE
        WHEN r.origen = 'auto_suspension' THEN true
        WHEN
          CASE
            WHEN r.origen IN ('auto_licencia_descanso', 'auto_suspension') THEN 0
            WHEN r.tipo_calculo = 'turno' THEN 0
            WHEN r.fraccion_suspension > 0 THEN 0
            WHEN r.grupo_base_dias = 'sucursales' AND r.es_domingo_o_feriado THEN greatest(r.horas_asistencia - 9, 0)
            ELSE greatest(r.horas_asistencia - r.horas_jornada_resueltas, 0)
          END <= 0 THEN true
        WHEN r.grupo_base_dias = 'sucursales' THEN true
        ELSE coalesce(r.horas_extra_aprobadas, false)
      END AS horas_extra_aprobadas_resueltas
    FROM recalculo r
  )
  UPDATE public.rrhh_liquidacion_jornadas j
  SET
    turno = coalesce(r.turno_resuelto, j.turno),
    tarea = coalesce(r.tarea_resuelta, j.tarea),
    observaciones = coalesce(r.observaciones_resueltas, j.observaciones),
    horas_mensuales = r.horas_mensuales_resueltas,
    horas_adicionales = r.horas_adicionales_resueltas,
    turno_especial_unidades = r.turno_especial_unidades_resueltas,
    tarifa_hora_base = r.tarifa_hora_base_resuelta,
    tarifa_hora_extra = r.tarifa_hora_extra_resuelta,
    tarifa_turno_especial = r.tarifa_turno_especial_resuelta,
    horas_extra_aprobadas = r.horas_extra_aprobadas_resueltas,
    updated_at = now()
  FROM resueltas r
  WHERE j.id = r.id;

  SELECT
    coalesce(sum(j.horas_mensuales), 0),
    coalesce(sum(j.horas_adicionales), 0),
    coalesce(sum(j.turno_especial_unidades), 0),
    coalesce(sum(j.monto_mensual), 0),
    coalesce(
      sum(
        CASE
          WHEN coalesce(regla_dia.grupo_base_dias, 'galpon') = 'sucursales' THEN 0
          WHEN coalesce(j.horas_extra_aprobadas, false) = false THEN 0
          ELSE j.monto_extra
        END
      ),
      0
    ),
    coalesce(sum(j.monto_turno_especial), 0),
    coalesce(
      count(
        DISTINCT CASE
          WHEN coalesce(j.horas_mensuales, 0) > 0
            OR coalesce(j.horas_adicionales, 0) > 0
            OR coalesce(j.turno_especial_unidades, 0) > 0
            THEN j.fecha
          ELSE NULL
        END
      ),
      0
    ),
    coalesce(
      count(
        CASE
          WHEN coalesce(j.horas_mensuales, 0) > 0
            OR coalesce(j.horas_adicionales, 0) > 0
            OR coalesce(j.turno_especial_unidades, 0) > 0
            THEN 1
          ELSE NULL
        END
      ),
      0
    )
  INTO v_horas_mensuales, v_horas_extras, v_turno_especial, v_monto_mensual, v_monto_extra, v_monto_turno, v_dias_trabajados, v_turnos
  FROM public.rrhh_liquidacion_jornadas j
  CROSS JOIN LATERAL public.fn_rrhh_resolver_regla_liquidacion_dia(
    p_liquidacion_id,
    j.fecha,
    NULL
  ) regla_dia
  WHERE j.liquidacion_id = p_liquidacion_id;

  SELECT coalesce(sum(monto), 0)
  INTO v_descuentos_adicionales
  FROM public.rrhh_descuentos
  WHERE empleado_id = v_liq.empleado_id
    AND aprobado = true
    AND extract(MONTH FROM fecha) = v_liq.periodo_mes
    AND extract(YEAR FROM fecha) = v_liq.periodo_anio;

  v_presentismo_teorico := 30000;

  v_mes_completo := CURRENT_DATE > (
    date_trunc('month', make_date(v_liq.periodo_anio, v_liq.periodo_mes, 1)) + interval '1 month - 1 day'
  )::date;

  SELECT EXISTS (
    SELECT 1
    FROM public.rrhh_asistencia a
    WHERE a.empleado_id = v_liq.empleado_id
      AND extract(MONTH FROM a.fecha) = v_liq.periodo_mes
      AND extract(YEAR FROM a.fecha) = v_liq.periodo_anio
      AND (
        a.falta_sin_aviso = true
        OR coalesce(a.retraso_minutos, 0) > 15
      )
  ) INTO v_tiene_infracciones;

  IF v_mes_completo AND NOT v_tiene_infracciones THEN
    v_presentismo_pagado := 30000;
    v_descuento_presentismo := 0;
  ELSE
    v_presentismo_pagado := 0;
    v_descuento_presentismo := 30000;
  END IF;

  SELECT
    coalesce(sum(CASE WHEN p.tipo = 'producto' THEN c.monto_cuota ELSE 0 END), 0),
    coalesce(sum(CASE WHEN p.tipo = 'dinero' THEN c.monto_cuota ELSE 0 END), 0)
  INTO v_adel_mercaderia, v_adel_efectivo
  FROM public.rrhh_adelanto_cuotas c
  JOIN public.rrhh_adelanto_planes p ON p.id = c.plan_id
  WHERE p.empleado_id = v_liq.empleado_id
    AND c.periodo_mes = v_liq.periodo_mes
    AND c.periodo_anio = v_liq.periodo_anio
    AND c.estado IN ('pendiente', 'aplicada');

  IF coalesce(v_adel_mercaderia, 0) = 0 AND coalesce(v_adel_efectivo, 0) = 0 THEN
    SELECT
      coalesce(sum(CASE WHEN a.tipo = 'producto' THEN coalesce(a.monto, coalesce(a.cantidad, 0) * coalesce(a.precio_unitario, 0)) ELSE 0 END), 0),
      coalesce(sum(CASE WHEN a.tipo = 'dinero' THEN coalesce(a.monto, 0) ELSE 0 END), 0)
    INTO v_adel_mercaderia, v_adel_efectivo
    FROM public.rrhh_adelantos a
    WHERE a.empleado_id = v_liq.empleado_id
      AND a.aprobado = true
      AND extract(MONTH FROM coalesce(a.fecha_aprobacion, a.fecha_solicitud)) = v_liq.periodo_mes
      AND extract(YEAR FROM coalesce(a.fecha_aprobacion, a.fecha_solicitud)) = v_liq.periodo_anio;
  END IF;

  UPDATE public.rrhh_adelanto_cuotas c
  SET
    estado = 'aplicada',
    liquidacion_id = p_liquidacion_id,
    updated_at = now()
  FROM public.rrhh_adelanto_planes p
  WHERE p.id = c.plan_id
    AND p.empleado_id = v_liq.empleado_id
    AND c.periodo_mes = v_liq.periodo_mes
    AND c.periodo_anio = v_liq.periodo_anio
    AND c.estado = 'pendiente';

  v_tarifa_cajero_aplicada := CASE
    WHEN coalesce(v_regla.habilita_cajero, false) THEN
      CASE
        WHEN coalesce(v_liq.diferencia_turno_cajero, 0) > 0 THEN v_liq.diferencia_turno_cajero
        ELSE coalesce(v_regla.tarifa_diferencia_cajero, 0)
      END
    ELSE coalesce(v_liq.diferencia_turno_cajero, 0)
  END;

  v_total_cajero := round(coalesce(v_liq.dias_cajero, 0) * coalesce(v_tarifa_cajero_aplicada, 0), 2);
  v_total_s_descuentos := round(
    coalesce(v_monto_mensual, 0)
    + coalesce(v_monto_extra, 0)
    + coalesce(v_monto_turno, 0)
    + coalesce(v_total_cajero, 0)
    + coalesce(v_presentismo_pagado, 0),
    2
  );
  v_adelantos_total := round(coalesce(v_adel_mercaderia, 0) + coalesce(v_adel_efectivo, 0), 2);
  v_descuentos_total := round(coalesce(v_descuento_presentismo, 0) + coalesce(v_descuentos_adicionales, 0), 2);
  v_limite_30 := round(v_total_s_descuentos * 0.30, 2);
  v_superado := v_adelantos_total > v_limite_30;
  v_total_neto := round(v_total_s_descuentos - v_adelantos_total - v_descuentos_total, 2);

  IF v_dias_trabajados > 0 THEN
    v_total_por_dia := round(v_total_neto / v_dias_trabajados, 2);
  ELSE
    v_total_por_dia := 0;
  END IF;

  UPDATE public.rrhh_liquidaciones
  SET
    sueldo_basico = coalesce(v_regla.sueldo_basico, sueldo_basico),
    dias_base = coalesce(v_regla.dias_base, dias_base),
    horas_jornada = coalesce(v_regla.horas_jornada, horas_jornada),
    valor_jornal = coalesce(v_regla.valor_jornal, valor_jornal),
    valor_hora = coalesce(v_regla.valor_hora, valor_hora),
    valor_hora_extra = coalesce(v_regla.valor_hora, valor_hora_extra),
    diferencia_turno_cajero = coalesce(v_tarifa_cajero_aplicada, 0),
    horas_trabajadas = coalesce(v_horas_mensuales, 0) + coalesce(v_horas_extras, 0),
    horas_extras = coalesce(v_horas_extras, 0),
    turnos_trabajados = coalesce(v_turnos, 0),
    total_cajero = coalesce(v_total_cajero, 0),
    total_sin_descuentos = coalesce(v_total_s_descuentos, 0),
    total_bruto = coalesce(v_total_s_descuentos, 0),
    descuento_presentismo = coalesce(v_descuento_presentismo, 0),
    presentismo_teorico = coalesce(v_presentismo_teorico, 0),
    presentismo_perdido = coalesce(v_descuento_presentismo, 0),
    presentismo_pagado = coalesce(v_presentismo_pagado, 0),
    descuentos_total = coalesce(v_descuentos_total, 0),
    adelanto_mercaderia_total = coalesce(v_adel_mercaderia, 0),
    adelanto_efectivo_total = coalesce(v_adel_efectivo, 0),
    adelantos_total = coalesce(v_adelantos_total, 0),
    control_30_limite = coalesce(v_limite_30, 0),
    control_30_anticipos = coalesce(v_adelantos_total, 0),
    control_30_superado = coalesce(v_superado, false),
    total_neto = coalesce(v_total_neto, 0),
    total_por_dia = coalesce(v_total_por_dia, 0),
    estado = CASE
      WHEN estado = 'pagada' THEN 'pagada'
      WHEN estado = 'aprobada' THEN 'aprobada'
      ELSE 'calculada'
    END,
    updated_at = now()
  WHERE id = p_liquidacion_id;

  DELETE FROM public.rrhh_liquidacion_detalles WHERE liquidacion_id = p_liquidacion_id;

  INSERT INTO public.rrhh_liquidacion_detalles (liquidacion_id, tipo, descripcion, monto)
  VALUES
    (p_liquidacion_id, 'sueldo_basico', 'Sueldo base del periodo', coalesce(v_regla.sueldo_basico, 0)),
    (p_liquidacion_id, 'presentismo', 'Presentismo del periodo', coalesce(v_presentismo_pagado, 0)),
    (p_liquidacion_id, 'horas_mensuales', 'Pago horas diarias', coalesce(v_monto_mensual, 0)),
    (p_liquidacion_id, 'horas_extras', 'Pago horas extra aprobadas', coalesce(v_monto_extra, 0)),
    (p_liquidacion_id, 'turnos_especiales', 'Pago turnos especiales', coalesce(v_monto_turno, 0)),
    (p_liquidacion_id, 'adicional_cajero', 'Total dias como cajero', coalesce(v_total_cajero, 0)),
    (p_liquidacion_id, 'descuento_presentismo', 'Descuento por presentismo', -coalesce(v_descuento_presentismo, 0)),
    (p_liquidacion_id, 'descuentos_adicionales', 'Descuentos adicionales aprobados', -coalesce(v_descuentos_adicionales, 0)),
    (p_liquidacion_id, 'adelanto_mercaderia', 'Adelantos mercaderia del periodo', -coalesce(v_adel_mercaderia, 0)),
    (p_liquidacion_id, 'adelanto_efectivo', 'Adelantos efectivo del periodo', -coalesce(v_adel_efectivo, 0)),
    (p_liquidacion_id, 'total_neto', 'Total a percibir', coalesce(v_total_neto, 0));

  RETURN p_liquidacion_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.fn_rrhh_preparar_liquidacion_mensual(uuid, integer, integer, uuid);

CREATE FUNCTION public.fn_rrhh_preparar_liquidacion_mensual(
  p_empleado_id uuid,
  p_mes integer,
  p_anio integer,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_liquidacion_id uuid;
  v_regla RECORD;
  v_empleado RECORD;
BEGIN
  SELECT *
  INTO v_regla
  FROM public.fn_rrhh_resolver_regla_puesto(p_empleado_id, p_mes, p_anio, NULL);

  SELECT
    e.sucursal_id,
    s.nombre AS sucursal_nombre
  INTO v_empleado
  FROM public.rrhh_empleados e
  LEFT JOIN public.sucursales s ON s.id = e.sucursal_id
  WHERE e.id = p_empleado_id;

  INSERT INTO public.rrhh_liquidaciones (
    empleado_id,
    periodo_mes,
    periodo_anio,
    fecha_liquidacion,
    sueldo_basico,
    valor_hora_extra,
    total_bruto,
    total_neto,
    estado,
    created_by,
    dias_base,
    horas_jornada,
    valor_jornal,
    valor_hora,
    grupo_base_snapshot,
    sucursal_snapshot_id,
    sucursal_snapshot_nombre,
    presentismo_teorico,
    presentismo_perdido,
    presentismo_pagado
  ) VALUES (
    p_empleado_id,
    p_mes,
    p_anio,
    CURRENT_DATE,
    coalesce(v_regla.sueldo_basico, 0),
    coalesce(v_regla.valor_hora, 0),
    0,
    0,
    'calculada',
    p_created_by,
    coalesce(v_regla.dias_base, 30),
    coalesce(v_regla.horas_jornada, 9),
    coalesce(v_regla.valor_jornal, 0),
    coalesce(v_regla.valor_hora, 0),
    coalesce(v_regla.grupo_base_dias, 'galpon'),
    v_empleado.sucursal_id,
    v_empleado.sucursal_nombre,
    coalesce(v_regla.valor_jornal, 0),
    0,
    coalesce(v_regla.valor_jornal, 0)
  )
  ON CONFLICT (empleado_id, periodo_mes, periodo_anio)
  DO UPDATE SET
    updated_at = now(),
    created_by = coalesce(EXCLUDED.created_by, rrhh_liquidaciones.created_by),
    fecha_liquidacion = CURRENT_DATE,
    sueldo_basico = EXCLUDED.sueldo_basico,
    dias_base = EXCLUDED.dias_base,
    horas_jornada = EXCLUDED.horas_jornada,
    valor_jornal = EXCLUDED.valor_jornal,
    valor_hora = EXCLUDED.valor_hora,
    valor_hora_extra = EXCLUDED.valor_hora_extra,
    grupo_base_snapshot = EXCLUDED.grupo_base_snapshot,
    sucursal_snapshot_id = EXCLUDED.sucursal_snapshot_id,
    sucursal_snapshot_nombre = EXCLUDED.sucursal_snapshot_nombre,
    presentismo_teorico = EXCLUDED.presentismo_teorico,
    presentismo_pagado = EXCLUDED.presentismo_pagado
  RETURNING id INTO v_liquidacion_id;

  PERFORM public.fn_rrhh_propagar_descansos_periodo(p_mes, p_anio, p_empleado_id);

  DROP TABLE IF EXISTS tmp_rrhh_jornada_aprobaciones;
  CREATE TEMP TABLE tmp_rrhh_jornada_aprobaciones ON COMMIT DROP AS
  SELECT
    fecha,
    origen,
    horas_extra_aprobadas,
    horas_extra_aprobadas_por,
    horas_extra_aprobadas_at
  FROM public.rrhh_liquidacion_jornadas
  WHERE liquidacion_id = v_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'auto_suspension');

  DELETE FROM public.rrhh_liquidacion_jornadas
  WHERE liquidacion_id = v_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'auto_suspension');

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    horas_extra_aprobadas_por,
    horas_extra_aprobadas_at,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    base.fecha,
    base.turno,
    base.tarea,
    base.horas_mensuales,
    base.horas_adicionales,
    0,
    base.tarifa_hora_base,
    base.tarifa_hora_extra,
    coalesce(v_regla.tarifa_turno_especial, 0),
    CASE
      WHEN base.horas_adicionales <= 0 THEN true
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN true
      WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'sucursales' THEN true
      ELSE coalesce(prev.horas_extra_aprobadas, false)
    END,
    CASE
      WHEN base.horas_adicionales > 0 AND coalesce(v_regla.grupo_base_dias, 'galpon') <> 'sucursales' AND coalesce(prev.horas_extra_aprobadas, false)
        THEN prev.horas_extra_aprobadas_por
      ELSE NULL
    END,
    CASE
      WHEN base.horas_adicionales > 0 AND coalesce(v_regla.grupo_base_dias, 'galpon') <> 'sucursales' AND coalesce(prev.horas_extra_aprobadas, false)
        THEN prev.horas_extra_aprobadas_at
      ELSE NULL
    END,
    base.origen,
    base.observaciones
  FROM (
    SELECT
      a.fecha,
      coalesce(a.turno, 'general') AS turno,
      coalesce(nullif(a.observaciones, ''), 'Asistencia diaria') AS tarea,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN
          CASE
            WHEN lower(coalesce(a.turno, '')) IN ('medio_turno_manana', 'medio_turno_tarde', 'manana', 'tarde')
              OR lower(coalesce(a.turno, '')) LIKE 'ma%ana'
              THEN 0.5
            ELSE 1
          END
        WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'sucursales'
          AND (
            extract(dow FROM a.fecha) = 0
            OR EXISTS (
              SELECT 1
              FROM public.rrhh_feriados f
              WHERE f.fecha = a.fecha
                AND f.activo = true
            )
          )
          THEN 9
        ELSE least(coalesce(a.horas_trabajadas, 0), coalesce(v_regla.horas_jornada, 9))
      END AS horas_mensuales,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
        WHEN coalesce(v_regla.grupo_base_dias, 'galpon') = 'sucursales'
          AND (
            extract(dow FROM a.fecha) = 0
            OR EXISTS (
              SELECT 1
              FROM public.rrhh_feriados f
              WHERE f.fecha = a.fecha
                AND f.activo = true
            )
          )
          THEN greatest(coalesce(a.horas_trabajadas, 0) - 9, 0)
        ELSE greatest(coalesce(a.horas_trabajadas, 0) - coalesce(v_regla.horas_jornada, 9), 0)
      END AS horas_adicionales,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno'
          THEN coalesce(nullif(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
        ELSE coalesce(v_regla.valor_hora, 0)
      END AS tarifa_hora_base,
      CASE
        WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
        ELSE coalesce(v_regla.valor_hora, 0)
      END AS tarifa_hora_extra,
      CASE
        WHEN lower(coalesce(a.observaciones, '')) LIKE '%hik%' THEN 'auto_hik'
        ELSE 'auto_asistencia'
      END AS origen,
      a.observaciones
    FROM public.rrhh_asistencia a
    WHERE a.empleado_id = p_empleado_id
      AND extract(MONTH FROM a.fecha) = p_mes
      AND extract(YEAR FROM a.fecha) = p_anio
      AND a.estado IN ('presente', 'tarde')
      AND coalesce(a.horas_trabajadas, 0) > 0
  ) base
  LEFT JOIN tmp_rrhh_jornada_aprobaciones prev
    ON prev.fecha = base.fecha
   AND prev.origen = base.origen;

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    a.fecha,
    'descanso',
    'Descanso programado',
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,
    0,
    0,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN coalesce(nullif(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    0,
    true,
    'auto_licencia_descanso',
    coalesce(a.observaciones, 'Descanso programado')
  FROM public.rrhh_asistencia a
  WHERE a.empleado_id = p_empleado_id
    AND extract(MONTH FROM a.fecha) = p_mes
    AND extract(YEAR FROM a.fecha) = p_anio
    AND a.estado = 'licencia'
    AND lower(coalesce(a.observaciones, '')) LIKE '%descanso%'
    AND NOT EXISTS (
      SELECT 1
      FROM public.rrhh_liquidacion_jornadas j
      WHERE j.liquidacion_id = v_liquidacion_id
        AND j.fecha = a.fecha
    );

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    d.fecha,
    'vacaciones',
    CASE WHEN l.tipo = 'descanso_programado' THEN 'Descanso programado' ELSE 'Vacaciones' END,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE coalesce(v_regla.horas_jornada, 9)
    END,
    0,
    0,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN coalesce(nullif(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    CASE
      WHEN coalesce(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE coalesce(v_regla.valor_hora, 0)
    END,
    0,
    true,
    'auto_licencia_descanso',
    coalesce(l.observaciones, 'Licencia aprobada')
  FROM public.rrhh_licencias l
  CROSS JOIN LATERAL (
    SELECT generate_series(
      greatest(l.fecha_inicio, make_date(p_anio, p_mes, 1))::timestamp,
      least(l.fecha_fin, (date_trunc('month', make_date(p_anio, p_mes, 1)) + interval '1 month - 1 day')::date)::timestamp,
      interval '1 day'
    )::date AS fecha
  ) d
  WHERE l.empleado_id = p_empleado_id
    AND l.aprobado = true
    AND l.tipo IN ('vacaciones', 'descanso_programado')
    AND l.fecha_inicio <= (date_trunc('month', make_date(p_anio, p_mes, 1)) + interval '1 month - 1 day')::date
    AND l.fecha_fin >= make_date(p_anio, p_mes, 1)
    AND NOT EXISTS (
      SELECT 1
      FROM public.rrhh_liquidacion_jornadas j
      WHERE j.liquidacion_id = v_liquidacion_id
        AND j.fecha = d.fecha
    );

  INSERT INTO public.rrhh_liquidacion_jornadas (
    liquidacion_id,
    empleado_id,
    fecha,
    turno,
    tarea,
    horas_mensuales,
    horas_adicionales,
    turno_especial_unidades,
    tarifa_hora_base,
    tarifa_hora_extra,
    tarifa_turno_especial,
    horas_extra_aprobadas,
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    s.fecha,
    coalesce(s.turno_codigo, 'suspension_completa'),
    'Suspension disciplinaria',
    0,
    0,
    0,
    0,
    0,
    0,
    true,
    'auto_suspension',
    coalesce(s.descripcion, 'Suspension disciplinaria')
  FROM public.fn_rrhh_suspensiones_periodo(p_empleado_id, p_mes, p_anio) s;

  PERFORM public.fn_rrhh_recalcular_liquidacion(v_liquidacion_id, p_created_by);

  RETURN v_liquidacion_id;
END;
$function$;

WITH categoria_media_jornada AS (
  SELECT id
  FROM public.rrhh_categorias
  WHERE activo = true
    AND public.fn_rrhh_normalizar_codigo_puesto(nombre) = public.fn_rrhh_normalizar_codigo_puesto('asist. 1/2 dia suc.')
  LIMIT 1
)
UPDATE public.rrhh_empleados e
SET
  categoria_id = c.id,
  updated_at = now()
FROM categoria_media_jornada c
WHERE public.fn_rrhh_normalizar_codigo_puesto(concat_ws(' ', e.nombre, e.apellido)) IN (
    public.fn_rrhh_normalizar_codigo_puesto('Ignacio Leguizamon'),
    public.fn_rrhh_normalizar_codigo_puesto('Angeles Peralta')
  )
  AND e.categoria_id IS DISTINCT FROM c.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sucursales'
      AND column_name = 'active'
  ) THEN
    UPDATE public.sucursales s
    SET
      active = false,
      updated_at = now()
    WHERE public.fn_rrhh_normalizar_codigo_puesto(s.nombre) LIKE '%colon%'
      AND EXISTS (
        SELECT 1
        FROM public.sucursales sh
        WHERE sh.id <> s.id
          AND public.fn_rrhh_normalizar_codigo_puesto(sh.nombre) LIKE '%horqueta%'
      );
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sucursales'
      AND column_name = 'activo'
  ) THEN
    UPDATE public.sucursales s
    SET
      activo = false,
      updated_at = now()
    WHERE public.fn_rrhh_normalizar_codigo_puesto(s.nombre) LIKE '%colon%'
      AND EXISTS (
        SELECT 1
        FROM public.sucursales sh
        WHERE sh.id <> s.id
          AND public.fn_rrhh_normalizar_codigo_puesto(sh.nombre) LIKE '%horqueta%'
      );
  ELSE
    RAISE EXCEPTION 'La tabla public.sucursales no tiene columna active ni activo';
  END IF;
END
$$;

COMMIT;
