-- RRHH: Legajo unificado, descansos mensuales de sucursal y normalización de sucursales
-- Fecha: 2026-03-04

-- =====================================================
-- 1) Timeline de legajo por empleado
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rrhh_legajo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.rrhh_empleados(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  categoria text NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  fecha_evento timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_legajo_eventos_empleado_fecha
  ON public.rrhh_legajo_eventos(empleado_id, fecha_evento DESC);

CREATE INDEX IF NOT EXISTS idx_rrhh_legajo_eventos_tipo
  ON public.rrhh_legajo_eventos(tipo, categoria);

ALTER TABLE public.rrhh_legajo_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_legajo_eventos" ON public.rrhh_legajo_eventos;
CREATE POLICY "Admin full access on rrhh_legajo_eventos"
ON public.rrhh_legajo_eventos
FOR ALL
USING (auth.jwt() ->> 'rol' = 'admin')
WITH CHECK (auth.jwt() ->> 'rol' = 'admin');

-- =====================================================
-- 2) Compatibilidad de columnas de licencias
-- =====================================================
ALTER TABLE public.rrhh_licencias
  ADD COLUMN IF NOT EXISTS fecha_sintomas timestamptz,
  ADD COLUMN IF NOT EXISTS diagnostico_reportado text,
  ADD COLUMN IF NOT EXISTS excepcion_plazo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_excepcion text,
  ADD COLUMN IF NOT EXISTS fecha_presentacion_certificado timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_limite_presentacion timestamptz,
  ADD COLUMN IF NOT EXISTS presentado_en_termino boolean,
  ADD COLUMN IF NOT EXISTS certificado_url text,
  ADD COLUMN IF NOT EXISTS certificado_storage_path text,
  ADD COLUMN IF NOT EXISTS certificado_nombre_archivo text,
  ADD COLUMN IF NOT EXISTS certificado_mime_type text,
  ADD COLUMN IF NOT EXISTS certificado_tamano_bytes bigint,
  ADD COLUMN IF NOT EXISTS estado_revision varchar(20) DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS revision_manual_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS revisado_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS fecha_revision timestamptz,
  ADD COLUMN IF NOT EXISTS ia_certificado_valido boolean,
  ADD COLUMN IF NOT EXISTS ia_confianza numeric(5,2),
  ADD COLUMN IF NOT EXISTS ia_observaciones text,
  ADD COLUMN IF NOT EXISTS ia_nombre_detectado text,
  ADD COLUMN IF NOT EXISTS ia_diagnostico_detectado text;

CREATE INDEX IF NOT EXISTS idx_rrhh_licencias_presentacion
  ON public.rrhh_licencias(fecha_presentacion_certificado);

CREATE INDEX IF NOT EXISTS idx_rrhh_licencias_plazo
  ON public.rrhh_licencias(fecha_limite_presentacion, presentado_en_termino);

-- =====================================================
-- 3) Descansos mensuales aleatorios de sucursal
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rrhh_descansos_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.rrhh_empleados(id) ON DELETE CASCADE,
  periodo_mes integer NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_anio integer NOT NULL CHECK (periodo_anio >= 2020),
  fecha date NOT NULL,
  turno varchar(30) NOT NULL DEFAULT 'medio_turno_tarde',
  estado varchar(20) NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'aplicado', 'editado', 'cancelado')),
  origen varchar(20) NOT NULL DEFAULT 'auto',
  observaciones text,
  created_by uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empleado_id, periodo_mes, periodo_anio, fecha)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_descansos_mensuales_periodo
  ON public.rrhh_descansos_mensuales(periodo_anio, periodo_mes, fecha);

CREATE INDEX IF NOT EXISTS idx_rrhh_descansos_mensuales_empleado
  ON public.rrhh_descansos_mensuales(empleado_id, periodo_anio, periodo_mes);

ALTER TABLE public.rrhh_descansos_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_descansos_mensuales" ON public.rrhh_descansos_mensuales;
CREATE POLICY "Admin full access on rrhh_descansos_mensuales"
ON public.rrhh_descansos_mensuales
FOR ALL
USING (auth.jwt() ->> 'rol' = 'admin')
WITH CHECK (auth.jwt() ->> 'rol' = 'admin');

