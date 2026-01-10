-- =====================================================
-- MIGRACIÓN: Proveedores - Gestión Financiera Completa
-- Fecha: 2026-01-10
-- Descripción: Agrega tablas para facturas y pagos a proveedores
-- =====================================================

-- =====================================================
-- 1. TABLA: proveedores_facturas
-- Registra facturas/comprobantes recibidos de proveedores
-- =====================================================
CREATE TABLE IF NOT EXISTS proveedores_facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  numero_factura VARCHAR(100) NOT NULL, -- Formato: 0001-00012345
  tipo_comprobante VARCHAR(50) DEFAULT 'factura', -- factura, remito, recibo, nota_credito
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  monto_total DECIMAL(12,2) NOT NULL,
  monto_pagado DECIMAL(12,2) DEFAULT 0,
  estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, parcial, pagada, vencida, anulada
  descripcion TEXT,
  archivo_url TEXT, -- URL del comprobante escaneado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  creado_por UUID REFERENCES auth.users(id),
  UNIQUE(proveedor_id, numero_factura)
);

-- Índices para proveedores_facturas
CREATE INDEX IF NOT EXISTS idx_proveedores_facturas_proveedor ON proveedores_facturas(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_facturas_estado ON proveedores_facturas(estado);
CREATE INDEX IF NOT EXISTS idx_proveedores_facturas_vencimiento ON proveedores_facturas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_proveedores_facturas_fecha_emision ON proveedores_facturas(fecha_emision);

-- RLS para proveedores_facturas
ALTER TABLE proveedores_facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_facturas_select" ON proveedores_facturas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "proveedores_facturas_insert" ON proveedores_facturas
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'vendedor', 'tesorero'))
  );

CREATE POLICY "proveedores_facturas_update" ON proveedores_facturas
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'vendedor', 'tesorero'))
  );

CREATE POLICY "proveedores_facturas_delete" ON proveedores_facturas
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin'))
  );

-- =====================================================
-- 2. TABLA: proveedores_pagos
-- Registra pagos realizados a proveedores
-- =====================================================
CREATE TABLE IF NOT EXISTS proveedores_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  factura_id UUID REFERENCES proveedores_facturas(id), -- NULL si es pago a cuenta
  caja_id UUID NOT NULL REFERENCES tesoreria_cajas(id),
  monto DECIMAL(12,2) NOT NULL,
  metodo_pago VARCHAR(50) DEFAULT 'transferencia', -- efectivo, transferencia
  numero_transaccion VARCHAR(100), -- Para transferencias bancarias
  descripcion TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  movimiento_caja_id UUID REFERENCES tesoreria_movimientos(id), -- Movimiento generado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  creado_por UUID REFERENCES auth.users(id)
);

-- Índices para proveedores_pagos
CREATE INDEX IF NOT EXISTS idx_proveedores_pagos_proveedor ON proveedores_pagos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_pagos_factura ON proveedores_pagos(factura_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_pagos_fecha ON proveedores_pagos(fecha);
CREATE INDEX IF NOT EXISTS idx_proveedores_pagos_caja ON proveedores_pagos(caja_id);

-- RLS para proveedores_pagos
ALTER TABLE proveedores_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_pagos_select" ON proveedores_pagos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "proveedores_pagos_insert" ON proveedores_pagos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'vendedor', 'tesorero'))
  );

-- =====================================================
-- 3. COLUMNA: gastos.proveedor_id
-- Vincular gastos con proveedores (opcional)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gastos' AND column_name = 'proveedor_id'
  ) THEN
    ALTER TABLE gastos ADD COLUMN proveedor_id UUID REFERENCES proveedores(id);
    CREATE INDEX idx_gastos_proveedor ON gastos(proveedor_id);
  END IF;
END $$;

