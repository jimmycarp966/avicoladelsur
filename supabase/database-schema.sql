-- ===========================================
-- AVÍCOLA DEL SUR - ESQUEMA DE BASE DE DATOS
-- ===========================================

-- EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ===========================================
-- TABLAS MAESTRAS
-- ===========================================

-- SUCURSALES
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

-- PRODUCTOS
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    precio_venta DECIMAL(10,2) NOT NULL,
    precio_costo DECIMAL(10,2),
    unidad_medida VARCHAR(20) DEFAULT 'kg',
    stock_minimo INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    whatsapp VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    zona_entrega VARCHAR(100),
    coordenadas GEOMETRY(POINT, 4326),
    tipo_cliente VARCHAR(50) DEFAULT 'minorista',
    limite_credito DECIMAL(10,2) DEFAULT 0,
    bloqueado_por_deuda BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VEHÍCULOS
CREATE TABLE vehiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patente VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(100),
    modelo VARCHAR(100),
    capacidad_kg INTEGER NOT NULL,
    tipo_vehiculo VARCHAR(50) DEFAULT 'camioneta',
    seguro_vigente BOOLEAN DEFAULT true,
    fecha_vto_seguro DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USUARIOS/EMPLEADOS
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255),
    telefono VARCHAR(20),
    rol VARCHAR(50) NOT NULL, -- admin, vendedor, repartidor, almacenista
    vehiculo_asignado UUID REFERENCES vehiculos(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOMINIO: RRHH - RECURSOS HUMANOS
-- ===========================================

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

-- CATEGORÍAS DE EMPLEADOS
CREATE TABLE rrhh_categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    sueldo_basico DECIMAL(10,2) NOT NULL,
    adicional_cajero DECIMAL(10,2) DEFAULT 0,
    adicional_produccion DECIMAL(10,2) DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOVEDADES RRHH
CREATE TABLE rrhh_novedades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL,
    sucursal_id UUID REFERENCES sucursales(id),
    categoria_id UUID REFERENCES rrhh_categorias(id),
    fecha_publicacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_expiracion DATE,
    prioridad VARCHAR(20) DEFAULT 'normal',
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
    horas_trabajadas DECIMAL(5,2),
    turno VARCHAR(20),
    estado VARCHAR(20) DEFAULT 'presente',
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
    tipo VARCHAR(50) NOT NULL,
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
    tipo VARCHAR(20) NOT NULL,
    monto DECIMAL(10,2),
    producto_id UUID REFERENCES productos(id),
    cantidad DECIMAL(10,2),
    precio_unitario DECIMAL(10,2),
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    aprobado BOOLEAN DEFAULT false,
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion DATE,
    porcentaje_sueldo DECIMAL(5,2),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LIQUIDACIONES DE SUELDOS
CREATE TABLE rrhh_liquidaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    periodo_mes INTEGER NOT NULL,
    periodo_anio INTEGER NOT NULL,
    fecha_liquidacion DATE NOT NULL,
    sueldo_basico DECIMAL(10,2) NOT NULL,
    adicional_cajero DECIMAL(10,2) DEFAULT 0,
    adicional_produccion DECIMAL(10,2) DEFAULT 0,
    horas_trabajadas DECIMAL(5,2) DEFAULT 0,
    turnos_trabajados INTEGER DEFAULT 0,
    horas_extras DECIMAL(5,2) DEFAULT 0,
    valor_hora_extra DECIMAL(10,2) DEFAULT 0,
    kg_producidos DECIMAL(8,2) DEFAULT 0,
    valor_kg DECIMAL(10,2) DEFAULT 0,
    total_bruto DECIMAL(10,2) NOT NULL,
    descuentos_total DECIMAL(10,2) DEFAULT 0,
    adelantos_total DECIMAL(10,2) DEFAULT 0,
    total_neto DECIMAL(10,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'borrador',
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

-- DETALLE DE LIQUIDACIONES
CREATE TABLE rrhh_liquidacion_detalles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquidacion_id UUID NOT NULL REFERENCES rrhh_liquidaciones(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255),
    monto DECIMAL(10,2) NOT NULL,
    referencia_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DESCUENTOS
CREATE TABLE rrhh_descuentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id),
    tipo VARCHAR(50) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    aprobado BOOLEAN DEFAULT false,
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion DATE,
    liquidacion_id UUID REFERENCES rrhh_liquidaciones(id),
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
    puntualidad INTEGER CHECK (puntualidad >= 1 AND puntualidad <= 5),
    rendimiento INTEGER CHECK (rendimiento >= 1 AND rendimiento <= 5),
    actitud INTEGER CHECK (actitud >= 1 AND actitud <= 5),
    responsabilidad INTEGER CHECK (responsabilidad >= 1 AND responsabilidad <= 5),
    trabajo_equipo INTEGER CHECK (trabajo_equipo >= 1 AND trabajo_equipo <= 5),
    promedio DECIMAL(3,2) GENERATED ALWAYS AS (
        (puntualidad + rendimiento + actitud + responsabilidad + trabajo_equipo)::DECIMAL / 5
    ) STORED,
    fortalezas TEXT,
    areas_mejora TEXT,
    objetivos TEXT,
    comentarios TEXT,
    evaluador_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_evaluacion DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(20) DEFAULT 'borrador',
    notificado BOOLEAN DEFAULT false,
    fecha_notificacion DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empleado_id, periodo_mes, periodo_anio)
);

