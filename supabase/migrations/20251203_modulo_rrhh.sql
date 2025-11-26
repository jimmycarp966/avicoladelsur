-- ===========================================
-- AVÍCOLA DEL SUR - MÓDULO RRHH
-- ===========================================

-- SUCURSALES (si no existe)
CREATE TABLE IF NOT EXISTS sucursales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    encargado_id UUID, -- referencia a empleado
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CATEGORÍAS DE EMPLEADOS
CREATE TABLE rrhh_categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    sueldo_basico DECIMAL(10,2) NOT NULL,
    adicional_cajero DECIMAL(10,2) DEFAULT 0,
    adicional_produccion DECIMAL(10,2) DEFAULT 0, -- por kg
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EMPLEADOS (extensión de usuarios)
CREATE TABLE rrhh_empleados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id),
    categoria_id UUID REFERENCES rrhh_categorias(id),
    legajo VARCHAR(20) UNIQUE,
    fecha_ingreso DATE NOT NULL,
    fecha_nacimiento DATE,
    dni VARCHAR(20),
    cuil VARCHAR(20),
    domicilio TEXT,
    telefono_personal VARCHAR(20),
    contacto_emergencia VARCHAR(255),
    telefono_emergencia VARCHAR(20),
    obra_social VARCHAR(255),
    numero_afiliado VARCHAR(50),
    banco VARCHAR(100),
    cbu VARCHAR(50),
    numero_cuenta VARCHAR(50),
    sueldo_actual DECIMAL(10,2),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOVEDADES
CREATE TABLE rrhh_novedades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL, -- 'general', 'sucursal', 'categoria'
    sucursal_id UUID REFERENCES sucursales(id), -- NULL si es general
    categoria_id UUID REFERENCES rrhh_categorias(id), -- NULL si no aplica
    fecha_publicacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_expiracion DATE,
    prioridad VARCHAR(20) DEFAULT 'normal', -- 'baja', 'normal', 'alta', 'urgente'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id)
);

-- ASISTENCIA DIARIA
CREATE TABLE rrhh_asistencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    fecha DATE NOT NULL,
    hora_entrada TIMESTAMP WITH TIME ZONE,
    hora_salida TIMESTAMP WITH TIME ZONE,
    horas_trabajadas DECIMAL(5,2), -- calculadas
    turno VARCHAR(20), -- 'mañana', 'tarde', 'noche'
    estado VARCHAR(20) DEFAULT 'presente', -- 'presente', 'ausente', 'tarde', 'licencia'
    observaciones TEXT,
    retraso_minutos INTEGER DEFAULT 0,
    falta_sin_aviso BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empleado_id, fecha)
);

-- LICENCIAS Y DESCANSOS
CREATE TABLE rrhh_licencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    tipo VARCHAR(50) NOT NULL, -- 'vacaciones', 'enfermedad', 'maternidad', 'estudio', 'otro'
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_total INTEGER NOT NULL,
    aprobado BOOLEAN DEFAULT false,
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion DATE,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ADELANTOS
CREATE TABLE rrhh_adelantos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    tipo VARCHAR(20) NOT NULL, -- 'dinero', 'producto'
    monto DECIMAL(10,2),
    producto_id UUID REFERENCES productos(id), -- si es adelanto en producto
    cantidad DECIMAL(10,2), -- si es adelanto en producto
    precio_unitario DECIMAL(10,2), -- precio al momento del adelanto
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    aprobado BOOLEAN DEFAULT false,
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion DATE,
    porcentaje_sueldo DECIMAL(5,2), -- porcentaje del sueldo básico
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIQUIDACIONES DE SUELDOS
CREATE TABLE rrhh_liquidaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    periodo_mes INTEGER NOT NULL, -- 1-12
    periodo_anio INTEGER NOT NULL,
    fecha_liquidacion DATE NOT NULL,

    -- Datos base
    sueldo_basico DECIMAL(10,2) NOT NULL,
    adicional_cajero DECIMAL(10,2) DEFAULT 0,
    adicional_produccion DECIMAL(10,2) DEFAULT 0,

    -- Horas y turnos
    horas_trabajadas DECIMAL(5,2) DEFAULT 0,
    turnos_trabajados INTEGER DEFAULT 0,
    horas_extras DECIMAL(5,2) DEFAULT 0,
    valor_hora_extra DECIMAL(10,2) DEFAULT 0,

    -- Producción (futuro)
    kg_producidos DECIMAL(8,2) DEFAULT 0,
    valor_kg DECIMAL(10,2) DEFAULT 0,

    -- Descuentos y adicionales
    total_bruto DECIMAL(10,2) NOT NULL,
    descuentos_total DECIMAL(10,2) DEFAULT 0,
    adelantos_total DECIMAL(10,2) DEFAULT 0,
    total_neto DECIMAL(10,2) NOT NULL,

    -- Estado y control
    estado VARCHAR(20) DEFAULT 'borrador', -- 'borrador', 'calculada', 'aprobada', 'pagada'
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion DATE,
    pagado BOOLEAN DEFAULT false,
    fecha_pago DATE,

    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES usuarios(id),

    UNIQUE(empleado_id, periodo_mes, periodo_anio)
);

