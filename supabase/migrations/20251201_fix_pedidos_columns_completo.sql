-- ===========================================
-- MIGRACIÓN: Asegurar todas las columnas necesarias en tabla pedidos
-- Fecha: 01/12/2025
-- Objetivo: Verificar y agregar todas las columnas requeridas para la conversión de presupuesto a pedido
--           Esto evita errores al ejecutar fn_convertir_presupuesto_a_pedido
-- ===========================================

BEGIN;

-- Verificar que la tabla pedidos existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
    RAISE EXCEPTION 'La tabla pedidos no existe. Debe ejecutarse primero el schema base.';
  END IF;
END $$;

-- Agregar columnas necesarias para conversión de presupuesto a pedido
-- Todas usan IF NOT EXISTS para ser idempotentes

-- 1. referencia_pago: Referencia de pago para pedidos con pago diferido
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(60);

-- 2. instruccion_repartidor: Instrucciones para el repartidor sobre el cobro
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS instruccion_repartidor TEXT;

-- 3. turno: Turno de entrega (mañana/tarde)
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS turno VARCHAR(20) CHECK (turno IN ('mañana', 'tarde'));

-- 4. zona_id: Zona de entrega del pedido
DO $$
BEGIN
  -- Verificar si la tabla zonas existe antes de agregar la foreign key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zonas') THEN
    -- Agregar columna con foreign key si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pedidos' AND column_name = 'zona_id'
    ) THEN
      ALTER TABLE pedidos
      ADD COLUMN zona_id UUID REFERENCES zonas(id);
    END IF;
  ELSE
    -- Si zonas no existe, agregar la columna sin foreign key
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS zona_id UUID;
  END IF;
END $$;

-- 5. metodos_pago: Métodos de pago configurados (JSONB)
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS metodos_pago JSONB;

-- 6. recargo_total: Recargo total aplicado al pedido
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS recargo_total DECIMAL(10,2) DEFAULT 0;

-- 7. pago_estado: Estado del pago del pedido
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS pago_estado VARCHAR(20) NOT NULL DEFAULT 'pendiente';

-- 8. presupuesto_id: Referencia al presupuesto del que proviene el pedido
DO $$
BEGIN
  -- Verificar si la tabla presupuestos existe antes de agregar la foreign key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
    -- Agregar columna con foreign key si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pedidos' AND column_name = 'presupuesto_id'
    ) THEN
      ALTER TABLE pedidos
      ADD COLUMN presupuesto_id UUID REFERENCES presupuestos(id);
    END IF;
  ELSE
    -- Si presupuestos no existe, agregar la columna sin foreign key
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS presupuesto_id UUID;
  END IF;
END $$;

-- 9. caja_movimiento_id: Referencia al movimiento de caja si se pagó por adelantado
DO $$
BEGIN
  -- Verificar si la tabla tesoreria_movimientos existe antes de agregar la foreign key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_movimientos') THEN
    -- Agregar columna con foreign key si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pedidos' AND column_name = 'caja_movimiento_id'
    ) THEN
      ALTER TABLE pedidos
      ADD COLUMN caja_movimiento_id UUID REFERENCES tesoreria_movimientos(id);
    END IF;
  ELSE
    -- Si tesoreria_movimientos no existe, agregar la columna sin foreign key
    ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS caja_movimiento_id UUID;
  END IF;
END $$;

-- Agregar comentarios para documentar las columnas
COMMENT ON COLUMN pedidos.referencia_pago IS 'Referencia de pago única para pedidos con pago diferido (formato: PAY-YYYYMMDD-XXXXXX)';
COMMENT ON COLUMN pedidos.instruccion_repartidor IS 'Instrucciones para el repartidor sobre el cobro del pedido';
COMMENT ON COLUMN pedidos.turno IS 'Turno de entrega: mañana o tarde';
COMMENT ON COLUMN pedidos.zona_id IS 'Zona de entrega del pedido';
COMMENT ON COLUMN pedidos.metodos_pago IS 'Métodos de pago configurados para el pedido (JSONB)';
COMMENT ON COLUMN pedidos.recargo_total IS 'Recargo total aplicado al pedido (por múltiples métodos de pago u otros conceptos)';
COMMENT ON COLUMN pedidos.pago_estado IS 'Estado del pago: pendiente, pagado, parcial, cancelado';
COMMENT ON COLUMN pedidos.presupuesto_id IS 'Referencia al presupuesto del que proviene este pedido';
COMMENT ON COLUMN pedidos.caja_movimiento_id IS 'Referencia al movimiento de caja si el pedido fue pagado por adelantado';

COMMIT;

