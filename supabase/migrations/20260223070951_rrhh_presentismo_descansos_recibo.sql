-- RRHH liquidaciones: presentismo por tardanza/falta, descansos propagados y snapshot de ambito/sucursal

ALTER TABLE public.rrhh_liquidaciones
  ADD COLUMN IF NOT EXISTS grupo_base_snapshot text,
  ADD COLUMN IF NOT EXISTS sucursal_snapshot_id uuid,
  ADD COLUMN IF NOT EXISTS sucursal_snapshot_nombre text,
  ADD COLUMN IF NOT EXISTS presentismo_teorico numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS presentismo_perdido numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS presentismo_pagado numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rrhh_liquidaciones_grupo_snapshot
  ON public.rrhh_liquidaciones(grupo_base_snapshot);

CREATE INDEX IF NOT EXISTS idx_rrhh_liquidaciones_sucursal_snapshot
  ON public.rrhh_liquidaciones(sucursal_snapshot_id);

CREATE TABLE IF NOT EXISTS public.rrhh_descansos_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.rrhh_empleados(id) ON DELETE CASCADE,
  dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date NULL,
  observaciones text NULL,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_descansos_programados_empleado
  ON public.rrhh_descansos_programados(empleado_id, activo);

CREATE INDEX IF NOT EXISTS idx_rrhh_descansos_programados_dia
  ON public.rrhh_descansos_programados(dia_semana, activo);

ALTER TABLE public.rrhh_descansos_programados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_descansos_programados" ON public.rrhh_descansos_programados;
CREATE POLICY "Admin full access on rrhh_descansos_programados"
ON public.rrhh_descansos_programados
FOR ALL
USING (auth.jwt() ->> 'rol' = 'admin')
WITH CHECK (auth.jwt() ->> 'rol' = 'admin');

CREATE OR REPLACE FUNCTION public.fn_rrhh_notificar_descanso_programado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_empleado RECORD;
  v_dia_nombre text;