-- ===========================================
-- DOMINIO: TESORERÍA Y TESORERÍA/GASTOS
-- ===========================================

-- CAJAS
CREATE TABLE tesoreria_cajas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID,
    nombre VARCHAR(120) NOT NULL,
    saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
    saldo_actual NUMERIC(14,2) NOT NULL DEFAULT 0,
    moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MOVIMIENTOS DE CAJA
CREATE TABLE tesoreria_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caja_id UUID NOT NULL REFERENCES tesoreria_cajas(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso','egreso')),
    monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
    descripcion TEXT,
    origen_tipo VARCHAR(50),
    origen_id UUID,
    metodo_pago VARCHAR(30) DEFAULT 'efectivo',
    user_id UUID REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CATEGORÍAS DE GASTOS
CREATE TABLE gastos_categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(120) UNIQUE NOT NULL,
    descripcion TEXT,
    color VARCHAR(16),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GASTOS
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID,
    categoria_id UUID REFERENCES gastos_categorias(id),
    monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
    comprobante_url TEXT,
    descripcion TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_por UUID REFERENCES usuarios(id),
    afecta_caja BOOLEAN NOT NULL DEFAULT false,
    caja_id UUID REFERENCES tesoreria_cajas(id),
    caja_movimiento_id UUID REFERENCES tesoreria_movimientos(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CUENTAS CORRIENTES DE CLIENTES
CREATE TABLE cuentas_corrientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID UNIQUE NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
    limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MOVIMIENTOS DE CUENTAS CORRIENTES
CREATE TABLE cuentas_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuenta_corriente_id UUID NOT NULL REFERENCES cuentas_corrientes(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cargo','pago')),
    monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
    descripcion TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    origen_tipo VARCHAR(50),
    origen_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REGISTRO DE EXPORTES/REPORTES
CREATE TABLE reportes_export (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(60) NOT NULL,
    filtros JSONB,
    formato VARCHAR(10) NOT NULL DEFAULT 'csv',
    url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    generated_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ===========================================
-- DOMINIO: ALMACÉN (WMS)
-- ===========================================

-- LOTES/MERCADERÍA
CREATE TABLE lotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_lote VARCHAR(50) UNIQUE NOT NULL,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad_ingresada DECIMAL(10,3) NOT NULL,
    cantidad_disponible DECIMAL(10,3) NOT NULL,
    fecha_ingreso DATE NOT NULL,
    fecha_vencimiento DATE,
    proveedor VARCHAR(255),
    costo_unitario DECIMAL(10,2),
    ubicacion_almacen VARCHAR(100),
    estado VARCHAR(50) DEFAULT 'disponible', -- disponible, reservado, vencido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MOVIMIENTOS DE STOCK
CREATE TABLE movimientos_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes(id),
    tipo_movimiento VARCHAR(50) NOT NULL, -- ingreso, salida, ajuste
    cantidad DECIMAL(10,3) NOT NULL,
    motivo TEXT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    pedido_id UUID, -- puede ser null si no es por pedido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CHECKLISTS DE CALIDAD
CREATE TABLE checklists_calidad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    temperatura DECIMAL(5,2),
    humedad DECIMAL(5,2),
    apariencia VARCHAR(255),
    aprobado BOOLEAN NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOMINIO: LISTAS DE PRECIOS
-- ===========================================

-- LISTAS DE PRECIOS
CREATE TABLE IF NOT EXISTS listas_precios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('minorista', 'mayorista', 'distribuidor', 'personalizada')),
    activa BOOLEAN DEFAULT true,
    margen_ganancia DECIMAL(5,2), -- Porcentaje de margen (ej: 30.00 = 30%)
    fecha_vigencia_desde DATE,
    fecha_vigencia_hasta DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRECIOS POR PRODUCTO Y LISTA
CREATE TABLE IF NOT EXISTS precios_productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lista_precio_id UUID NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    precio DECIMAL(10,2) NOT NULL,
    fecha_desde DATE,
    fecha_hasta DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lista_precio_id, producto_id, fecha_desde)
);

-- ASIGNACIÓN DE LISTAS A CLIENTES (muchos a muchos)
CREATE TABLE IF NOT EXISTS clientes_listas_precios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    lista_precio_id UUID NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
    es_automatica BOOLEAN DEFAULT false,
    prioridad INTEGER DEFAULT 1,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, lista_precio_id)
);

-- ===========================================
-- DOMINIO: VENTAS (CRM)
-- ===========================================

