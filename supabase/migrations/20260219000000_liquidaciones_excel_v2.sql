BEGIN;

-- ===========================================
-- LIQUIDACIONES V2 - PARIDAD CON PLANILLA EXCEL
-- Fecha: 2026-02-19
-- ===========================================

ALTER TABLE rrhh_liquidaciones
ADD COLUMN IF NOT EXISTS puesto_override VARCHAR(120),
ADD COLUMN IF NOT EXISTS dias_base INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS horas_jornada DECIMAL(8,2) DEFAULT 9,
ADD COLUMN IF NOT EXISTS valor_jornal DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_hora DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dias_cajero DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS diferencia_turno_cajero DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cajero DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sin_descuentos DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS adelanto_mercaderia_total DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS adelanto_efectivo_total DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS descuento_presentismo DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS control_30_limite DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS control_30_anticipos DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS control_30_superado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS orden_pago INTEGER,
ADD COLUMN IF NOT EXISTS pago_autorizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS motivo_no_autorizado TEXT,
ADD COLUMN IF NOT EXISTS total_por_dia DECIMAL(12,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS rrhh_liquidacion_reglas_periodo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    periodo_mes INTEGER NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
    periodo_anio INTEGER NOT NULL CHECK (periodo_anio >= 2000),
    dias_base_galpon INTEGER NOT NULL DEFAULT 27 CHECK (dias_base_galpon > 0),
    dias_base_sucursales INTEGER NOT NULL DEFAULT 31 CHECK (dias_base_sucursales > 0),
    dias_base_rrhh INTEGER NOT NULL DEFAULT 22 CHECK (dias_base_rrhh > 0),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (periodo_mes, periodo_anio)
);

CREATE TABLE IF NOT EXISTS rrhh_liquidacion_reglas_puesto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    puesto_codigo VARCHAR(120) NOT NULL UNIQUE,
    categoria_id UUID REFERENCES rrhh_categorias(id),
    grupo_base_dias VARCHAR(20) NOT NULL DEFAULT 'galpon' CHECK (grupo_base_dias IN ('galpon', 'sucursales', 'rrhh')),
    horas_jornada DECIMAL(8,2) NOT NULL DEFAULT 9 CHECK (horas_jornada > 0),
    tarifa_turno_especial DECIMAL(12,2) NOT NULL DEFAULT 0,
    habilita_cajero BOOLEAN NOT NULL DEFAULT false,
    tarifa_diferencia_cajero DECIMAL(12,2) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rrhh_liquidacion_jornadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquidacion_id UUID NOT NULL REFERENCES rrhh_liquidaciones(id) ON DELETE CASCADE,
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    fecha DATE NOT NULL,
    turno VARCHAR(20) NOT NULL DEFAULT 'general',
    tarea VARCHAR(255),
    horas_mensuales DECIMAL(8,2) NOT NULL DEFAULT 0,
    horas_adicionales DECIMAL(8,2) NOT NULL DEFAULT 0,
    turno_especial_unidades DECIMAL(8,2) NOT NULL DEFAULT 0,
    tarifa_hora_base DECIMAL(12,2) NOT NULL DEFAULT 0,
    tarifa_hora_extra DECIMAL(12,2) NOT NULL DEFAULT 0,
    tarifa_turno_especial DECIMAL(12,2) NOT NULL DEFAULT 0,
    monto_mensual DECIMAL(12,2) GENERATED ALWAYS AS (horas_mensuales * tarifa_hora_base) STORED,
    monto_extra DECIMAL(12,2) GENERATED ALWAYS AS (horas_adicionales * tarifa_hora_extra) STORED,
    monto_turno_especial DECIMAL(12,2) GENERATED ALWAYS AS (turno_especial_unidades * tarifa_turno_especial) STORED,
    origen VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (origen IN ('auto_hik', 'auto_asistencia', 'manual')),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_liquidacion_jornadas_liquidacion ON rrhh_liquidacion_jornadas(liquidacion_id);
CREATE INDEX IF NOT EXISTS idx_rrhh_liquidacion_jornadas_empleado_fecha ON rrhh_liquidacion_jornadas(empleado_id, fecha);

CREATE TABLE IF NOT EXISTS rrhh_adelanto_planes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('dinero', 'producto')),
    monto_total DECIMAL(12,2) NOT NULL CHECK (monto_total > 0),
    descripcion TEXT,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    cantidad_cuotas INTEGER NOT NULL DEFAULT 1 CHECK (cantidad_cuotas > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'cancelado')),
    created_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_adelanto_planes_empleado ON rrhh_adelanto_planes(empleado_id);