-- DETALLE DE LIQUIDACIONES (desglose)
CREATE TABLE rrhh_liquidacion_detalles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquidacion_id UUID NOT NULL REFERENCES rrhh_liquidaciones(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'sueldo_basico', 'adicional_cajero', 'horas_extras', 'descuento', 'adelanto', etc.
    descripcion VARCHAR(255),
    monto DECIMAL(10,2) NOT NULL,
    referencia_id UUID, -- ID del adelanto, descuento, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DESCUENTOS (distintos de adelantos)
CREATE TABLE rrhh_descuentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    tipo VARCHAR(50) NOT NULL, -- 'multa', 'daño_equipo', 'otro'
    monto DECIMAL(10,2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo TEXT NOT NULL,
    observaciones TEXT, -- para imprimir y firmar
    aprobado BOOLEAN DEFAULT false,
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion DATE,
    liquidacion_id UUID REFERENCES rrhh_liquidaciones(id), -- cuando se incluye en liquidación
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EVALUACIONES DE DESEMPEÑO
CREATE TABLE rrhh_evaluaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id),
    periodo_mes INTEGER NOT NULL,
    periodo_anio INTEGER NOT NULL,

    -- Puntuaciones (1-5)
    puntualidad INTEGER CHECK (puntualidad >= 1 AND puntualidad <= 5),
    rendimiento INTEGER CHECK (rendimiento >= 1 AND rendimiento <= 5),
    actitud INTEGER CHECK (actitud >= 1 AND actitud <= 5),
    responsabilidad INTEGER CHECK (responsabilidad >= 1 AND responsabilidad <= 5),
    trabajo_equipo INTEGER CHECK (trabajo_equipo >= 1 AND trabajo_equipo <= 5),

    -- Cálculo automático
    promedio DECIMAL(3,2) GENERATED ALWAYS AS (
        (puntualidad + rendimiento + actitud + responsabilidad + trabajo_equipo)::DECIMAL / 5
    ) STORED,

    -- Evaluación cualitativa
    fortalezas TEXT,
    areas_mejora TEXT,
    objetivos TEXT,
    comentarios TEXT,

    -- Metadatos
    evaluador_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_evaluacion DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(20) DEFAULT 'borrador', -- 'borrador', 'enviada', 'completada'

    -- Notificación
    notificado BOOLEAN DEFAULT false,
    fecha_notificacion DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(empleado_id, periodo_mes, periodo_anio)
);

-- ÍNDICES PARA MEJOR PERFORMANCE
CREATE INDEX idx_rrhh_empleados_sucursal ON rrhh_empleados(sucursal_id);
CREATE INDEX idx_rrhh_empleados_categoria ON rrhh_empleados(categoria_id);
CREATE INDEX idx_rrhh_asistencia_empleado_fecha ON rrhh_asistencia(empleado_id, fecha);
CREATE INDEX idx_rrhh_liquidaciones_periodo ON rrhh_liquidaciones(periodo_anio, periodo_mes);
CREATE INDEX idx_rrhh_evaluaciones_periodo ON rrhh_evaluaciones(periodo_anio, periodo_mes);

-- POLÍTICAS RLS
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_novedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_licencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_adelantos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_liquidacion_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_descuentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_evaluaciones ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (admin puede hacer todo, empleados ven solo su info)
CREATE POLICY "Admin full access on sucursales" ON sucursales FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');
CREATE POLICY "Admin full access on rrhh_categorias" ON rrhh_categorias FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');
CREATE POLICY "Admin full access on rrhh_empleados" ON rrhh_empleados FOR ALL USING (auth.jwt() ->> 'rol' = 'admin');

-- Empleados pueden ver novedades de su sucursal
CREATE POLICY "Empleados ven novedades generales y de su sucursal" ON rrhh_novedades
    FOR SELECT USING (
        tipo = 'general' OR
        sucursal_id IN (
            SELECT sucursal_id FROM rrhh_empleados
            WHERE usuario_id = auth.uid()
        )
    );