-- PEDIDOS
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_pedido VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    usuario_vendedor UUID REFERENCES usuarios(id), -- puede ser null si viene del bot
    fecha_pedido TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_entrega_estimada DATE,
    fecha_entrega_real TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, confirmado, preparando, enviado, entregado, cancelado
    tipo_pedido VARCHAR(50) DEFAULT 'venta', -- venta, cotizacion
    origen VARCHAR(50) DEFAULT 'web', -- web, whatsapp, telefono
    subtotal DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    observaciones TEXT,
    pago_estado VARCHAR(20) DEFAULT 'pendiente',
    caja_movimiento_id UUID REFERENCES tesoreria_movimientos(id),
    lista_precio_id UUID REFERENCES listas_precios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DETALLES DE PEDIDO
CREATE TABLE detalles_pedido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id),
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_id UUID REFERENCES lotes(id), -- lote específico asignado
    cantidad DECIMAL(10,3) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FACTURAS (documentos internos ligados a pedidos)
CREATE TABLE IF NOT EXISTS facturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    pedido_id UUID NOT NULL REFERENCES pedidos(id),
    fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subtotal DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'emitida', -- emitida, anulada
    tipo VARCHAR(20) DEFAULT 'interna',   -- interna (sin AFIP por ahora)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factura_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad DECIMAL(10,3) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COTIZACIONES
CREATE TABLE cotizaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_cotizacion VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    usuario_vendedor UUID REFERENCES usuarios(id),
    fecha_cotizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_vencimiento DATE,
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, aprobada, rechazada, vencida
    subtotal DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DETALLES DE COTIZACIÓN
CREATE TABLE detalles_cotizacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id),
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad DECIMAL(10,3) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RECLAMOS
CREATE TABLE reclamos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_reclamo VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    pedido_id UUID REFERENCES pedidos(id),
    tipo_reclamo VARCHAR(100) NOT NULL, -- producto_dañado, entrega_tardia, cantidad_erronea, etc
    descripcion TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'abierto', -- abierto, investigando, resuelto, cerrado
    prioridad VARCHAR(20) DEFAULT 'media', -- baja, media, alta
    fecha_resolucion TIMESTAMP WITH TIME ZONE,
    solucion TEXT,
    usuario_asignado UUID REFERENCES usuarios(id),
    origen VARCHAR(50) DEFAULT 'telefono', -- telefono, whatsapp, web
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOMINIO: REPARTO (TMS)
-- ===========================================

