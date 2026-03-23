BEGIN;

-- =====================================================
-- RRHH LIQUIDACIONES - DOMINGOS/FERIADOS Y REGLAS SUCURSALES
-- Fecha: 2026-02-21
-- =====================================================

CREATE TABLE IF NOT EXISTS rrhh_feriados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    ambito VARCHAR(20) NOT NULL DEFAULT 'nacional' CHECK (ambito IN ('nacional', 'provincial', 'local')),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_feriados_fecha ON rrhh_feriados(fecha);

ALTER TABLE rrhh_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_feriados" ON rrhh_feriados;
CREATE POLICY "Admin full access on rrhh_feriados"
ON rrhh_feriados
FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

INSERT INTO rrhh_feriados (fecha, descripcion, ambito, activo)
SELECT
  make_date(y.anio, f.mes, f.dia) AS fecha,
  f.descripcion,
  'nacional' AS ambito,
  true AS activo
FROM (VALUES (2026), (2027)) AS y(anio)
CROSS JOIN (
  VALUES
    (1, 1, 'Ano Nuevo'),
    (3, 24, 'Dia Nacional de la Memoria por la Verdad y la Justicia'),
    (4, 2, 'Dia del Veterano y de los Caidos en la Guerra de Malvinas'),
    (5, 1, 'Dia del Trabajador'),
    (5, 25, 'Dia de la Revolucion de Mayo'),
    (6, 20, 'Dia de la Bandera'),
    (7, 9, 'Dia de la Independencia'),
    (12, 8, 'Inmaculada Concepcion de Maria'),
    (12, 25, 'Navidad')
) AS f(mes, dia, descripcion)
ON CONFLICT (fecha) DO UPDATE
SET
  descripcion = EXCLUDED.descripcion,
  ambito = EXCLUDED.ambito,
  activo = true,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION fn_rrhh_recalcular_liquidacion(
  p_liquidacion_id UUID,
  p_actor UUID DEFAULT NULL
)
RETURNS UUID AS $$
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

  -- Mantiene vigente el valor_hora actualizado del periodo para jornadas automaticas.
  UPDATE rrhh_liquidacion_jornadas
  SET
    tarifa_hora_base = COALESCE(v_regla.valor_hora, tarifa_hora_base),
    tarifa_hora_extra = COALESCE(v_regla.valor_hora, tarifa_hora_extra),
    updated_at = NOW()
  WHERE liquidacion_id = p_liquidacion_id
    AND origen IN ('auto_hik', 'auto_asistencia');

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

  IF EXISTS (
    SELECT 1
    FROM rrhh_asistencia a
    WHERE a.empleado_id = v_liq.empleado_id
      AND EXTRACT(MONTH FROM a.fecha) = v_liq.periodo_mes
      AND EXTRACT(YEAR FROM a.fecha) = v_liq.periodo_anio
      AND a.falta_sin_aviso = true
  ) THEN
    v_descuento_presentismo := COALESCE(v_regla.valor_jornal, 0);
  END IF;

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
  v_total_s_descuentos := ROUND(COALESCE(v_monto_mensual, 0) + COALESCE(v_monto_extra, 0) + COALESCE(v_monto_turno, 0) + COALESCE(v_total_cajero, 0), 2);
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

COMMIT;;