-- Empleados ven solo su propia información
CREATE POLICY "Empleados ven su propia asistencia" ON rrhh_asistencia
    FOR SELECT USING (
        empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados ven sus propias licencias" ON rrhh_licencias
    FOR SELECT USING (
        empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados ven sus propios adelantos" ON rrhh_adelantos
    FOR SELECT USING (
        empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados ven sus propias liquidaciones" ON rrhh_liquidaciones
    FOR SELECT USING (
        empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados ven sus propios descuentos" ON rrhh_descuentos
    FOR SELECT USING (
        empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Empleados ven sus propias evaluaciones" ON rrhh_evaluaciones
    FOR SELECT USING (
        empleado_id IN (
            SELECT id FROM rrhh_empleados WHERE usuario_id = auth.uid()
        )
    );

-- INSERTS DE DATOS INICIALES

-- Sucursales de ejemplo
INSERT INTO sucursales (nombre, direccion, telefono) VALUES
('Casa Central', 'Av. Principal 123, Ciudad Central', '011-1234-5678'),
('Sucursal Norte', 'Calle Norte 456, Ciudad Norte', '011-2345-6789'),
('Sucursal Sur', 'Calle Sur 789, Ciudad Sur', '011-3456-7890');

-- Categorías de empleados
INSERT INTO rrhh_categorias (nombre, descripcion, sueldo_basico, adicional_cajero, adicional_produccion) VALUES
('Ayudante General', 'Personal de apoyo general', 150000.00, 0, 0),
('Cajero', 'Personal de caja', 160000.00, 15000.00, 0),
('Repartidor', 'Personal de reparto', 170000.00, 0, 0),
('Almacenista', 'Personal de almacén', 165000.00, 0, 0),
('Vendedor', 'Personal de ventas', 180000.00, 0, 0),
('Supervisor', 'Personal supervisor', 200000.00, 0, 0),
('Producción', 'Personal de producción', 155000.00, 0, 50.00); -- $50 por kg

-- FUNCIONES RPC PARA RRHH

-- Función para calcular liquidación mensual
CREATE OR REPLACE FUNCTION fn_calcular_liquidacion_mensual(
    p_empleado_id UUID,
    p_mes INTEGER,
    p_anio INTEGER,
    p_created_by UUID
) RETURNS UUID AS $$
DECLARE
    v_liquidacion_id UUID;
    v_empleado RECORD;
    v_asistencia RECORD;
    v_adelantos_total DECIMAL(10,2) := 0;
    v_descuentos_total DECIMAL(10,2) := 0;
    v_horas_trabajadas DECIMAL(5,2) := 0;
    v_turnos_trabajados INTEGER := 0;
    v_horas_extras DECIMAL(5,2) := 0;
BEGIN
    -- Obtener datos del empleado
    SELECT e.*, c.sueldo_basico, c.adicional_cajero, c.adicional_produccion
    INTO v_empleado
    FROM rrhh_empleados e
    JOIN rrhh_categorias c ON e.categoria_id = c.id
    WHERE e.id = p_empleado_id;

    -- Calcular totales de asistencia
    SELECT
        COALESCE(SUM(horas_trabajadas), 0),
        COUNT(*) FILTER (WHERE turno IS NOT NULL),
        COALESCE(SUM(CASE WHEN horas_trabajadas > 8 THEN horas_trabajadas - 8 ELSE 0 END), 0)
    INTO v_horas_trabajadas, v_turnos_trabajados, v_horas_extras
    FROM rrhh_asistencia
    WHERE empleado_id = p_empleado_id
    AND EXTRACT(MONTH FROM fecha) = p_mes
    AND EXTRACT(YEAR FROM fecha) = p_anio
    AND estado = 'presente';

    -- Calcular totales de adelantos
    SELECT COALESCE(SUM(monto), 0)
    INTO v_adelantos_total
    FROM rrhh_adelantos
    WHERE empleado_id = p_empleado_id
    AND aprobado = true
    AND EXTRACT(MONTH FROM fecha_aprobacion) = p_mes
    AND EXTRACT(YEAR FROM fecha_aprobacion) = p_anio;

    -- Calcular totales de descuentos
    SELECT COALESCE(SUM(monto), 0)
    INTO v_descuentos_total
    FROM rrhh_descuentos
    WHERE empleado_id = p_empleado_id
    AND aprobado = true
    AND EXTRACT(MONTH FROM fecha) = p_mes
    AND EXTRACT(YEAR FROM fecha) = p_anio;

    -- Crear liquidación
    INSERT INTO rrhh_liquidaciones (
        empleado_id, periodo_mes, periodo_anio, fecha_liquidacion,
        sueldo_basico, adicional_cajero, adicional_produccion,
        horas_trabajadas, turnos_trabajados, horas_extras,
        valor_hora_extra, total_bruto, descuentos_total, adelantos_total,
        total_neto, estado, created_by
    ) VALUES (
        p_empleado_id, p_mes, p_anio, CURRENT_DATE,
        v_empleado.sueldo_basico, v_empleado.adicional_cajero, v_empleado.adicional_produccion,
        v_horas_trabajadas, v_turnos_trabajados, v_horas_extras,
        v_empleado.sueldo_basico / 160, -- valor hora (sueldo mensual / 160 horas)
        v_empleado.sueldo_basico + v_empleado.adicional_cajero + (v_horas_extras * (v_empleado.sueldo_basico / 160)),
        v_descuentos_total, v_adelantos_total,
        v_empleado.sueldo_basico + v_empleado.adicional_cajero + (v_horas_extras * (v_empleado.sueldo_basico / 160)) - v_descuentos_total - v_adelantos_total,
        'calculada', p_created_by
    ) RETURNING id INTO v_liquidacion_id;

    -- Insertar detalles de la liquidación
    INSERT INTO rrhh_liquidacion_detalles (liquidacion_id, tipo, descripcion, monto) VALUES
    (v_liquidacion_id, 'sueldo_basico', 'Sueldo básico mensual', v_empleado.sueldo_basico),
    (v_liquidacion_id, 'adicional_cajero', 'Adicional cajero', v_empleado.adicional_cajero),
    (v_liquidacion_id, 'horas_extras', 'Horas extras (' || v_horas_extras || ')', v_horas_extras * (v_empleado.sueldo_basico / 160)),
    (v_liquidacion_id, 'descuentos', 'Descuentos totales', -v_descuentos_total),
    (v_liquidacion_id, 'adelantos', 'Adelantos totales', -v_adelantos_total);

    RETURN v_liquidacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar límite de adelantos (30% del sueldo básico)
CREATE OR REPLACE FUNCTION fn_validar_limite_adelanto(
    p_empleado_id UUID,
    p_monto DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_sueldo_basico DECIMAL(10,2);
    v_limite_maximo DECIMAL(10,2);
    v_adelantos_mes_actual DECIMAL(10,2);
BEGIN
    -- Obtener sueldo básico
    SELECT c.sueldo_basico INTO v_sueldo_basico
    FROM rrhh_empleados e
    JOIN rrhh_categorias c ON e.categoria_id = c.id
    WHERE e.id = p_empleado_id;

    v_limite_maximo := v_sueldo_basico * 0.3; -- 30%

    -- Calcular adelantos del mes actual
    SELECT COALESCE(SUM(monto), 0) INTO v_adelantos_mes_actual
    FROM rrhh_adelantos
    WHERE empleado_id = p_empleado_id
    AND aprobado = true
    AND EXTRACT(MONTH FROM fecha_aprobacion) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM fecha_aprobacion) = EXTRACT(YEAR FROM CURRENT_DATE);

    RETURN (v_adelantos_mes_actual + p_monto) <= v_limite_maximo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para marcar asistencia automática
CREATE OR REPLACE FUNCTION fn_marcar_asistencia(
    p_empleado_id UUID,
    p_fecha DATE,
    p_hora_entrada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_turno VARCHAR(20) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_asistencia_id UUID;
    v_retraso_minutos INTEGER := 0;
BEGIN
    -- Calcular retraso si hay turno definido
    IF p_turno = 'mañana' AND EXTRACT(HOUR FROM p_hora_entrada) >= 9 THEN
        v_retraso_minutos := EXTRACT(EPOCH FROM (p_hora_entrada - (p_fecha + INTERVAL '9 hours'))) / 60;
    ELSIF p_turno = 'tarde' AND EXTRACT(HOUR FROM p_hora_entrada) >= 15 THEN
        v_retraso_minutos := EXTRACT(EPOCH FROM (p_hora_entrada - (p_fecha + INTERVAL '15 hours'))) / 60;
    END IF;

    INSERT INTO rrhh_asistencia (
        empleado_id, fecha, hora_entrada, turno, retraso_minutos,
        falta_sin_aviso
    ) VALUES (
        p_empleado_id, p_fecha, p_hora_entrada, p_turno, v_retraso_minutos,
        CASE WHEN v_retraso_minutos > 15 THEN true ELSE false END
    ) ON CONFLICT (empleado_id, fecha)
    DO UPDATE SET
        hora_entrada = EXCLUDED.hora_entrada,
        turno = EXCLUDED.turno,
        retraso_minutos = EXCLUDED.retraso_minutos,
        falta_sin_aviso = EXCLUDED.falta_sin_aviso
    RETURNING id INTO v_asistencia_id;

    RETURN v_asistencia_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
