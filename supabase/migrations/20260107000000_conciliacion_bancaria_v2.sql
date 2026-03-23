-- ================================================
-- MIGRACIÓN: Conciliación Bancaria v2
-- Fecha: 2026-01-07
-- Descripción: Nuevo flujo de conciliación con PDF sábana + imágenes comprobantes
-- ================================================

-- ================================
-- 1. TABLA: Sesiones de Conciliación
-- ================================
-- Registra cada sesión de conciliación realizada
CREATE TABLE IF NOT EXISTS sesiones_conciliacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  sabana_archivo TEXT, -- Nombre del archivo PDF de sábana
  total_movimientos_sabana INTEGER DEFAULT 0,
  total_comprobantes INTEGER DEFAULT 0,
  validados INTEGER DEFAULT 0,
  no_encontrados INTEGER DEFAULT 0,
  monto_total_acreditado DECIMAL(12,2) DEFAULT 0,
  usuario_id UUID REFERENCES usuarios(id),
  reporte_url TEXT, -- URL del PDF de reporte generado
  estado VARCHAR(20) DEFAULT 'en_proceso', -- en_proceso, completada, con_errores
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 2. TABLA: Comprobantes Procesados
-- ================================
-- Cada imagen de comprobante procesada en una sesión
CREATE TABLE IF NOT EXISTS comprobantes_conciliacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sesion_id UUID REFERENCES sesiones_conciliacion(id) ON DELETE CASCADE,
  fecha DATE,
  monto DECIMAL(12,2),
  dni_cuit VARCHAR(20),
  referencia TEXT,
  descripcion TEXT,
  -- Estado de validación
  estado_validacion VARCHAR(20) DEFAULT 'pendiente', -- pendiente, validado, no_encontrado, sin_cliente, error
  -- Relaciones
  cliente_id UUID REFERENCES clientes(id), -- Cliente encontrado por DNI (NULL si no se encontró)
  movimiento_match_id UUID REFERENCES movimientos_bancarios(id), -- Movimiento de sábana que coincide
  confianza_score DECIMAL(3,2), -- Score de confianza del match (0.00 a 1.00)
  -- Para futuras integraciones
  sucursal_origen_id UUID REFERENCES sucursales(id), -- Para cuando sucursales suban comprobantes
  origen VARCHAR(20) DEFAULT 'manual', -- manual, sucursal, whatsapp
  -- Metadatos
  notas TEXT,
  acreditado BOOLEAN DEFAULT FALSE, -- Si ya se acreditó al cliente
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 3. ÍNDICES
-- ================================
CREATE INDEX IF NOT EXISTS idx_sesiones_fecha ON sesiones_conciliacion(fecha);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones_conciliacion(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_estado ON sesiones_conciliacion(estado);

CREATE INDEX IF NOT EXISTS idx_comprobantes_sesion ON comprobantes_conciliacion(sesion_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_dni ON comprobantes_conciliacion(dni_cuit);
CREATE INDEX IF NOT EXISTS idx_comprobantes_cliente ON comprobantes_conciliacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes_conciliacion(estado_validacion);
CREATE INDEX IF NOT EXISTS idx_comprobantes_sucursal ON comprobantes_conciliacion(sucursal_origen_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_origen ON comprobantes_conciliacion(origen);

-- ================================
-- 4. RLS (Row Level Security)
-- ================================
ALTER TABLE sesiones_conciliacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes_conciliacion ENABLE ROW LEVEL SECURITY;

-- Políticas para sesiones_conciliacion
CREATE POLICY "Admin y tesorero pueden ver todas las sesiones"
  ON sesiones_conciliacion FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'tesorero')
  );

CREATE POLICY "Admin y tesorero pueden crear sesiones"
  ON sesiones_conciliacion FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'tesorero')
  );

CREATE POLICY "Admin y tesorero pueden actualizar sesiones"
  ON sesiones_conciliacion FOR UPDATE
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'tesorero')
  );

-- Políticas para comprobantes_conciliacion
CREATE POLICY "Admin y tesorero pueden ver todos los comprobantes"
  ON comprobantes_conciliacion FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'tesorero')
  );

CREATE POLICY "Admin y tesorero pueden crear comprobantes"
  ON comprobantes_conciliacion FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'tesorero')
  );

CREATE POLICY "Admin y tesorero pueden actualizar comprobantes"
  ON comprobantes_conciliacion FOR UPDATE
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'tesorero')
  );

-- ================================
-- 5. COMENTARIOS DE DOCUMENTACIÓN
-- ================================
COMMENT ON TABLE sesiones_conciliacion IS 'Registra cada sesión de conciliación bancaria (PDF sábana + imágenes)';
COMMENT ON TABLE comprobantes_conciliacion IS 'Cada comprobante de pago procesado en una sesión de conciliación';

COMMENT ON COLUMN comprobantes_conciliacion.estado_validacion IS 'pendiente: sin procesar, validado: encontrado en sábana, no_encontrado: no está en sábana, sin_cliente: no hay cliente con ese DNI, error: fallo al procesar';
COMMENT ON COLUMN comprobantes_conciliacion.origen IS 'manual: subido desde tesorería, sucursal: subido desde sucursal, whatsapp: recibido por bot';
COMMENT ON COLUMN comprobantes_conciliacion.sucursal_origen_id IS 'Preparado para futuro: cuando sucursales puedan subir comprobantes directamente';
