BEGIN;

ALTER TABLE public.rrhh_adelantos
  ADD COLUMN IF NOT EXISTS plan_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rrhh_adelantos_plan_id_fkey'
      AND conrelid = 'public.rrhh_adelantos'::regclass
  ) THEN
    ALTER TABLE public.rrhh_adelantos
      ADD CONSTRAINT rrhh_adelantos_plan_id_fkey
      FOREIGN KEY (plan_id)
      REFERENCES public.rrhh_adelanto_planes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rrhh_adelantos_plan_id_unique
  ON public.rrhh_adelantos(plan_id)
  WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rrhh_adelantos_aprobado_plan
  ON public.rrhh_adelantos(aprobado, plan_id);

DROP FUNCTION IF EXISTS public.fn_rrhh_aprobar_adelanto_atomico(UUID, UUID, INTEGER, DATE, BOOLEAN);

CREATE OR REPLACE FUNCTION public.fn_rrhh_aprobar_adelanto_atomico(
  p_adelanto_id UUID,
  p_aprobado_por UUID,
  p_cantidad_cuotas INTEGER DEFAULT 1,
  p_fecha_inicio DATE DEFAULT NULL,
  p_recalcular BOOLEAN DEFAULT true
)
RETURNS TABLE (
  adelanto_id UUID,
  plan_id UUID,
  liquidacion_recalculada_id UUID,
  cuotas_generadas INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_adelanto public.rrhh_adelantos%ROWTYPE;
  v_plan_id UUID;
  v_liquidacion_id UUID;
  v_aprobado_por UUID;
  v_fecha_inicio DATE;
  v_cantidad_cuotas INTEGER;
  v_cuotas_generadas INTEGER := 0;
  v_monto_total NUMERIC(12,2);
  v_monto_base NUMERIC(12,2);
  v_monto_ultima NUMERIC(12,2);
  v_monto_cuota NUMERIC(12,2);
  v_i INTEGER;
  v_fecha_cuota DATE;
BEGIN
  IF p_adelanto_id IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el adelanto a aprobar';
  END IF;

  IF p_aprobado_por IS NULL THEN
    RAISE EXCEPTION 'Debe indicar el usuario aprobador';
  END IF;

  SELECT u.id
  INTO v_aprobado_por
  FROM public.usuarios u
  WHERE u.id = p_aprobado_por
  LIMIT 1;

  IF v_aprobado_por IS NULL THEN
    RAISE EXCEPTION 'El usuario aprobador % no existe en usuarios', p_aprobado_por;
  END IF;

  SELECT *
  INTO v_adelanto
  FROM public.rrhh_adelantos
  WHERE id = p_adelanto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adelanto % no encontrado', p_adelanto_id;
  END IF;

  IF v_adelanto.plan_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER
    INTO v_cuotas_generadas
    FROM public.rrhh_adelanto_cuotas c
    WHERE c.plan_id = v_adelanto.plan_id;

    SELECT c.liquidacion_id
    INTO v_liquidacion_id
    FROM public.rrhh_adelanto_cuotas c
    WHERE c.plan_id = v_adelanto.plan_id
    ORDER BY c.nro_cuota
    LIMIT 1;

    RETURN QUERY
    SELECT v_adelanto.id, v_adelanto.plan_id, v_liquidacion_id, COALESCE(v_cuotas_generadas, 0);
    RETURN;
  END IF;

  v_cantidad_cuotas := GREATEST(COALESCE(p_cantidad_cuotas, 1), 1);
  v_fecha_inicio := DATE_TRUNC('month', COALESCE(p_fecha_inicio, v_adelanto.fecha_aprobacion, v_adelanto.fecha_solicitud, CURRENT_DATE))::DATE;

  v_monto_total := CASE
    WHEN v_adelanto.tipo = 'dinero' THEN COALESCE(v_adelanto.monto, 0)
    WHEN v_adelanto.tipo = 'producto' THEN COALESCE(NULLIF(v_adelanto.monto, 0), COALESCE(v_adelanto.cantidad, 0) * COALESCE(v_adelanto.precio_unitario, 0), 0)
    ELSE 0
  END;

  IF COALESCE(v_monto_total, 0) <= 0 THEN
    RAISE EXCEPTION 'El adelanto % no tiene monto valido para generar cuotas', p_adelanto_id;
  END IF;

  IF v_adelanto.tipo = 'dinero' AND v_adelanto.aprobado IS DISTINCT FROM true THEN
    IF COALESCE(public.fn_validar_limite_adelanto(v_adelanto.empleado_id, v_monto_total), false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'El adelanto supera el limite del 30%% del sueldo basico';
    END IF;
  END IF;

  INSERT INTO public.rrhh_adelanto_planes (
    empleado_id,
    tipo,
    monto_total,
    descripcion,
    fecha_inicio,
    cantidad_cuotas,
    estado,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_adelanto.empleado_id,
    v_adelanto.tipo,
    v_monto_total,
    COALESCE(NULLIF(v_adelanto.observaciones, ''), 'Plan generado desde rrhh_adelantos'),
    v_fecha_inicio,
    v_cantidad_cuotas,
    'activo',
    v_aprobado_por,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_plan_id;

  v_monto_base := ROUND(v_monto_total / v_cantidad_cuotas, 2);
  v_monto_ultima := ROUND(v_monto_total - (v_monto_base * (v_cantidad_cuotas - 1)), 2);

  FOR v_i IN 1..v_cantidad_cuotas LOOP
    v_fecha_cuota := (v_fecha_inicio + MAKE_INTERVAL(months => v_i - 1))::DATE;
    v_monto_cuota := CASE WHEN v_i = v_cantidad_cuotas THEN v_monto_ultima ELSE v_monto_base END;

    INSERT INTO public.rrhh_adelanto_cuotas (
      plan_id,
      nro_cuota,
      periodo_mes,
      periodo_anio,
      monto_cuota,
      estado,
      created_at,
      updated_at
    ) VALUES (
      v_plan_id,
      v_i,
      EXTRACT(MONTH FROM v_fecha_cuota)::INTEGER,
      EXTRACT(YEAR FROM v_fecha_cuota)::INTEGER,
      v_monto_cuota,
      'pendiente',
      NOW(),
      NOW()
    );
  END LOOP;

  UPDATE public.rrhh_adelantos
  SET
    aprobado = true,
    aprobado_por = COALESCE(v_adelanto.aprobado_por, v_aprobado_por),
    fecha_aprobacion = COALESCE(v_adelanto.fecha_aprobacion, CURRENT_DATE),
    plan_id = v_plan_id,
    updated_at = NOW()
  WHERE id = v_adelanto.id;

  v_liquidacion_id := NULL;

  IF COALESCE(p_recalcular, true) THEN
    SELECT l.id
    INTO v_liquidacion_id
    FROM public.rrhh_liquidaciones l
    WHERE l.empleado_id = v_adelanto.empleado_id
      AND l.periodo_mes = EXTRACT(MONTH FROM v_fecha_inicio)::INTEGER
      AND l.periodo_anio = EXTRACT(YEAR FROM v_fecha_inicio)::INTEGER
    ORDER BY l.created_at DESC
    LIMIT 1;

    IF v_liquidacion_id IS NOT NULL THEN
      PERFORM public.fn_rrhh_recalcular_liquidacion(v_liquidacion_id, v_aprobado_por);
    END IF;
  END IF;

  RETURN QUERY
  SELECT v_adelanto.id, v_plan_id, v_liquidacion_id, v_cantidad_cuotas;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_rrhh_aprobar_adelanto_atomico(UUID, UUID, INTEGER, DATE, BOOLEAN)
TO authenticated, service_role;

DO $backfill$
DECLARE
  r public.rrhh_adelantos%ROWTYPE;
  v_plan_id UUID;
  v_liquidacion_id UUID;
  v_actor UUID;
  v_fecha_inicio DATE;
  v_monto_total NUMERIC(12,2);
BEGIN
  FOR r IN
    SELECT *
    FROM public.rrhh_adelantos
    WHERE aprobado = true
      AND plan_id IS NULL
    ORDER BY COALESCE(fecha_aprobacion, fecha_solicitud), created_at, id
  LOOP
    v_monto_total := CASE
      WHEN r.tipo = 'dinero' THEN COALESCE(r.monto, 0)
      WHEN r.tipo = 'producto' THEN COALESCE(NULLIF(r.monto, 0), COALESCE(r.cantidad, 0) * COALESCE(r.precio_unitario, 0), 0)
      ELSE 0
    END;

    IF COALESCE(v_monto_total, 0) <= 0 THEN
      CONTINUE;
    END IF;

    v_fecha_inicio := DATE_TRUNC('month', COALESCE(r.fecha_aprobacion, r.fecha_solicitud, CURRENT_DATE))::DATE;
    v_actor := NULL;

    IF r.aprobado_por IS NOT NULL THEN
      SELECT u.id
      INTO v_actor
      FROM public.usuarios u
      WHERE u.id = r.aprobado_por
      LIMIT 1;
    END IF;

    INSERT INTO public.rrhh_adelanto_planes (
      empleado_id,
      tipo,
      monto_total,
      descripcion,
      fecha_inicio,
      cantidad_cuotas,
      estado,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      r.empleado_id,
      r.tipo,
      v_monto_total,
      COALESCE(NULLIF(r.observaciones, ''), 'Backfill desde rrhh_adelantos aprobado'),
      v_fecha_inicio,
      1,
      'activo',
      v_actor,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_plan_id;

    INSERT INTO public.rrhh_adelanto_cuotas (
      plan_id,
      nro_cuota,
      periodo_mes,
      periodo_anio,
      monto_cuota,
      estado,
      created_at,
      updated_at
    ) VALUES (
      v_plan_id,
      1,
      EXTRACT(MONTH FROM v_fecha_inicio)::INTEGER,
      EXTRACT(YEAR FROM v_fecha_inicio)::INTEGER,
      v_monto_total,
      'pendiente',
      NOW(),
      NOW()
    );

    UPDATE public.rrhh_adelantos
    SET
      plan_id = v_plan_id,
      updated_at = NOW()
    WHERE id = r.id;

    SELECT l.id
    INTO v_liquidacion_id
    FROM public.rrhh_liquidaciones l
    WHERE l.empleado_id = r.empleado_id
      AND l.periodo_mes = EXTRACT(MONTH FROM v_fecha_inicio)::INTEGER
      AND l.periodo_anio = EXTRACT(YEAR FROM v_fecha_inicio)::INTEGER
    ORDER BY l.created_at DESC
    LIMIT 1;

    IF v_liquidacion_id IS NOT NULL THEN
      PERFORM public.fn_rrhh_recalcular_liquidacion(v_liquidacion_id, v_actor);
    END IF;
  END LOOP;
END;
$backfill$;

COMMIT;;
