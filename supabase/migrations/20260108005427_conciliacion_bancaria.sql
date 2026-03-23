-- Migration: Conciliación Bancaria

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Actualizar tabla Clientes
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'cuit') THEN
        ALTER TABLE clientes ADD COLUMN cuit text UNIQUE;
        CREATE INDEX idx_clientes_cuit ON clientes(cuit);
    END IF;
END $$;

-- 2. Tabla de Cuentas Bancarias
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    banco TEXT NOT NULL,
    numero_cuenta TEXT NOT NULL,
    cbu TEXT,
    descripcion TEXT,
    moneda TEXT DEFAULT 'ARS',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Movimientos Bancarios
CREATE TABLE IF NOT EXISTS movimientos_bancarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuenta_bancaria_id UUID REFERENCES cuentas_bancarias(id),
    fecha DATE NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    referencia TEXT,
    dni_cuit TEXT,
    descripcion TEXT,
    archivo_origen TEXT,
    estado_conciliacion VARCHAR(20) DEFAULT 'pendiente',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Pagos Esperados
CREATE TABLE IF NOT EXISTS pagos_esperados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID,
    cliente_id UUID,
    monto_esperado DECIMAL(12,2) NOT NULL,
    fecha_esperada DATE,
    referencia TEXT,
    dni_cuit TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente',
    origen TEXT DEFAULT 'pedido',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Conciliaciones
CREATE TABLE IF NOT EXISTS conciliaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movimiento_bancario_id UUID REFERENCES movimientos_bancarios(id),
    pago_esperado_id UUID REFERENCES pagos_esperados(id),
    monto_conciliado DECIMAL(12,2) NOT NULL,
    diferencia DECIMAL(12,2) DEFAULT 0,
    tipo_match VARCHAR(20),
    confianza_score DECIMAL(5,2),
    conciliado_por UUID,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mov_bancarios_fecha ON movimientos_bancarios(fecha);
CREATE INDEX IF NOT EXISTS idx_mov_bancarios_estado ON movimientos_bancarios(estado_conciliacion);
CREATE INDEX IF NOT EXISTS idx_mov_bancarios_dni ON movimientos_bancarios(dni_cuit);
CREATE INDEX IF NOT EXISTS idx_pagos_esperados_estado ON pagos_esperados(estado);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_mov ON conciliaciones(movimiento_bancario_id);

-- RLS Policies
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_bancarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_esperados ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso a tesoreros y admins en cuentas_bancarias" ON cuentas_bancarias
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()::uuid AND rol IN ('admin', 'tesorero'))
    );

CREATE POLICY "Permitir acceso a tesoreros y admins en movimientos_bancarios" ON movimientos_bancarios
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()::uuid AND rol IN ('admin', 'tesorero'))
    );

CREATE POLICY "Permitir acceso a tesoreros y admins en pagos_esperados" ON pagos_esperados
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()::uuid AND rol IN ('admin', 'tesorero'))
    );

CREATE POLICY "Permitir acceso a tesoreros y admins en conciliaciones" ON conciliaciones
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()::uuid AND rol IN ('admin', 'tesorero'))
    );;