-- CHECKLISTS DE VEHÍCULOS
CREATE TABLE checklists_vehiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehiculo_id UUID NOT NULL REFERENCES vehiculos(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_check DATE NOT NULL,
    aceite_motor BOOLEAN DEFAULT false,
    luces BOOLEAN DEFAULT false,
    frenos BOOLEAN DEFAULT false,
    presion_neumaticos BOOLEAN DEFAULT false,
    limpieza_interior BOOLEAN DEFAULT false,
    limpieza_exterior BOOLEAN DEFAULT false,
    combustible DECIMAL(5,2), -- porcentaje
    kilometraje INTEGER,
    observaciones TEXT,
    aprobado BOOLEAN NOT NULL,
    fotos_url JSONB, -- array de URLs de fotos en Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RUTAS DE REPARTO
CREATE TABLE rutas_reparto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_ruta VARCHAR(50) UNIQUE NOT NULL,
    vehiculo_id UUID NOT NULL REFERENCES vehiculos(id),
    repartidor_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_ruta DATE NOT NULL,
    estado VARCHAR(50) DEFAULT 'planificada', -- planificada, en_curso, completada, cancelada
    distancia_estimada_km DECIMAL(8,2),
    distancia_real_km DECIMAL(8,2),
    tiempo_estimado_min INTEGER,
    tiempo_real_min INTEGER,
    peso_total_kg DECIMAL(8,2),
    costo_combustible DECIMAL(8,2),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DETALLES DE RUTA (pedidos asignados)
CREATE TABLE detalles_ruta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID NOT NULL REFERENCES rutas_reparto(id),
    pedido_id UUID NOT NULL REFERENCES pedidos(id),
    orden_entrega INTEGER NOT NULL, -- orden en la ruta
    distancia_parcial_km DECIMAL(6,2),
    tiempo_estimado_parcial_min INTEGER,
    coordenadas_entrega GEOMETRY(POINT, 4326),
    estado_entrega VARCHAR(50) DEFAULT 'pendiente', -- pendiente, en_camino, entregado, fallido
    fecha_hora_entrega TIMESTAMP WITH TIME ZONE,
    notas_entrega TEXT,
    firma_url VARCHAR(500), -- URL de la firma digital en Storage
    qr_verificacion VARCHAR(100), -- código QR único para verificación
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===========================================

-- Índices principales
CREATE INDEX idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX idx_detalles_pedido_pedido_id ON detalles_pedido(pedido_id);
CREATE INDEX idx_lotes_producto_id ON lotes(producto_id);
CREATE INDEX idx_lotes_estado ON lotes(estado);
CREATE INDEX idx_movimientos_stock_lote_id ON movimientos_stock(lote_id);
CREATE INDEX idx_rutas_fecha ON rutas_reparto(fecha_ruta);
CREATE INDEX idx_detalles_ruta_ruta_id ON detalles_ruta(ruta_id);
CREATE INDEX idx_tesoreria_movimientos_caja_id ON tesoreria_movimientos(caja_id);
CREATE INDEX idx_tesoreria_movimientos_origen ON tesoreria_movimientos(origen_tipo, origen_id);
CREATE INDEX idx_gastos_categoria ON gastos(categoria_id);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_cuentas_corrientes_cliente ON cuentas_corrientes(cliente_id);
CREATE INDEX idx_cuentas_movimientos_cuenta ON cuentas_movimientos(cuenta_corriente_id);

-- Índices geoespaciales
CREATE INDEX idx_clientes_coordenadas ON clientes USING GIST (coordenadas);
CREATE INDEX idx_detalles_ruta_coordenadas ON detalles_ruta USING GIST (coordenadas_entrega);

-- ===========================================
-- FUNCIONES RPC (REMOTE PROCEDURE CALL)
-- ===========================================

-- Función para crear movimiento de caja
CREATE OR REPLACE FUNCTION fn_crear_movimiento_caja(
    p_caja_id UUID,
    p_tipo VARCHAR,
    p_monto NUMERIC,
    p_descripcion TEXT DEFAULT NULL,
    p_origen_tipo VARCHAR DEFAULT NULL,
    p_origen_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_metodo_pago VARCHAR DEFAULT 'efectivo'
) RETURNS JSONB AS $$
DECLARE
    v_caja RECORD;
    v_movimiento_id UUID;
    v_nuevo_saldo NUMERIC;
    v_user UUID;
BEGIN
    IF p_tipo NOT IN ('ingreso','egreso') THEN
        RAISE EXCEPTION 'Tipo inválido %', p_tipo;
    END IF;

    SELECT * INTO v_caja FROM tesoreria_cajas WHERE id = p_caja_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Caja no encontrada';
    END IF;

    v_nuevo_saldo := CASE
        WHEN p_tipo = 'ingreso' THEN v_caja.saldo_actual + p_monto
        ELSE v_caja.saldo_actual - p_monto
    END;

    v_user := COALESCE(
        p_user_id,
        (SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY created_at ASC LIMIT 1)
    );

    INSERT INTO tesoreria_movimientos (
        caja_id, tipo, monto, descripcion, origen_tipo, origen_id, user_id, metodo_pago
    ) VALUES (
        p_caja_id, p_tipo, p_monto, p_descripcion, p_origen_tipo, p_origen_id, v_user, p_metodo_pago
    ) RETURNING id INTO v_movimiento_id;

    UPDATE tesoreria_cajas
    SET saldo_actual = v_nuevo_saldo,
        updated_at = NOW()
    WHERE id = p_caja_id;

    RETURN jsonb_build_object(
        'success', true,
        'movimiento_id', v_movimiento_id,
        'saldo_actual', v_nuevo_saldo
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar gasto y afectar caja
CREATE OR REPLACE FUNCTION fn_registrar_gasto(
    p_sucursal_id UUID,
    p_categoria_id UUID,
    p_monto NUMERIC,
    p_comprobante_url TEXT DEFAULT NULL,
    p_descripcion TEXT DEFAULT NULL,
    p_fecha DATE DEFAULT CURRENT_DATE,
    p_creado_por UUID,
    p_afectar_caja BOOLEAN DEFAULT false,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_gasto_id UUID;
    v_movimiento JSONB;
BEGIN
    INSERT INTO gastos (
        sucursal_id, categoria_id, monto, comprobante_url,
        descripcion, fecha, creado_por, afecta_caja, caja_id
    ) VALUES (
        p_sucursal_id, p_categoria_id, p_monto, p_comprobante_url,
        p_descripcion, p_fecha, p_creado_por, p_afectar_caja, p_caja_id
    ) RETURNING id INTO v_gasto_id;

    IF p_afectar_caja AND p_caja_id IS NOT NULL THEN
        v_movimiento := fn_crear_movimiento_caja(
            p_caja_id,
            'egreso',
            p_monto,
            COALESCE(p_descripcion, 'Registro de gasto'),
            'gasto',
            v_gasto_id,
            p_creado_por,
            'efectivo'
        );

        IF NOT (v_movimiento->>'success')::BOOLEAN THEN
            RAISE EXCEPTION 'No se pudo registrar movimiento de caja';
        END IF;

        UPDATE gastos
        SET caja_movimiento_id = (v_movimiento->>'movimiento_id')::UUID
        WHERE id = v_gasto_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'gasto_id', v_gasto_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear pago de pedido
CREATE OR REPLACE FUNCTION fn_crear_pago_pedido(
    p_pedido_id UUID,
    p_caja_id UUID,
    p_monto NUMERIC,
    p_tipo_pago VARCHAR DEFAULT 'efectivo',
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_movimiento JSONB;
    v_movimiento_id UUID;
    v_pagado NUMERIC;
    v_nuevo_estado VARCHAR(20);
    v_cuenta RECORD;
BEGIN
    SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;

    v_movimiento := fn_crear_movimiento_caja(
        p_caja_id,
        'ingreso',
        p_monto,
        'Pago de pedido ' || v_pedido.numero_pedido,
        'pedido',
        p_pedido_id,
        p_user_id,
        p_tipo_pago
    );

    IF (v_movimiento->>'success')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'No se pudo crear movimiento de caja';
    END IF;

    v_movimiento_id := (v_movimiento->>'movimiento_id')::UUID;

    SELECT COALESCE(SUM(m.monto), 0)
    INTO v_pagado
    FROM tesoreria_movimientos m
    WHERE m.origen_tipo = 'pedido'
      AND m.origen_id = p_pedido_id
      AND m.tipo = 'ingreso';

    IF v_pagado >= v_pedido.total THEN
        v_nuevo_estado := 'pagado';
    ELSIF v_pagado > 0 THEN
        v_nuevo_estado := 'parcial';
    ELSE
        v_nuevo_estado := 'pendiente';
    END IF;

    UPDATE pedidos
    SET pago_estado = v_nuevo_estado,
        caja_movimiento_id = v_movimiento_id,
        updated_at = NOW()
    WHERE id = p_pedido_id;

    SELECT cc.* INTO v_cuenta
    FROM cuentas_corrientes cc
    WHERE cc.cliente_id = v_pedido.cliente_id
    FOR UPDATE;

    IF FOUND AND v_cuenta.saldo > 0 THEN
        UPDATE cuentas_corrientes
        SET saldo = GREATEST(v_cuenta.saldo - p_monto, 0),
            updated_at = NOW()
        WHERE id = v_cuenta.id;

        INSERT INTO cuentas_movimientos (
            cuenta_corriente_id, tipo, monto, descripcion, origen_tipo, origen_id
        ) VALUES (
            v_cuenta.id, 'pago', p_monto,
            'Pago aplicado al pedido ' || v_pedido.numero_pedido,
            'pedido', p_pedido_id
        );

        UPDATE clientes
        SET bloqueado_por_deuda = CASE
            WHEN (SELECT saldo FROM cuentas_corrientes WHERE id = v_cuenta.id) > v_cuenta.limite_credito THEN true
            ELSE false
        END
        WHERE id = v_pedido.cliente_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pago_estado', v_nuevo_estado,
        'movimiento_id', v_movimiento_id,
        'pagado', v_pagado
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función auxiliar para crear cuenta corriente si no existe
CREATE OR REPLACE FUNCTION fn_asegurar_cuenta_corriente(p_cliente_id UUID)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_limite NUMERIC;
BEGIN
    SELECT id INTO v_id FROM cuentas_corrientes WHERE cliente_id = p_cliente_id;
    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    SELECT limite_credito INTO v_limite FROM clientes WHERE id = p_cliente_id;

    INSERT INTO cuentas_corrientes (cliente_id, saldo, limite_credito)
    VALUES (p_cliente_id, 0, COALESCE(v_limite, 0))
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función transaccional para procesar pedidos (web/bot)
CREATE OR REPLACE FUNCTION fn_procesar_pedido(
    p_cliente_id UUID,
    p_items JSONB,
    p_usuario_id UUID,
    p_fecha_entrega_estimada DATE DEFAULT NULL,
    p_origen VARCHAR DEFAULT 'web',
    p_descuento NUMERIC DEFAULT 0,
    p_pago JSONB DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_numero_pedido VARCHAR(60);
    v_pedido_id UUID;
    v_total NUMERIC := 0;
    v_descuento NUMERIC := COALESCE(p_descuento, 0);
    v_pago_estado VARCHAR(20) := 'pendiente';
    v_pago_monto NUMERIC := COALESCE((p_pago->>'monto')::NUMERIC, 0);
    v_pago_modalidad VARCHAR := COALESCE(p_pago->>'modalidad', 'contado');
    v_pago_tipo VARCHAR := COALESCE(p_pago->>'tipo_pago', 'efectivo');
    v_caja_id UUID := (p_pago->>'caja_id')::UUID;
    v_movimiento JSONB;
    v_movimiento_id UUID;
    v_clte RECORD;
    v_cuenta_id UUID;
    v_saldo NUMERIC;
    v_limite NUMERIC;
    v_item JSONB;
    v_producto RECORD;
    v_precio NUMERIC;
    v_cantidad NUMERIC;
    v_lote RECORD;
    v_pendiente NUMERIC;
    v_utiliza NUMERIC;
    v_usuario_movimiento UUID;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe tener items';
    END IF;

    SELECT * INTO v_clte FROM clientes WHERE id = p_cliente_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente no encontrado';
    END IF;

    v_cuenta_id := fn_asegurar_cuenta_corriente(p_cliente_id);
    SELECT saldo, limite_credito INTO v_saldo, v_limite FROM cuentas_corrientes WHERE id = v_cuenta_id FOR UPDATE;

    IF v_clte.bloqueado_por_deuda THEN
        RAISE EXCEPTION 'El cliente está bloqueado por deuda';
    END IF;

    BEGIN
        EXECUTE 'DROP TABLE IF EXISTS tmp_detalles';
    EXCEPTION
        WHEN undefined_table THEN NULL;
    END;

    CREATE TEMP TABLE tmp_detalles (
        producto_id UUID,
        lote_id UUID,
        cantidad NUMERIC,
        precio NUMERIC,
        subtotal NUMERIC
    ) ON COMMIT DROP;

    v_usuario_movimiento := COALESCE(
        p_usuario_id,
        (SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY created_at ASC LIMIT 1)
    );

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT * INTO v_producto FROM productos WHERE id = (v_item->>'producto_id')::UUID;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado';
        END IF;

        v_precio := COALESCE((v_item->>'precio_unitario')::NUMERIC, v_producto.precio_venta);
        v_cantidad := (v_item->>'cantidad')::NUMERIC;
        IF v_cantidad <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida para producto %', v_producto.nombre;
        END IF;

        v_pendiente := v_cantidad;

        FOR v_lote IN
            SELECT * FROM lotes
            WHERE producto_id = v_producto.id
              AND estado = 'disponible'
              AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
            ORDER BY fecha_vencimiento NULLS LAST, fecha_ingreso
            FOR UPDATE
        LOOP
            EXIT WHEN v_pendiente <= 0;
            IF v_lote.cantidad_disponible <= 0 THEN
                CONTINUE;
            END IF;

            v_utiliza := LEAST(v_lote.cantidad_disponible, v_pendiente);

            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_utiliza,
                updated_at = NOW()
            WHERE id = v_lote.id;

            INSERT INTO tmp_detalles (producto_id, lote_id, cantidad, precio, subtotal)
            VALUES (v_producto.id, v_lote.id, v_utiliza, v_precio, v_utiliza * v_precio);

            v_pendiente := v_pendiente - v_utiliza;
        END LOOP;

        IF v_pendiente > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %', v_producto.nombre;
        END IF;
    END LOOP;

    SELECT COALESCE(SUM(subtotal), 0) INTO v_total FROM tmp_detalles;
    v_total := v_total - v_descuento;
    IF v_total < 0 THEN
        v_total := 0;
    END IF;

    IF v_pago_modalidad = 'credito' AND (v_saldo + v_total) > COALESCE(v_limite, 0) THEN
        RAISE EXCEPTION 'El cliente supera el límite de crédito disponible';
    END IF;

    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI-SS') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    INSERT INTO pedidos (
        numero_pedido, cliente_id, usuario_vendedor, estado,
        tipo_pedido, origen, subtotal, descuento, total,
        observaciones, pago_estado, fecha_entrega_estimada
    ) VALUES (
        v_numero_pedido, p_cliente_id, p_usuario_id, 'confirmado',
        'venta', p_origen, v_total + v_descuento, v_descuento, v_total,
        p_observaciones, 'pendiente', p_fecha_entrega_estimada
    ) RETURNING id INTO v_pedido_id;

    INSERT INTO detalles_pedido (pedido_id, producto_id, lote_id, cantidad, precio_unitario, subtotal)
    SELECT v_pedido_id, producto_id, lote_id, cantidad, precio, subtotal
    FROM tmp_detalles;

    INSERT INTO movimientos_stock (lote_id, tipo_movimiento, cantidad, motivo, usuario_id, pedido_id)
    SELECT
        lote_id,
        'salida'::VARCHAR,
        cantidad,
        'Venta desde ' || p_origen,
        v_usuario_movimiento,
        v_pedido_id
    FROM tmp_detalles;

    IF v_pago_modalidad = 'credito' THEN
        UPDATE cuentas_corrientes
        SET saldo = saldo + v_total,
            updated_at = NOW()
        WHERE id = v_cuenta_id;

        INSERT INTO cuentas_movimientos (
            cuenta_corriente_id, tipo, monto, descripcion, origen_tipo, origen_id
        ) VALUES (
            v_cuenta_id, 'cargo', v_total,
            'Pedido ' || v_numero_pedido,
            'pedido', v_pedido_id
        );

        UPDATE clientes
        SET bloqueado_por_deuda = CASE
            WHEN (SELECT saldo FROM cuentas_corrientes WHERE id = v_cuenta_id) > limite_credito THEN true
            ELSE false
        END
        WHERE id = p_cliente_id;

        v_pago_estado := 'pendiente';
    ELSE
        IF v_pago_monto >= v_total AND v_caja_id IS NOT NULL THEN
            v_movimiento := fn_crear_movimiento_caja(
                v_caja_id,
                'ingreso',
                v_total,
                'Cobro pedido ' || v_numero_pedido,
                'pedido',
                v_pedido_id,
                p_usuario_id,
                v_pago_tipo
            );
            v_pago_estado := 'pagado';
            v_movimiento_id := (v_movimiento->>'movimiento_id')::UUID;
        ELSE
            v_pago_estado := CASE WHEN v_pago_monto > 0 THEN 'parcial' ELSE 'pendiente' END;
            IF v_pago_monto > 0 AND v_caja_id IS NOT NULL THEN
                v_movimiento := fn_crear_movimiento_caja(
                    v_caja_id,
                    'ingreso',
                    v_pago_monto,
                    'Pago parcial pedido ' || v_numero_pedido,
                    'pedido',
                    v_pedido_id,
                    p_usuario_id,
                    v_pago_tipo
                );
                v_movimiento_id := (v_movimiento->>'movimiento_id')::UUID;
            END IF;
        END IF;
    END IF;

    UPDATE pedidos
    SET pago_estado = v_pago_estado,
        caja_movimiento_id = v_movimiento_id
    WHERE id = v_pedido_id;

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total,
        'pago_estado', v_pago_estado
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper de compatibilidad para bot
CREATE OR REPLACE FUNCTION fn_crear_pedido_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_pago JSONB DEFAULT NULL,
    p_fecha_entrega_estimada DATE DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
    RETURN fn_procesar_pedido(
        p_cliente_id,
        p_items,
        NULL,
        p_fecha_entrega_estimada,
        'whatsapp',
        0,
        COALESCE(p_pago, jsonb_build_object('modalidad','credito')),
        COALESCE(p_observaciones, 'Pedido confirmado desde bot')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar entrega (atómica)
CREATE OR REPLACE FUNCTION fn_validar_entrega(
    p_pedido_id UUID,
    p_firma_url VARCHAR(500),
    p_qr_verificacion VARCHAR(100)
) RETURNS JSONB AS $$
DECLARE
    v_ruta_id UUID;
    v_detalle_ruta_id UUID;
BEGIN
    -- Buscar el detalle de ruta correspondiente
    SELECT dr.id, dr.ruta_id INTO v_detalle_ruta_id, v_ruta_id
    FROM detalles_ruta dr
    WHERE dr.pedido_id = p_pedido_id
    AND dr.estado_entrega = 'en_camino';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado en ruta activa');
    END IF;

    -- Actualizar estado de entrega
    UPDATE detalles_ruta
    SET estado_entrega = 'entregado',
        fecha_hora_entrega = NOW(),
        firma_url = p_firma_url,
        qr_verificacion = p_qr_verificacion
    WHERE id = v_detalle_ruta_id;

    -- Verificar si la ruta está completa
    IF NOT EXISTS (
        SELECT 1 FROM detalles_ruta
        WHERE ruta_id = v_ruta_id
        AND estado_entrega != 'entregado'
    ) THEN
        -- Marcar ruta como completada
        UPDATE rutas_reparto
        SET estado = 'completada',
            tiempo_real_min = EXTRACT(EPOCH FROM (NOW() - (
                SELECT MIN(dr.fecha_hora_entrega)
                FROM detalles_ruta dr
                WHERE dr.ruta_id = v_ruta_id
            ))) / 60
        WHERE id = v_ruta_id;
    END IF;

    -- Actualizar estado del pedido
    UPDATE pedidos
    SET estado = 'entregado',
        fecha_entrega_real = NOW()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object('success', true, 'message', 'Entrega validada exitosamente');

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener stock disponible de un producto
CREATE OR REPLACE FUNCTION get_stock_disponible(producto_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    stock_total DECIMAL(10,3) := 0;
BEGIN
    SELECT COALESCE(SUM(cantidad_disponible), 0)
    INTO stock_total
    FROM lotes
    WHERE lotes.producto_id = get_stock_disponible.producto_id
    AND lotes.estado = 'disponible'
    AND (lotes.fecha_vencimiento IS NULL OR lotes.fecha_vencimiento > NOW());

    RETURN stock_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para reservar stock de un lote específico
CREATE OR REPLACE FUNCTION reservar_stock_lote(
    p_lote_id UUID,
    p_cantidad DECIMAL,
    p_pedido_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_lote RECORD;
    v_cantidad_disponible DECIMAL(10,3);
BEGIN
    -- Obtener información del lote
    SELECT * INTO v_lote
    FROM lotes
    WHERE id = p_lote_id AND estado = 'disponible';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lote no encontrado o no disponible');
    END IF;

    -- Verificar stock disponible
    IF v_lote.cantidad_disponible < p_cantidad THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente en el lote');
    END IF;

    -- Reservar stock (descontar de disponible)
    UPDATE lotes
    SET cantidad_disponible = cantidad_disponible - p_cantidad,
        updated_at = NOW()
    WHERE id = p_lote_id;

    -- Registrar movimiento si hay pedido_id
    IF p_pedido_id IS NOT NULL THEN
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            pedido_id
        ) VALUES (
            p_lote_id,
            'salida',
            p_cantidad,
            p_pedido_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Stock reservado exitosamente');

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ===========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists_calidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_cotizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists_vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutas_reparto ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_ruta ENABLE ROW LEVEL SECURITY;
ALTER TABLE tesoreria_cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tesoreria_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_corrientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_export ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ejemplos - se deben ajustar según necesidades específicas)
-- Nota: Estas son políticas de ejemplo. En producción se deben crear políticas específicas para cada rol.

-- Política para usuarios administradores (acceso total)
CREATE POLICY "admin_full_access" ON productos FOR ALL USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

-- Política para vendedores (solo lectura de productos)
CREATE POLICY "vendedor_read_products" ON productos FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true
    )
);

-- Política para repartidores (solo pedidos asignados)
CREATE POLICY "repartidor_pedidos_asignados" ON pedidos FOR SELECT USING (
    id IN (
        SELECT dr.pedido_id
        FROM detalles_ruta dr
        JOIN rutas_reparto rr ON dr.ruta_id = rr.id
        WHERE rr.repartidor_id = auth.uid()
    )
);

CREATE POLICY "admin_tesoreria_cajas" ON tesoreria_cajas FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
);

CREATE POLICY "admin_tesoreria_movimientos" ON tesoreria_movimientos FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
);

CREATE POLICY "admin_gastos" ON gastos FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin','almacenista'))
);

CREATE POLICY "admin_gastos_categorias" ON gastos_categorias FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin','almacenista'))
);

