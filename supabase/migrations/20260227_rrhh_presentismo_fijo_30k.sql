-- RRHH: Presentismo fijo $30,000 con lógica mes completo + infracciones
-- Reemplaza la lógica anterior (presentismo = valor_jornal variable)
-- Ahora: $30,000 fijo — HABER si mes completo sin infracciones, DESCUENTO si no

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
  v_mes_completo BOOLEAN := false;
  v_tiene_infracciones BOOLEAN := false;
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

  -- === PRESENTISMO FIJO $30,000 ===
  v_presentismo_teorico := 30000;

  -- ¿El mes está completo? (hoy > último día del mes de la liquidación)
  v_mes_completo := CURRENT_DATE > (
    date_trunc('month', make_date(v_liq.periodo_anio, v_liq.periodo_mes, 1)) + interval '1 month - 1 day'
  )::date;

  -- ¿Hay infracciones en el mes? (falta sin aviso o retraso > 15 min)
  SELECT EXISTS (
    SELECT 1
    FROM rrhh_asistencia a
    WHERE a.empleado_id = v_liq.empleado_id
      AND EXTRACT(MONTH FROM a.fecha) = v_liq.periodo_mes
      AND EXTRACT(YEAR FROM a.fecha) = v_liq.periodo_anio
      AND (
        a.falta_sin_aviso = true
        OR COALESCE(a.retraso_minutos, 0) > 15
      )
  ) INTO v_tiene_infracciones;

  IF v_mes_completo AND NOT v_tiene_infracciones THEN
    -- Mes cerrado sin infracciones: presentismo como HABER
    v_presentismo_pagado := 30000;
    v_descuento_presentismo := 0;
  ELSE
    -- Mes en curso o con infracciones: presentismo como DESCUENTO
    v_presentismo_pagado := 0;
    v_descuento_presentismo := 30000;
  END IF;
  -- === FIN PRESENTISMO ===

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
