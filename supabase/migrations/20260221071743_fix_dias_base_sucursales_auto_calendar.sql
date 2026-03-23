
-- Sucursales siempre usa días calendario del mes, no valor manual
DROP FUNCTION IF EXISTS fn_rrhh_resolver_regla_puesto(UUID, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION fn_rrhh_resolver_regla_puesto(
  p_empleado_id UUID,
  p_mes INTEGER,
  p_anio INTEGER,
  p_puesto_override TEXT DEFAULT NULL
)
RETURNS TABLE(
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

  -- Sucursales: SIEMPRE usa dias calendario del mes (mes completo)
  -- Galpon y RRHH: usan el valor manual de la regla de periodo
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
    COALESCE(v_regla_puesto.tipo_calculo, 'hora')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
