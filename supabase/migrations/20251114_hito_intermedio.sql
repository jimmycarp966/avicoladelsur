-- ===========================================
-- HITO INTERMEDIO - AVÍCOLA DEL SUR ERP
-- Fecha: 14/11/2025
-- Objetivo: Tesorería básica, gastos, cuentas corrientes
-- ===========================================

-- ========================
-- UP MIGRATION
-- ========================
BEGIN;

-- Tesorería: Cajas
CREATE TABLE IF NOT EXISTS tesoreria_cajas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID,
  nombre VARCHAR(120) NOT NULL,
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_actual NUMERIC(14,2) NOT NULL DEFAULT 0,
  moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tesorería: Movimientos
CREATE TABLE IF NOT EXISTS tesoreria_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caja_id UUID NOT NULL REFERENCES tesoreria_cajas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
  descripcion TEXT,
  origen_tipo VARCHAR(50),
  origen_id UUID,
  metodo_pago VARCHAR(30) DEFAULT 'efectivo',
  user_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gastos
CREATE TABLE IF NOT EXISTS gastos_categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(120) UNIQUE NOT NULL,
  descripcion TEXT,
  color VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gastos (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cuentas corrientes
CREATE TABLE IF NOT EXISTS cuentas_corrientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID UNIQUE NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
  limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cuentas_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_corriente_id UUID NOT NULL REFERENCES cuentas_corrientes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cargo', 'pago')),
  monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
  descripcion TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origen_tipo VARCHAR(50),
  origen_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auditoría de exportes
CREATE TABLE IF NOT EXISTS reportes_export (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(60) NOT NULL,
  filtros JSONB,
  formato VARCHAR(10) NOT NULL DEFAULT 'csv',
  url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  generated_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Alteraciones de tablas existentes
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS pago_estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS caja_movimiento_id UUID REFERENCES tesoreria_movimientos(id),
  ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(50),
  ADD COLUMN IF NOT EXISTS instruccion_repartidor TEXT;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS bloqueado_por_deuda BOOLEAN NOT NULL DEFAULT false;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_tesoreria_movimientos_caja_id ON tesoreria_movimientos(caja_id);
CREATE INDEX IF NOT EXISTS idx_tesoreria_movimientos_origen ON tesoreria_movimientos(origen_tipo, origen_id);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_cuentas_corrientes_cliente ON cuentas_corrientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_movimientos_cuenta ON cuentas_movimientos(cuenta_corriente_id);

-- Función: Crear movimiento de caja
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
  IF p_tipo NOT IN ('ingreso', 'egreso') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
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

-- Función: Registrar gasto
CREATE OR REPLACE FUNCTION fn_registrar_gasto(
  p_sucursal_id UUID,
  p_categoria_id UUID,
  p_monto NUMERIC,
  p_creado_por UUID,
  p_comprobante_url TEXT DEFAULT NULL,
  p_descripcion TEXT DEFAULT NULL,
  p_fecha DATE DEFAULT CURRENT_DATE,
  p_afectar_caja BOOLEAN DEFAULT false,
  p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_gasto_id UUID;
  v_movimiento JSONB;
  v_movimiento_id UUID;
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

    IF (v_movimiento->>'success')::BOOLEAN IS TRUE THEN
      v_movimiento_id := (v_movimiento->>'movimiento_id')::UUID;
      UPDATE gastos
      SET caja_movimiento_id = v_movimiento_id
      WHERE id = v_gasto_id;
    ELSE
      RAISE EXCEPTION 'No se pudo registrar movimiento de caja para gasto %', v_gasto_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'gasto_id', v_gasto_id,
    'caja_movimiento_id', v_movimiento_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función: Crear pago para pedido
CREATE OR REPLACE FUNCTION fn_crear_pago_pedido(
  p_pedido_id UUID,
  p_caja_id UUID,
  p_monto NUMERIC,
  p_user_id UUID,
  p_tipo_pago VARCHAR DEFAULT 'efectivo'
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
    RAISE EXCEPTION 'Error al crear movimiento de caja para el pago';
  END IF;

  v_movimiento_id := (v_movimiento->>'movimiento_id')::UUID;

  SELECT COALESCE(SUM(m.monto), 0)
  INTO v_pagado
  FROM tesoreria_movimientos m
  WHERE m.origen_tipo = 'pedido'
    AND m.origen_id = p_pedido_id
    AND m.tipo = 'ingreso';

  v_pagado := v_pagado;

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

  SELECT cc.*
  INTO v_cuenta
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

-- Función auxiliar: asegurar cuenta corriente
CREATE OR REPLACE FUNCTION fn_asegurar_cuenta_corriente(p_cliente_id UUID)
RETURNS UUID AS $$
DECLARE
  v_cuenta_id UUID;
  v_limite NUMERIC;
BEGIN
  SELECT id INTO v_cuenta_id FROM cuentas_corrientes WHERE cliente_id = p_cliente_id;
  IF v_cuenta_id IS NOT NULL THEN
    RETURN v_cuenta_id;
  END IF;

  SELECT limite_credito INTO v_limite FROM clientes WHERE id = p_cliente_id;

  INSERT INTO cuentas_corrientes (cliente_id, saldo, limite_credito)
  VALUES (p_cliente_id, 0, COALESCE(v_limite, 0))
  RETURNING id INTO v_cuenta_id;

  RETURN v_cuenta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función: procesar pedido (web/bot)
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
  v_referencia_pago VARCHAR(50);
  v_instruccion_repartidor TEXT;
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
    
    -- Generar referencia de pago para crédito
    v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    v_instruccion_repartidor := 'Cobrar al cliente: $' || v_total::TEXT || ' - Ref: ' || v_referencia_pago;
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
      
      -- Generar referencia de pago si queda pendiente
      IF v_pago_estado = 'pendiente' OR v_pago_estado = 'parcial' THEN
        v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        v_instruccion_repartidor := 'Cobrar al cliente: $' || (v_total - v_pago_monto)::TEXT || ' - Ref: ' || v_referencia_pago;
      END IF;
    END IF;
  END IF;

  UPDATE pedidos
  SET pago_estado = v_pago_estado,
      caja_movimiento_id = v_movimiento_id,
      referencia_pago = v_referencia_pago,
      instruccion_repartidor = v_instruccion_repartidor
  WHERE id = v_pedido_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'total', v_total,
    'pago_estado', v_pago_estado,
    'referencia_pago', v_referencia_pago,
    'instruccion_repartidor', v_instruccion_repartidor
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper para bot (mantiene compatibilidad)
CREATE OR REPLACE FUNCTION fn_crear_pedido_bot(
  p_cliente_id UUID,
  p_items_json JSONB,
  p_observaciones TEXT DEFAULT NULL,
  p_pago JSONB DEFAULT NULL,
  p_fecha_entrega_estimada DATE DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  RETURN fn_procesar_pedido(
    p_cliente_id,
    p_items_json,
    NULL,
    p_fecha_entrega_estimada,
    'whatsapp',
    0,
    COALESCE(p_pago, jsonb_build_object('modalidad', 'credito')),
    COALESCE(p_observaciones, 'Pedido confirmado desde bot')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para consultar stock por lote (FIFO)
CREATE OR REPLACE FUNCTION fn_consultar_stock_por_lote(
  p_producto_id UUID DEFAULT NULL
) RETURNS TABLE (
  producto_id UUID,
  producto_codigo VARCHAR,
  producto_nombre VARCHAR,
  lote_id UUID,
  lote_numero VARCHAR,
  cantidad_disponible NUMERIC,
  fecha_vencimiento DATE,
  fecha_ingreso TIMESTAMPTZ,
  prioridad_consumo INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS producto_id,
    p.codigo AS producto_codigo,
    p.nombre AS producto_nombre,
    l.id AS lote_id,
    l.numero_lote AS lote_numero,
    l.cantidad_disponible,
    l.fecha_vencimiento,
    l.fecha_ingreso,
    -- Prioridad: primero los que vencen antes, luego por fecha de ingreso (FIFO)
    ROW_NUMBER() OVER (
      PARTITION BY l.producto_id 
      ORDER BY 
        COALESCE(l.fecha_vencimiento, '9999-12-31'::DATE) ASC,
        l.fecha_ingreso ASC
    )::INTEGER AS prioridad_consumo
  FROM lotes l
  INNER JOIN productos p ON p.id = l.producto_id
  WHERE l.estado = 'disponible'
    AND l.cantidad_disponible > 0
    AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
    AND (p_producto_id IS NULL OR l.producto_id = p_producto_id)
  ORDER BY 
    l.producto_id,
    COALESCE(l.fecha_vencimiento, '9999-12-31'::DATE) ASC,
    l.fecha_ingreso ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para las nuevas funciones
GRANT EXECUTE ON FUNCTION fn_consultar_stock_por_lote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_consultar_stock_por_lote(UUID) TO anon;

COMMIT;

-- ========================
-- DOWN MIGRATION
-- ========================
BEGIN;

DROP FUNCTION IF EXISTS fn_consultar_stock_por_lote(UUID) CASCADE;
DROP FUNCTION IF EXISTS fn_crear_pedido_bot(UUID, JSONB, TEXT, JSONB, DATE) CASCADE;
DROP FUNCTION IF EXISTS fn_procesar_pedido(UUID, JSONB, UUID, DATE, VARCHAR, NUMERIC, JSONB, TEXT) CASCADE;
DROP FUNCTION IF EXISTS fn_asegurar_cuenta_corriente(UUID) CASCADE;
DROP FUNCTION IF EXISTS fn_crear_pago_pedido(UUID, UUID, NUMERIC, UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS fn_registrar_gasto(UUID, UUID, NUMERIC, TEXT, TEXT, DATE, UUID, BOOLEAN, UUID) CASCADE;
DROP FUNCTION IF EXISTS fn_crear_movimiento_caja(UUID, VARCHAR, NUMERIC, TEXT, VARCHAR, UUID, UUID, VARCHAR) CASCADE;

ALTER TABLE IF EXISTS pedidos DROP COLUMN IF EXISTS pago_estado;
ALTER TABLE IF EXISTS pedidos DROP COLUMN IF EXISTS caja_movimiento_id;
ALTER TABLE IF EXISTS pedidos DROP COLUMN IF EXISTS referencia_pago;
ALTER TABLE IF EXISTS pedidos DROP COLUMN IF EXISTS instruccion_repartidor;
ALTER TABLE IF EXISTS clientes DROP COLUMN IF EXISTS bloqueado_por_deuda;

DROP TABLE IF EXISTS reportes_export;
DROP TABLE IF EXISTS cuentas_movimientos;
DROP TABLE IF EXISTS cuentas_corrientes;
DROP TABLE IF EXISTS gastos;
DROP TABLE IF EXISTS gastos_categorias;
DROP TABLE IF EXISTS tesoreria_movimientos;
DROP TABLE IF EXISTS tesoreria_cajas;

COMMIT;