-- =====================================================
-- 4. FUNCIÓN: fn_registrar_pago_proveedor
-- Registra pago atómicamente con impacto en caja
-- =====================================================
CREATE OR REPLACE FUNCTION fn_registrar_pago_proveedor(
  p_proveedor_id UUID,
  p_factura_id UUID, -- NULL para pago a cuenta
  p_caja_id UUID,
  p_monto DECIMAL,
  p_metodo_pago VARCHAR,
  p_numero_transaccion VARCHAR DEFAULT NULL,
  p_descripcion TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_movimiento_id UUID;
  v_pago_id UUID;
  v_proveedor_nombre TEXT;
  v_factura_numero TEXT;
  v_descripcion_mov TEXT;
BEGIN
  -- Validaciones básicas
  IF p_monto <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser mayor a 0');
  END IF;
  
  -- Obtener nombre proveedor
  SELECT nombre INTO v_proveedor_nombre FROM proveedores WHERE id = p_proveedor_id;
  IF v_proveedor_nombre IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proveedor no encontrado');
  END IF;
  
  -- Obtener número de factura si aplica
  IF p_factura_id IS NOT NULL THEN
    SELECT numero_factura INTO v_factura_numero FROM proveedores_facturas WHERE id = p_factura_id;
  END IF;
  
  -- Construir descripción del movimiento
  v_descripcion_mov := 'Pago proveedor: ' || v_proveedor_nombre;
  IF v_factura_numero IS NOT NULL THEN
    v_descripcion_mov := v_descripcion_mov || ' - Fact: ' || v_factura_numero;
  END IF;
  IF p_descripcion IS NOT NULL THEN
    v_descripcion_mov := v_descripcion_mov || ' - ' || p_descripcion;
  END IF;
  
  -- Crear movimiento de caja (egreso)
  INSERT INTO tesoreria_movimientos (
    caja_id, 
    tipo, 
    monto, 
    descripcion, 
    metodo_pago, 
    origen_tipo,
    numero_transaccion,
    creado_por
  )
  VALUES (
    p_caja_id, 
    'egreso', 
    p_monto, 
    v_descripcion_mov,
    p_metodo_pago, 
    'pago_proveedor',
    p_numero_transaccion,
    p_user_id
  )
  RETURNING id INTO v_movimiento_id;
  
  -- Actualizar saldo caja
  UPDATE tesoreria_cajas 
  SET saldo_actual = saldo_actual - p_monto,
      updated_at = NOW()
  WHERE id = p_caja_id;
  
  -- Crear registro de pago
  INSERT INTO proveedores_pagos (
    proveedor_id, 
    factura_id, 
    caja_id, 
    monto, 
    metodo_pago, 
    numero_transaccion,
    descripcion, 
    movimiento_caja_id, 
    creado_por
  )
  VALUES (
    p_proveedor_id, 
    p_factura_id, 
    p_caja_id, 
    p_monto, 
    p_metodo_pago, 
    p_numero_transaccion,
    p_descripcion, 
    v_movimiento_id, 
    p_user_id
  )
  RETURNING id INTO v_pago_id;
  
  -- Si hay factura, actualizar monto pagado y estado
  IF p_factura_id IS NOT NULL THEN
    UPDATE proveedores_facturas 
    SET monto_pagado = monto_pagado + p_monto,
        estado = CASE 
          WHEN monto_pagado + p_monto >= monto_total THEN 'pagada'
          ELSE 'parcial'
        END,
        updated_at = NOW()
    WHERE id = p_factura_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'pago_id', v_pago_id, 
    'movimiento_id', v_movimiento_id,
    'message', 'Pago registrado exitosamente'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. FUNCIÓN: fn_obtener_estado_cuenta_proveedor
-- Obtiene resumen financiero de un proveedor
-- =====================================================
CREATE OR REPLACE FUNCTION fn_obtener_estado_cuenta_proveedor(
  p_proveedor_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_total_facturado DECIMAL;
  v_total_pagado DECIMAL;
  v_facturas_pendientes INT;
  v_facturas_vencidas INT;
BEGIN
  -- Total facturado (facturas no anuladas)
  SELECT COALESCE(SUM(monto_total), 0), COUNT(*) FILTER (WHERE estado IN ('pendiente', 'parcial'))
  INTO v_total_facturado, v_facturas_pendientes
  FROM proveedores_facturas 
  WHERE proveedor_id = p_proveedor_id 
    AND estado != 'anulada';
  
  -- Total pagado
  SELECT COALESCE(SUM(monto), 0) INTO v_total_pagado
  FROM proveedores_pagos 
  WHERE proveedor_id = p_proveedor_id;
  
  -- Facturas vencidas
  SELECT COUNT(*) INTO v_facturas_vencidas
  FROM proveedores_facturas 
  WHERE proveedor_id = p_proveedor_id 
    AND estado IN ('pendiente', 'parcial')
    AND fecha_vencimiento < CURRENT_DATE;
  
  RETURN jsonb_build_object(
    'total_facturado', v_total_facturado,
    'total_pagado', v_total_pagado,
    'saldo_pendiente', v_total_facturado - v_total_pagado,
    'facturas_pendientes', v_facturas_pendientes,
    'facturas_vencidas', v_facturas_vencidas
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNCIÓN: fn_obtener_resumen_proveedores
-- Obtiene resumen global de deudas con proveedores
-- =====================================================
CREATE OR REPLACE FUNCTION fn_obtener_resumen_proveedores()
RETURNS JSONB AS $$
DECLARE
  v_deuda_total DECIMAL;
  v_facturas_pendientes INT;
  v_facturas_vencidas INT;
  v_monto_vencido DECIMAL;
BEGIN
  -- Calcular totales
  SELECT 
    COALESCE(SUM(monto_total - monto_pagado), 0),
    COUNT(*) FILTER (WHERE estado IN ('pendiente', 'parcial')),
    COUNT(*) FILTER (WHERE estado IN ('pendiente', 'parcial') AND fecha_vencimiento < CURRENT_DATE),
    COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN monto_total - monto_pagado ELSE 0 END), 0)
  INTO v_deuda_total, v_facturas_pendientes, v_facturas_vencidas, v_monto_vencido
  FROM proveedores_facturas 
  WHERE estado IN ('pendiente', 'parcial');
  
  RETURN jsonb_build_object(
    'deuda_total', v_deuda_total,
    'facturas_pendientes', v_facturas_pendientes,
    'facturas_vencidas', v_facturas_vencidas,
    'monto_vencido', v_monto_vencido
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. JOB: Actualizar facturas vencidas (trigger diario)
-- Marca automáticamente facturas como vencidas
-- =====================================================
CREATE OR REPLACE FUNCTION fn_actualizar_facturas_vencidas()
RETURNS void AS $$
BEGIN
  UPDATE proveedores_facturas
  SET estado = 'vencida', updated_at = NOW()
  WHERE estado = 'pendiente'
    AND fecha_vencimiento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT permisos a funciones
-- =====================================================
GRANT EXECUTE ON FUNCTION fn_registrar_pago_proveedor TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_estado_cuenta_proveedor TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_resumen_proveedores TO authenticated;
GRANT EXECUTE ON FUNCTION fn_actualizar_facturas_vencidas TO authenticated;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON TABLE proveedores_facturas IS 'Facturas y comprobantes recibidos de proveedores';
COMMENT ON TABLE proveedores_pagos IS 'Pagos realizados a proveedores con impacto en caja';
COMMENT ON FUNCTION fn_registrar_pago_proveedor IS 'Registra pago a proveedor de forma atómica, actualizando caja y factura';
COMMENT ON FUNCTION fn_obtener_estado_cuenta_proveedor IS 'Obtiene resumen financiero de un proveedor específico';
COMMENT ON FUNCTION fn_obtener_resumen_proveedores IS 'Obtiene resumen global de deudas con proveedores para dashboard';