CREATE OR REPLACE FUNCTION public.fn_rrhh_generar_descansos_mensuales(
  p_anio integer,
  p_mes integer,
  p_empleado_id uuid DEFAULT NULL,
  p_seed text DEFAULT NULL
)
RETURNS TABLE(empleado_id uuid, generados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio date;
  v_fin date;
  v_target uuid;
  v_existentes integer;
  v_faltantes integer;
  v_insertados integer;
BEGIN
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mes invalido: %', p_mes;
  END IF;

  IF p_anio < 2020 THEN
    RAISE EXCEPTION 'Anio invalido: %', p_anio;
  END IF;

  v_inicio := make_date(p_anio, p_mes, 1);
  v_fin := (date_trunc('month', v_inicio::timestamp) + interval '1 month - 1 day')::date;

  FOR v_target IN
    SELECT e.id
    FROM public.rrhh_empleados e
    WHERE e.activo = true
      AND e.sucursal_id IS NOT NULL
      AND (p_empleado_id IS NULL OR e.id = p_empleado_id)
  LOOP
    SELECT COUNT(*)::integer
    INTO v_existentes
    FROM public.rrhh_descansos_mensuales d
    WHERE d.empleado_id = v_target
      AND d.periodo_anio = p_anio
      AND d.periodo_mes = p_mes
      AND d.estado <> 'cancelado';

    v_faltantes := GREATEST(2 - COALESCE(v_existentes, 0), 0);

    IF v_faltantes = 0 THEN
      empleado_id := v_target;
      generados := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.rrhh_descansos_mensuales (
      empleado_id,
      periodo_mes,
      periodo_anio,
      fecha,
      turno,
      estado,
      origen,
      observaciones
    )
    SELECT
      v_target,
      p_mes,
      p_anio,
      gs.fecha,
      'medio_turno_tarde',
      'programado',
      'auto',
      'Descanso mensual de empresa (medio turno tarde)'
    FROM (
      SELECT d::date AS fecha
      FROM generate_series(v_inicio::timestamp, v_fin::timestamp, interval '1 day') d
      WHERE extract(dow FROM d) BETWEEN 1 AND 6
        AND NOT EXISTS (
          SELECT 1
          FROM public.rrhh_feriados f
          WHERE f.activo = true
            AND f.fecha = d::date
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.rrhh_descansos_mensuales x
          WHERE x.empleado_id = v_target
            AND x.periodo_mes = p_mes
            AND x.periodo_anio = p_anio
            AND x.fecha = d::date
            AND x.estado <> 'cancelado'
        )
      ORDER BY md5(v_target::text || d::date::text || coalesce(p_seed, to_char(now(), 'YYYYMMDD')))
      LIMIT v_faltantes
    ) gs
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_insertados = ROW_COUNT;

    empleado_id := v_target;
    generados := COALESCE(v_insertados, 0);
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_sync_descansos_mensuales_asistencia(
  p_anio integer,
  p_mes integer,
  p_empleado_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer := 0;
BEGIN
  INSERT INTO public.rrhh_asistencia (
    empleado_id,
    fecha,
    turno,
    estado,
    observaciones,
    horas_trabajadas,
    retraso_minutos,
    falta_sin_aviso
  )
  SELECT
    d.empleado_id,
    d.fecha,
    d.turno,
    'licencia',
    'Descanso mensual de empresa (medio turno tarde)',
    0,
    0,
    false
  FROM public.rrhh_descansos_mensuales d
  WHERE d.periodo_anio = p_anio
    AND d.periodo_mes = p_mes
    AND d.estado <> 'cancelado'
    AND (p_empleado_id IS NULL OR d.empleado_id = p_empleado_id)
  ON CONFLICT (empleado_id, fecha)
  DO UPDATE
    SET estado = EXCLUDED.estado,
        turno = EXCLUDED.turno,
        observaciones = EXCLUDED.observaciones,
        updated_at = now();

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN COALESCE(v_total, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_generar_descansos_mes_actual()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mes integer := extract(month FROM now())::integer;
  v_anio integer := extract(year FROM now())::integer;
  v_generados integer := 0;
  v_sincronizados integer := 0;
BEGIN
  SELECT COALESCE(sum(t.generados), 0)
  INTO v_generados
  FROM public.fn_rrhh_generar_descansos_mensuales(v_anio, v_mes) t;

  v_sincronizados := public.fn_rrhh_sync_descansos_mensuales_asistencia(v_anio, v_mes);

  RETURN jsonb_build_object(
    'anio', v_anio,
    'mes', v_mes,
    'descansos_generados', v_generados,
    'asistencias_sincronizadas', v_sincronizados
  );
END;
$function$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'cron'
      AND table_name = 'job'
  ) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rrhh_descansos_mensuales_dia1') THEN
      PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'rrhh_descansos_mensuales_dia1' LIMIT 1));
    END IF;

    PERFORM cron.schedule(
      'rrhh_descansos_mensuales_dia1',
      '5 0 1 * *',
      $$SELECT public.fn_rrhh_generar_descansos_mes_actual();$$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo programar job de descansos mensuales: %', SQLERRM;
END;
$do$;

-- =====================================================
-- 4) Normalización de sucursales: Colón -> Horqueta, Sucursal Central -> Casa Central
-- =====================================================
DO $do$
DECLARE
  v_colon uuid;
  v_horqueta uuid;
  v_sucursal_central uuid;
  v_casa_central uuid;
  t text;