CREATE POLICY "ventas_cuentas_corrientes" ON cuentas_corrientes FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin','vendedor'))
);

CREATE POLICY "ventas_cuentas_movimientos" ON cuentas_movimientos FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin','vendedor'))
);

CREATE POLICY "admin_reportes_export" ON reportes_export FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
);

-- ===========================================
-- DATOS DE EJEMPLO (DESARROLLO)
-- ===========================================

-- Usuario administrador
INSERT INTO usuarios (email, nombre, apellido, rol, activo)
VALUES ('admin@avicoladelsur.com', 'Administrador', 'Sistema', 'admin', true);

-- Usuario vendedor
INSERT INTO usuarios (email, nombre, apellido, rol, activo)
VALUES ('vendedor@avicoladelsur.com', 'Juan', 'Pérez', 'vendedor', true);

-- Usuario repartidor
INSERT INTO usuarios (email, nombre, apellido, rol, activo)
VALUES ('repartidor@avicoladelsur.com', 'Carlos', 'García', 'repartidor', true);

-- Usuario almacenista
INSERT INTO usuarios (email, nombre, apellido, rol, activo)
VALUES ('almacenista@avicoladelsur.com', 'María', 'López', 'almacenista', true);

-- Productos de ejemplo
INSERT INTO productos (codigo, nombre, descripcion, categoria, precio_venta, precio_costo, unidad_medida, stock_minimo, activo) VALUES
('POLLO001', 'Pollo Entero', 'Pollo entero fresco', 'Aves', 850.00, 700.00, 'kg', 50, true),
('POLLO002', 'Pechuga de Pollo', 'Pechuga de pollo sin hueso', 'Aves', 1200.00, 950.00, 'kg', 30, true),
('POLLO003', 'Alas de Pollo', 'Alas de pollo frescas', 'Aves', 650.00, 520.00, 'kg', 25, true),
('HUEVO001', 'Huevos Blancos', 'Docena de huevos blancos', 'Huevos', 180.00, 140.00, 'docena', 100, true),
('HUEVO002', 'Huevos de Color', 'Docena de huevos de color', 'Huevos', 200.00, 160.00, 'docena', 80, true);

-- Cliente de ejemplo
INSERT INTO clientes (nombre, telefono, whatsapp, email, direccion, zona_entrega, tipo_cliente, limite_credito, activo) VALUES
('Supermercado Central', '+5491123456789', '+5491123456789', 'contacto@supercentral.com', 'Av. Principal 123, Ciudad', 'Centro', 'mayorista', 50000.00, true),
('Tienda Familiar', '+5491198765432', '+5491198765432', 'familia@tiendafamiliar.com', 'Calle Secundaria 456, Ciudad', 'Norte', 'minorista', 10000.00, true);

-- Vehículo de ejemplo
INSERT INTO vehiculos (patente, marca, modelo, capacidad_kg, tipo_vehiculo, seguro_vigente, fecha_vto_seguro, activo) VALUES
('ABC123', 'Fiat', 'Fiorino', 800, 'furgon', true, '2025-12-31', true),
('DEF456', 'Volkswagen', 'Caddy', 1000, 'furgon', true, '2025-11-30', true);

-- Asignar vehículo al repartidor
UPDATE usuarios SET vehiculo_asignado = (SELECT id FROM vehiculos WHERE patente = 'ABC123') WHERE email = 'repartidor@avicoladelsur.com';