CREATE TABLE IF NOT EXISTS rrhh_adelanto_cuotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES rrhh_adelanto_planes(id) ON DELETE CASCADE,
    nro_cuota INTEGER NOT NULL CHECK (nro_cuota > 0),
    periodo_mes INTEGER NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
    periodo_anio INTEGER NOT NULL CHECK (periodo_anio >= 2000),
    monto_cuota DECIMAL(12,2) NOT NULL CHECK (monto_cuota >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aplicada', 'cancelada')),
    liquidacion_id UUID REFERENCES rrhh_liquidaciones(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(plan_id, nro_cuota),
    UNIQUE(plan_id, periodo_mes, periodo_anio)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_adelanto_cuotas_periodo ON rrhh_adelanto_cuotas(periodo_anio, periodo_mes);

ALTER TABLE rrhh_liquidacion_reglas_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_liquidacion_reglas_puesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_liquidacion_jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_adelanto_planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_adelanto_cuotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_liquidacion_reglas_periodo" ON rrhh_liquidacion_reglas_periodo;
CREATE POLICY "Admin full access on rrhh_liquidacion_reglas_periodo"
ON rrhh_liquidacion_reglas_periodo
FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

DROP POLICY IF EXISTS "Admin full access on rrhh_liquidacion_reglas_puesto" ON rrhh_liquidacion_reglas_puesto;
CREATE POLICY "Admin full access on rrhh_liquidacion_reglas_puesto"
ON rrhh_liquidacion_reglas_puesto
FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

DROP POLICY IF EXISTS "Admin full access on rrhh_liquidacion_jornadas" ON rrhh_liquidacion_jornadas;
CREATE POLICY "Admin full access on rrhh_liquidacion_jornadas"
ON rrhh_liquidacion_jornadas
FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

DROP POLICY IF EXISTS "Empleados ven sus propias jornadas liquidacion" ON rrhh_liquidacion_jornadas;
CREATE POLICY "Empleados ven sus propias jornadas liquidacion"
ON rrhh_liquidacion_jornadas
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM rrhh_liquidaciones l
        JOIN rrhh_empleados e ON e.id = l.empleado_id
        WHERE l.id = liquidacion_id
          AND e.usuario_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admin full access on rrhh_adelanto_planes" ON rrhh_adelanto_planes;
CREATE POLICY "Admin full access on rrhh_adelanto_planes"
ON rrhh_adelanto_planes
FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

DROP POLICY IF EXISTS "Empleados ven sus propios planes de adelanto" ON rrhh_adelanto_planes;
CREATE POLICY "Empleados ven sus propios planes de adelanto"
ON rrhh_adelanto_planes
FOR SELECT USING (
    empleado_id IN (SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin full access on rrhh_adelanto_cuotas" ON rrhh_adelanto_cuotas;
CREATE POLICY "Admin full access on rrhh_adelanto_cuotas"
ON rrhh_adelanto_cuotas
FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

DROP POLICY IF EXISTS "Empleados ven sus propias cuotas de adelanto" ON rrhh_adelanto_cuotas;
CREATE POLICY "Empleados ven sus propias cuotas de adelanto"
ON rrhh_adelanto_cuotas
FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM rrhh_adelanto_planes p
      JOIN rrhh_empleados e ON e.id = p.empleado_id
      WHERE p.id = plan_id AND e.usuario_id = auth.uid()
    )
);

CREATE OR REPLACE FUNCTION fn_rrhh_resolver_regla_puesto(
  p_empleado_id UUID,
  p_mes INTEGER,
  p_anio INTEGER,
  p_puesto_override TEXT DEFAULT NULL
)
RETURNS TABLE (
  puesto_codigo TEXT,
  grupo_base_dias TEXT,
  dias_base INTEGER,
  horas_jornada DECIMAL,
  tarifa_turno_especial DECIMAL,
  habilita_cajero BOOLEAN,
  tarifa_diferencia_cajero DECIMAL,
  sueldo_basico DECIMAL,
  valor_jornal DECIMAL,
  valor_hora DECIMAL
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

  v_dias := CASE
    WHEN v_grupo = 'rrhh' THEN v_regla_periodo.dias_base_rrhh
    WHEN v_grupo = 'sucursales' THEN v_regla_periodo.dias_base_sucursales
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
    v_valor_hora;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

  SELECT
    COALESCE(SUM(horas_mensuales), 0),
    COALESCE(SUM(horas_adicionales), 0),
    COALESCE(SUM(turno_especial_unidades), 0),
    COALESCE(SUM(monto_mensual), 0),
    COALESCE(SUM(monto_extra), 0),
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
    LEAST(COALESCE(a.horas_trabajadas, 0), COALESCE(v_regla.horas_jornada, 9)),
    GREATEST(COALESCE(a.horas_trabajadas, 0) - COALESCE(v_regla.horas_jornada, 9), 0),
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

CREATE OR REPLACE FUNCTION fn_calcular_liquidacion_mensual(
    p_empleado_id UUID,
    p_mes INTEGER,
    p_anio INTEGER,
    p_created_by UUID
) RETURNS UUID AS $$
BEGIN
  RETURN fn_rrhh_preparar_liquidacion_mensual(p_empleado_id, p_mes, p_anio, p_created_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_calcular_liquidacion(
    p_empleado_id UUID,
    p_mes INTEGER,
    p_anio INTEGER,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
BEGIN
  RETURN fn_rrhh_preparar_liquidacion_mensual(p_empleado_id, p_mes, p_anio, p_created_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO rrhh_liquidacion_reglas_periodo (
  periodo_mes,
  periodo_anio,
  dias_base_galpon,
  dias_base_sucursales,
  dias_base_rrhh,
  activo
) VALUES (1, 2026, 27, 31, 22, true)
ON CONFLICT (periodo_mes, periodo_anio) DO NOTHING;

INSERT INTO rrhh_liquidacion_reglas_puesto (
  puesto_codigo,
  grupo_base_dias,
  horas_jornada,
  tarifa_turno_especial,
  habilita_cajero,
  tarifa_diferencia_cajero,
  activo
)
VALUES
  ('repartidor', 'galpon', 9, 25925.93, false, 0, true),
  ('tesoreria', 'rrhh', 9, 0, true, 0, true),
  ('almacen', 'galpon', 9, 12962.96, false, 0, true),
  ('produccion', 'galpon', 9, 0, false, 0, true),
  ('ventas', 'galpon', 8, 12500, false, 0, true),
  ('encargado suc.', 'sucursales', 9, 0, true, 0, true),
  ('asistente suc.', 'sucursales', 9, 0, false, 0, true),
  ('asist. 1/2 dia suc.', 'sucursales', 9, 0, false, 0, true),
  ('rrhh', 'rrhh', 9, 0, false, 0, true),
  ('limpieza', 'galpon', 8, 0, false, 0, true)
ON CONFLICT (puesto_codigo) DO NOTHING;

COMMIT;