BEGIN
  SELECT id INTO v_colon
  FROM public.sucursales
  WHERE translate(lower(nombre), 'áéíóú', 'aeiou') LIKE '%sucursal colon%'
  LIMIT 1;

  SELECT id INTO v_horqueta
  FROM public.sucursales
  WHERE translate(lower(nombre), 'áéíóú', 'aeiou') LIKE '%sucursal horqueta%'
  LIMIT 1;

  SELECT id INTO v_sucursal_central
  FROM public.sucursales
  WHERE translate(lower(nombre), 'áéíóú', 'aeiou') LIKE '%sucursal central%'
  LIMIT 1;

  SELECT id INTO v_casa_central
  FROM public.sucursales
  WHERE translate(lower(nombre), 'áéíóú', 'aeiou') LIKE '%casa central%'
  LIMIT 1;

  IF v_colon IS NOT NULL AND v_horqueta IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY[
      'ajustes_stock',
      'alertas_stock',
      'conteos_stock',
      'gastos',
      'lotes',
      'pedidos',
      'producto_sucursal_minimos',
      'recargos_metodo_pago',
      'rrhh_empleados',
      'rrhh_evaluaciones',
      'rrhh_novedades',
      'rutas_retiros',
      'stock_reservations',
      'sucursal_settings',
      'tesoreria_cajas',
      'tesoreria_movimientos'
    ]
    LOOP
      IF to_regclass('public.' || t) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET sucursal_id = $1 WHERE sucursal_id = $2', t)
        USING v_horqueta, v_colon;
      END IF;
    END LOOP;

    IF to_regclass('public.rrhh_liquidaciones') IS NOT NULL THEN
      UPDATE public.rrhh_liquidaciones
      SET sucursal_snapshot_id = v_horqueta
      WHERE sucursal_snapshot_id = v_colon;
    END IF;
  END IF;

  IF v_sucursal_central IS NOT NULL AND v_casa_central IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY[
      'ajustes_stock',
      'alertas_stock',
      'conteos_stock',
      'gastos',
      'lotes',
      'pedidos',
      'producto_sucursal_minimos',
      'recargos_metodo_pago',
      'rrhh_empleados',
      'rrhh_evaluaciones',
      'rrhh_novedades',
      'rutas_retiros',
      'stock_reservations',
      'sucursal_settings',
      'tesoreria_cajas',
      'tesoreria_movimientos'
    ]
    LOOP
      IF to_regclass('public.' || t) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET sucursal_id = $1 WHERE sucursal_id = $2', t)
        USING v_casa_central, v_sucursal_central;
      END IF;
    END LOOP;

    IF to_regclass('public.rrhh_liquidaciones') IS NOT NULL THEN
      UPDATE public.rrhh_liquidaciones
      SET sucursal_snapshot_id = v_casa_central
      WHERE sucursal_snapshot_id = v_sucursal_central;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sucursales'
      AND column_name = 'active'
  ) THEN
    UPDATE public.sucursales
    SET active = false,
        updated_at = now()
    WHERE id IN (v_colon, v_sucursal_central)
      AND id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sucursales'
      AND column_name = 'activo'
  ) THEN
    UPDATE public.sucursales
    SET activo = false,
        updated_at = now()
    WHERE id IN (v_colon, v_sucursal_central)
      AND id IS NOT NULL;
  END IF;
END;
$do$;