BEGIN
  IF NEW.activo IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  SELECT
    e.id,
    e.sucursal_id,
    COALESCE(NULLIF(TRIM(CONCAT(u.nombre, ' ', u.apellido)), ''), NULLIF(TRIM(CONCAT(e.nombre, ' ', e.apellido)), ''), 'Empleado') AS nombre_empleado
  INTO v_empleado
  FROM public.rrhh_empleados e
  LEFT JOIN public.usuarios u ON u.id = e.usuario_id
  WHERE e.id = NEW.empleado_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_dia_nombre := CASE NEW.dia_semana
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miercoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sabado'
    ELSE 'Dia'
  END;

  INSERT INTO public.rrhh_novedades (
    titulo,
    descripcion,
    tipo,
    sucursal_id,
    prioridad,
    activo,
    fecha_publicacion,
    created_by
  ) VALUES (
    'Descanso programado registrado',
    CONCAT(
      'Se actualizo descanso semanal de ', v_empleado.nombre_empleado,
      ' (', v_dia_nombre, '). Vigencia desde ', NEW.vigente_desde,
      COALESCE(CONCAT(' hasta ', NEW.vigente_hasta), '')
    ),
    CASE WHEN v_empleado.sucursal_id IS NULL THEN 'general' ELSE 'sucursal' END,
    v_empleado.sucursal_id,
    'normal',
    true,
    CURRENT_DATE,
    NEW.created_by
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_rrhh_notificar_descanso_programado ON public.rrhh_descansos_programados;
CREATE TRIGGER trg_rrhh_notificar_descanso_programado
AFTER INSERT OR UPDATE ON public.rrhh_descansos_programados
FOR EACH ROW
EXECUTE FUNCTION public.fn_rrhh_notificar_descanso_programado();

CREATE OR REPLACE FUNCTION public.fn_rrhh_propagar_descansos_periodo(
  p_mes integer,
  p_anio integer,
  p_empleado_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_inicio date;
  v_fin date;
  v_impactados integer := 0;
BEGIN
  v_inicio := make_date(p_anio, p_mes, 1);
  v_fin := (date_trunc('month', v_inicio) + interval '1 month - 1 day')::date;

  INSERT INTO public.rrhh_asistencia (
    empleado_id,
    fecha,
    estado,
    observaciones,
    turno,
    hora_entrada,
    hora_salida,
    horas_trabajadas,
    retraso_minutos,
    falta_sin_aviso
  )
  SELECT
    d.empleado_id,
    gs.dia::date,
    'licencia',
    COALESCE(NULLIF(d.observaciones, ''), 'Descanso programado'),
    'general',
    NULL,
    NULL,
    0,
    0,
    false
  FROM public.rrhh_descansos_programados d
  CROSS JOIN LATERAL (
    SELECT generate_series(v_inicio::timestamp, v_fin::timestamp, interval '1 day') AS dia
  ) gs
  WHERE d.activo = true
    AND EXTRACT(DOW FROM gs.dia::date)::integer = d.dia_semana
    AND gs.dia::date >= d.vigente_desde
    AND (d.vigente_hasta IS NULL OR gs.dia::date <= d.vigente_hasta)
    AND (p_empleado_id IS NULL OR d.empleado_id = p_empleado_id)
  ON CONFLICT (empleado_id, fecha)
  DO UPDATE SET
    estado = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN rrhh_asistencia.estado
      ELSE EXCLUDED.estado
    END,
    observaciones = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN rrhh_asistencia.observaciones
      ELSE EXCLUDED.observaciones
    END,
    turno = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN rrhh_asistencia.turno
      ELSE EXCLUDED.turno
    END,
    hora_entrada = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN rrhh_asistencia.hora_entrada
      ELSE EXCLUDED.hora_entrada
    END,
    hora_salida = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN rrhh_asistencia.hora_salida
      ELSE EXCLUDED.hora_salida
    END,
    horas_trabajadas = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN rrhh_asistencia.horas_trabajadas
      ELSE EXCLUDED.horas_trabajadas
    END,
    retraso_minutos = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN rrhh_asistencia.retraso_minutos
      ELSE EXCLUDED.retraso_minutos
    END,
    falta_sin_aviso = CASE
      WHEN rrhh_asistencia.falta_sin_aviso = true THEN true
      ELSE EXCLUDED.falta_sin_aviso
    END,
    updated_at = now();

  GET DIAGNOSTICS v_impactados = ROW_COUNT;
  RETURN v_impactados;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_marcar_asistencia(
  p_empleado_id uuid,
  p_fecha date,
  p_hora_entrada timestamp with time zone DEFAULT now(),
  p_turno varchar(20) DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_asistencia_id uuid;
  v_retraso_minutos integer := 0;
  v_estado varchar(20) := 'presente';
BEGIN
  IF p_turno ILIKE 'ma%ana' AND EXTRACT(HOUR FROM p_hora_entrada) >= 9 THEN
    v_retraso_minutos := EXTRACT(EPOCH FROM (p_hora_entrada - (p_fecha + INTERVAL '9 hours'))) / 60;
  ELSIF p_turno = 'tarde' AND EXTRACT(HOUR FROM p_hora_entrada) >= 15 THEN
    v_retraso_minutos := EXTRACT(EPOCH FROM (p_hora_entrada - (p_fecha + INTERVAL '15 hours'))) / 60;
  END IF;

  IF v_retraso_minutos > 15 THEN
    v_estado := 'tarde';
  END IF;

  INSERT INTO public.rrhh_asistencia (
    empleado_id,
    fecha,
    hora_entrada,
    turno,
    estado,
    retraso_minutos,
    falta_sin_aviso
  ) VALUES (
    p_empleado_id,
    p_fecha,
    p_hora_entrada,
    p_turno,
    v_estado,
    v_retraso_minutos,
    false
  )
  ON CONFLICT (empleado_id, fecha)
  DO UPDATE SET
    hora_entrada = EXCLUDED.hora_entrada,
    turno = EXCLUDED.turno,
    estado = EXCLUDED.estado,
    retraso_minutos = EXCLUDED.retraso_minutos,
    falta_sin_aviso = false,
    updated_at = now()
  RETURNING id INTO v_asistencia_id;

  RETURN v_asistencia_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_preparar_liquidacion_mensual(
  p_empleado_id uuid,
  p_mes integer,
  p_anio integer,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_liquidacion_id UUID;
  v_regla RECORD;
  v_empleado RECORD;
BEGIN
  SELECT *
  INTO v_regla
  FROM fn_rrhh_resolver_regla_puesto(p_empleado_id, p_mes, p_anio, NULL);

  SELECT
    e.sucursal_id,
    s.nombre AS sucursal_nombre
  INTO v_empleado
  FROM public.rrhh_empleados e
  LEFT JOIN public.sucursales s ON s.id = e.sucursal_id
  WHERE e.id = p_empleado_id;

  INSERT INTO rrhh_liquidaciones (
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
    COALESCE(v_regla.sueldo_basico, 0),
    COALESCE(v_regla.valor_hora, 0),
    0,
    0,
    'calculada',
    p_created_by,
    COALESCE(v_regla.dias_base, 30),
    COALESCE(v_regla.horas_jornada, 9),
    COALESCE(v_regla.valor_jornal, 0),
    COALESCE(v_regla.valor_hora, 0),
    COALESCE(v_regla.grupo_base_dias, 'galpon'),
    v_empleado.sucursal_id,
    v_empleado.sucursal_nombre,
    COALESCE(v_regla.valor_jornal, 0),
    0,
    COALESCE(v_regla.valor_jornal, 0)
  )
  ON CONFLICT (empleado_id, periodo_mes, periodo_anio)
  DO UPDATE SET
    updated_at = NOW(),
    created_by = COALESCE(EXCLUDED.created_by, rrhh_liquidaciones.created_by),
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

  DELETE FROM rrhh_liquidacion_jornadas
  WHERE liquidacion_id = v_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso');

  INSERT INTO rrhh_liquidacion_jornadas (
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
    origen,
    observaciones
  )
  SELECT
    v_liquidacion_id,
    p_empleado_id,
    a.fecha,
    COALESCE(a.turno, 'general'),
    COALESCE(NULLIF(a.observaciones, ''), 'Asistencia diaria'),
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN
        CASE
          WHEN lower(COALESCE(a.turno, '')) IN ('medio_turno_manana', 'medio_turno_tarde', 'manana', 'tarde')
               OR lower(COALESCE(a.turno, '')) LIKE 'ma%ana'
          THEN 0.5
          ELSE 1
        END
      WHEN COALESCE(v_regla.grupo_base_dias, 'galpon') = 'sucursales'
           AND (
             EXTRACT(DOW FROM a.fecha) = 0
             OR EXISTS (
               SELECT 1
               FROM rrhh_feriados f
               WHERE f.fecha = a.fecha
                 AND f.activo = true
             )
           )
      THEN 9
      ELSE LEAST(COALESCE(a.horas_trabajadas, 0), COALESCE(v_regla.horas_jornada, 9))
    END,
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      WHEN COALESCE(v_regla.grupo_base_dias, 'galpon') = 'sucursales'
           AND (
             EXTRACT(DOW FROM a.fecha) = 0
             OR EXISTS (
               SELECT 1
               FROM rrhh_feriados f
               WHERE f.fecha = a.fecha
                 AND f.activo = true
             )
           )
      THEN GREATEST(COALESCE(a.horas_trabajadas, 0) - 9, 0)
      ELSE GREATEST(COALESCE(a.horas_trabajadas, 0) - COALESCE(v_regla.horas_jornada, 9), 0)
    END,
    0,
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN COALESCE(NULLIF(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
      ELSE COALESCE(v_regla.valor_hora, 0)
    END,
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE COALESCE(v_regla.valor_hora, 0)
    END,
    COALESCE(v_regla.tarifa_turno_especial, 0),
    CASE
      WHEN lower(COALESCE(a.observaciones, '')) LIKE '%hik%' THEN 'auto_hik'
      ELSE 'auto_asistencia'
    END,
    a.observaciones
  FROM rrhh_asistencia a
  WHERE a.empleado_id = p_empleado_id
    AND EXTRACT(MONTH FROM a.fecha) = p_mes
    AND EXTRACT(YEAR FROM a.fecha) = p_anio
    AND a.estado IN ('presente', 'tarde')
    AND COALESCE(a.horas_trabajadas, 0) > 0;

  INSERT INTO rrhh_liquidacion_jornadas (
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
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE COALESCE(v_regla.horas_jornada, 9)
    END,
    0,
    0,
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN COALESCE(NULLIF(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
      ELSE COALESCE(v_regla.valor_hora, 0)
    END,
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE COALESCE(v_regla.valor_hora, 0)
    END,
    0,
    'auto_licencia_descanso',
    COALESCE(a.observaciones, 'Descanso programado')
  FROM rrhh_asistencia a
  WHERE a.empleado_id = p_empleado_id
    AND EXTRACT(MONTH FROM a.fecha) = p_mes
    AND EXTRACT(YEAR FROM a.fecha) = p_anio
    AND a.estado = 'licencia'
    AND lower(COALESCE(a.observaciones, '')) LIKE '%descanso%'
    AND NOT EXISTS (
      SELECT 1
      FROM rrhh_liquidacion_jornadas j
      WHERE j.liquidacion_id = v_liquidacion_id
        AND j.fecha = a.fecha
    );

  INSERT INTO rrhh_liquidacion_jornadas (
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
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN 1
      ELSE COALESCE(v_regla.horas_jornada, 9)
    END,
    0,
    0,
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN COALESCE(NULLIF(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, 0)
      ELSE COALESCE(v_regla.valor_hora, 0)
    END,
    CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE COALESCE(v_regla.valor_hora, 0)
    END,
    0,
    'auto_licencia_descanso',
    COALESCE(l.observaciones, 'Licencia aprobada')
  FROM rrhh_licencias l
  CROSS JOIN LATERAL (
    SELECT generate_series(
      GREATEST(l.fecha_inicio, make_date(p_anio, p_mes, 1))::timestamp,
      LEAST(l.fecha_fin, (date_trunc('month', make_date(p_anio, p_mes, 1)) + interval '1 month - 1 day')::date)::timestamp,
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
      FROM rrhh_liquidacion_jornadas j
      WHERE j.liquidacion_id = v_liquidacion_id
        AND j.fecha = d.fecha
    );

  PERFORM fn_rrhh_recalcular_liquidacion(v_liquidacion_id, p_created_by);

  RETURN v_liquidacion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_recalcular_liquidacion(
  p_liquidacion_id uuid,
  p_actor uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_total_s_descuentos DECIMAL := 0;
  v_descuentos_total DECIMAL := 0;
  v_total_neto DECIMAL := 0;
  v_limite_30 DECIMAL := 0;
  v_superado BOOLEAN := false;
  v_total_por_dia DECIMAL := 0;
BEGIN
  SELECT * INTO v_liq FROM rrhh_liquidaciones WHERE id = p_liquidacion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidacion % no encontrada', p_liquidacion_id;
  END IF;

  SELECT *
  INTO v_regla
  FROM fn_rrhh_resolver_regla_puesto(v_liq.empleado_id, v_liq.periodo_mes, v_liq.periodo_anio, v_liq.puesto_override);

  UPDATE rrhh_liquidacion_jornadas
  SET
    tarifa_hora_base = CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno'
        THEN COALESCE(NULLIF(v_regla.tarifa_turno_trabajado, 0), v_regla.valor_jornal, tarifa_hora_base)
      ELSE COALESCE(v_regla.valor_hora, tarifa_hora_base)
    END,
    tarifa_hora_extra = CASE
      WHEN COALESCE(v_regla.tipo_calculo, 'hora') = 'turno' THEN 0
      ELSE COALESCE(v_regla.valor_hora, tarifa_hora_extra)
    END,
    updated_at = NOW()
  WHERE liquidacion_id = p_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso');

  SELECT
    COALESCE(SUM(horas_mensuales), 0),
    COALESCE(SUM(horas_adicionales), 0),
    COALESCE(SUM(turno_especial_unidades), 0),
    COALESCE(SUM(monto_mensual), 0),
    COALESCE(
      SUM(
        CASE
          WHEN COALESCE(v_regla.grupo_base_dias, 'galpon') = 'sucursales' THEN 0
          ELSE monto_extra
        END
      ),
      0
    ),
    COALESCE(SUM(monto_turno_especial), 0),
    COALESCE(COUNT(DISTINCT fecha), 0),
    COALESCE(COUNT(*), 0)
  INTO v_horas_mensuales, v_horas_extras, v_turno_especial, v_monto_mensual, v_monto_extra, v_monto_turno, v_dias_trabajados, v_turnos
  FROM rrhh_liquidacion_jornadas
  WHERE liquidacion_id = p_liquidacion_id;

  SELECT COALESCE(SUM(monto), 0)
  INTO v_descuentos_adicionales
  FROM rrhh_descuentos
  WHERE empleado_id = v_liq.empleado_id
    AND aprobado = true
    AND EXTRACT(MONTH FROM fecha) = v_liq.periodo_mes
    AND EXTRACT(YEAR FROM fecha) = v_liq.periodo_anio;

  v_presentismo_teorico := COALESCE(v_regla.valor_jornal, 0);

  IF EXISTS (
    SELECT 1
    FROM rrhh_asistencia a
    WHERE a.empleado_id = v_liq.empleado_id
      AND EXTRACT(MONTH FROM a.fecha) = v_liq.periodo_mes
      AND EXTRACT(YEAR FROM a.fecha) = v_liq.periodo_anio
      AND (
        a.falta_sin_aviso = true
        OR COALESCE(a.retraso_minutos, 0) > 15
      )
  ) THEN
    v_descuento_presentismo := v_presentismo_teorico;
  END IF;

  v_presentismo_pagado := GREATEST(v_presentismo_teorico - v_descuento_presentismo, 0);

  SELECT
    COALESCE(SUM(CASE WHEN p.tipo = 'producto' THEN c.monto_cuota ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.tipo = 'dinero' THEN c.monto_cuota ELSE 0 END), 0)
  INTO v_adel_mercaderia, v_adel_efectivo
  FROM rrhh_adelanto_cuotas c
  JOIN rrhh_adelanto_planes p ON p.id = c.plan_id
  WHERE p.empleado_id = v_liq.empleado_id
    AND c.periodo_mes = v_liq.periodo_mes
    AND c.periodo_anio = v_liq.periodo_anio
    AND c.estado IN ('pendiente', 'aplicada');

  IF COALESCE(v_adel_mercaderia, 0) = 0 AND COALESCE(v_adel_efectivo, 0) = 0 THEN
    SELECT
      COALESCE(SUM(CASE WHEN a.tipo = 'producto' THEN COALESCE(a.monto, COALESCE(a.cantidad, 0) * COALESCE(a.precio_unitario, 0)) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN a.tipo = 'dinero' THEN COALESCE(a.monto, 0) ELSE 0 END), 0)
    INTO v_adel_mercaderia, v_adel_efectivo
    FROM rrhh_adelantos a
    WHERE a.empleado_id = v_liq.empleado_id
      AND a.aprobado = true
      AND EXTRACT(MONTH FROM COALESCE(a.fecha_aprobacion, a.fecha_solicitud)) = v_liq.periodo_mes
      AND EXTRACT(YEAR FROM COALESCE(a.fecha_aprobacion, a.fecha_solicitud)) = v_liq.periodo_anio;
  END IF;

  UPDATE rrhh_adelanto_cuotas c
  SET estado = 'aplicada',
      liquidacion_id = p_liquidacion_id,
      updated_at = NOW()
  FROM rrhh_adelanto_planes p
  WHERE p.id = c.plan_id
    AND p.empleado_id = v_liq.empleado_id
    AND c.periodo_mes = v_liq.periodo_mes
    AND c.periodo_anio = v_liq.periodo_anio
    AND c.estado = 'pendiente';

  v_total_cajero := ROUND(COALESCE(v_liq.dias_cajero, 0) * COALESCE(v_liq.diferencia_turno_cajero, 0), 2);
  v_total_s_descuentos := ROUND(
    COALESCE(v_monto_mensual, 0)
    + COALESCE(v_monto_extra, 0)
    + COALESCE(v_monto_turno, 0)
    + COALESCE(v_total_cajero, 0)
    + COALESCE(v_presentismo_pagado, 0),
    2
  );
  v_adelantos_total := ROUND(COALESCE(v_adel_mercaderia, 0) + COALESCE(v_adel_efectivo, 0), 2);
  v_descuentos_total := ROUND(COALESCE(v_descuento_presentismo, 0) + COALESCE(v_descuentos_adicionales, 0), 2);
  v_limite_30 := ROUND(v_total_s_descuentos * 0.30, 2);
  v_superado := v_adelantos_total > v_limite_30;
  v_total_neto := ROUND(v_total_s_descuentos - v_adelantos_total - v_descuentos_total, 2);

  IF v_dias_trabajados > 0 THEN
    v_total_por_dia := ROUND(v_total_neto / v_dias_trabajados, 2);
  ELSE
    v_total_por_dia := 0;
  END IF;

  UPDATE rrhh_liquidaciones
  SET
    sueldo_basico = COALESCE(v_regla.sueldo_basico, sueldo_basico),
    dias_base = COALESCE(v_regla.dias_base, dias_base),
    horas_jornada = COALESCE(v_regla.horas_jornada, horas_jornada),
    valor_jornal = COALESCE(v_regla.valor_jornal, valor_jornal),
    valor_hora = COALESCE(v_regla.valor_hora, valor_hora),
    valor_hora_extra = COALESCE(v_regla.valor_hora, valor_hora_extra),
    horas_trabajadas = COALESCE(v_horas_mensuales, 0) + COALESCE(v_horas_extras, 0),
    horas_extras = COALESCE(v_horas_extras, 0),
    turnos_trabajados = COALESCE(v_turnos, 0),
    total_cajero = COALESCE(v_total_cajero, 0),
    total_sin_descuentos = COALESCE(v_total_s_descuentos, 0),
    total_bruto = COALESCE(v_total_s_descuentos, 0),
    descuento_presentismo = COALESCE(v_descuento_presentismo, 0),
    presentismo_teorico = COALESCE(v_presentismo_teorico, 0),
    presentismo_perdido = COALESCE(v_descuento_presentismo, 0),
    presentismo_pagado = COALESCE(v_presentismo_pagado, 0),
    descuentos_total = COALESCE(v_descuentos_total, 0),
    adelanto_mercaderia_total = COALESCE(v_adel_mercaderia, 0),
    adelanto_efectivo_total = COALESCE(v_adel_efectivo, 0),
    adelantos_total = COALESCE(v_adelantos_total, 0),
    control_30_limite = COALESCE(v_limite_30, 0),
    control_30_anticipos = COALESCE(v_adelantos_total, 0),
    control_30_superado = COALESCE(v_superado, false),
    total_neto = COALESCE(v_total_neto, 0),
    total_por_dia = COALESCE(v_total_por_dia, 0),
    estado = CASE
      WHEN estado = 'pagada' THEN 'pagada'
      WHEN estado = 'aprobada' THEN 'aprobada'
      ELSE 'calculada'
    END,
    updated_at = NOW()
  WHERE id = p_liquidacion_id;

  DELETE FROM rrhh_liquidacion_detalles WHERE liquidacion_id = p_liquidacion_id;

  INSERT INTO rrhh_liquidacion_detalles (liquidacion_id, tipo, descripcion, monto)
  VALUES
    (p_liquidacion_id, 'sueldo_basico', 'Sueldo base del periodo', COALESCE(v_regla.sueldo_basico, 0)),
    (p_liquidacion_id, 'presentismo', 'Presentismo del periodo', COALESCE(v_presentismo_pagado, 0)),
    (p_liquidacion_id, 'horas_mensuales', 'Pago horas mensuales', COALESCE(v_monto_mensual, 0)),
    (p_liquidacion_id, 'horas_extras', 'Pago horas adicionales', COALESCE(v_monto_extra, 0)),
    (p_liquidacion_id, 'turnos_especiales', 'Pago turnos especiales', COALESCE(v_monto_turno, 0)),
    (p_liquidacion_id, 'adicional_cajero', 'Total dias como cajero', COALESCE(v_total_cajero, 0)),
    (p_liquidacion_id, 'descuento_presentismo', 'Descuento por presentismo', -COALESCE(v_descuento_presentismo, 0)),
    (p_liquidacion_id, 'descuentos_adicionales', 'Descuentos adicionales aprobados', -COALESCE(v_descuentos_adicionales, 0)),
    (p_liquidacion_id, 'adelanto_mercaderia', 'Adelantos mercaderia del periodo', -COALESCE(v_adel_mercaderia, 0)),
    (p_liquidacion_id, 'adelanto_efectivo', 'Adelantos efectivo del periodo', -COALESCE(v_adel_efectivo, 0)),
    (p_liquidacion_id, 'total_neto', 'Total a percibir', COALESCE(v_total_neto, 0));

  RETURN p_liquidacion_id;
END;
$function$;
;
