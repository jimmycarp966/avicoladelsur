BEGIN;

-- =====================================================
-- RRHH LIQUIDACIONES - CONSISTENCIA SUCURSALES CALENDARIO
-- Fecha: 2026-02-21
-- =====================================================

CREATE OR REPLACE FUNCTION fn_rrhh_resolver_regla_puesto(
  p_empleado_id UUID,
  p_mes INTEGER,
  p_anio INTEGER,
  p_puesto_override TEXT DEFAULT NULL
)
RETURNS TABLE (
  puesto TEXT,
  grupo_base_dias TEXT,
  dias_base INTEGER,
  horas_jornada DECIMAL,
  tarifa_turno_especial DECIMAL,
  habilita_cajero BOOLEAN,
  tarifa_diferencia_cajero DECIMAL,
  sueldo_basico DECIMAL,
  valor_jornal DECIMAL,
  valor_hora DECIMAL,
  tipo_calculo TEXT
) AS $$
DECLARE
  v_empleado RECORD;
  v_regla_periodo RECORD;
  v_regla_puesto RECORD;
  v_puesto TEXT;
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
  FROM rrhh_empleados e
  LEFT JOIN rrhh_categorias c ON c.id = e.categoria_id
  WHERE e.id = p_empleado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado % no encontrado', p_empleado_id;
  END IF;

  SELECT *
  INTO v_regla_periodo
  FROM rrhh_liquidacion_reglas_periodo
  WHERE periodo_mes = p_mes
    AND periodo_anio = p_anio
    AND activo = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT 27 AS dias_base_galpon, 31 AS dias_base_sucursales, 22 AS dias_base_rrhh INTO v_regla_periodo;
  END IF;

  v_puesto := lower(trim(COALESCE(NULLIF(p_puesto_override, ''), NULLIF(v_empleado.categoria_nombre, ''), 'general')));

  SELECT *
  INTO v_regla_puesto
  FROM rrhh_liquidacion_reglas_puesto rp
  WHERE rp.activo = true
    AND (
      lower(trim(rp.puesto_codigo)) = v_puesto
      OR (rp.categoria_id IS NOT NULL AND rp.categoria_id = v_empleado.categoria_id)
    )
  ORDER BY
    CASE
      WHEN lower(trim(rp.puesto_codigo)) = v_puesto THEN 0
      WHEN rp.categoria_id = v_empleado.categoria_id THEN 1
      ELSE 2
    END,
    rp.updated_at DESC
  LIMIT 1;

  v_grupo := COALESCE(
    v_regla_puesto.grupo_base_dias,
    CASE
      WHEN v_puesto LIKE '%rrhh%' OR v_puesto LIKE '%tesoreria%' THEN 'rrhh'
      WHEN v_puesto LIKE '%suc%' OR v_puesto LIKE '%encargado%' OR v_puesto LIKE '%asistente%' THEN 'sucursales'
      ELSE 'galpon'
    END
  );

  -- Sucursales siempre usa dias calendario del mes (mes completo).
  v_dias := CASE
    WHEN v_grupo = 'sucursales' THEN
      EXTRACT(DAY FROM (make_date(p_anio, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER
    WHEN v_grupo = 'rrhh' THEN v_regla_periodo.dias_base_rrhh
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
    COALESCE(v_regla_puesto.tarifa_turno_especial, 0),
    COALESCE(v_regla_puesto.habilita_cajero, false),
    COALESCE(v_regla_puesto.tarifa_diferencia_cajero, 0),
    v_sueldo,
    v_valor_jornal,
    v_valor_hora,
    COALESCE((to_jsonb(v_regla_puesto) ->> 'tipo_calculo'), 'hora')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_rrhh_preparar_liquidacion_mensual(
  p_empleado_id UUID,
  p_mes INTEGER,
  p_anio INTEGER,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_liquidacion_id UUID;
  v_regla RECORD;
BEGIN
  SELECT *
  INTO v_regla
  FROM fn_rrhh_resolver_regla_puesto(p_empleado_id, p_mes, p_anio, NULL);

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
    valor_hora
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
    COALESCE(v_regla.valor_hora, 0)
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
    valor_hora_extra = EXCLUDED.valor_hora_extra
  RETURNING id INTO v_liquidacion_id;

  DELETE FROM rrhh_liquidacion_jornadas
  WHERE liquidacion_id = v_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia');

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
    COALESCE(v_regla.valor_hora, 0),
    COALESCE(v_regla.valor_hora, 0),
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

  PERFORM fn_rrhh_recalcular_liquidacion(v_liquidacion_id, p_created_by);

  RETURN v_liquidacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

