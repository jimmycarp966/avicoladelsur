-- ===========================================
-- MIGRACIÓN: Agregar columna recargo_total a presupuestos
-- Fecha: 01/12/2025
-- Objetivo: Agregar columna recargo_total que es usada por funciones SQL pero no existe en la tabla
-- ===========================================

BEGIN;

-- Agregar columna recargo_total a presupuestos si no existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
    -- Agregar columna recargo_total si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'presupuestos' AND column_name = 'recargo_total'
    ) THEN
      ALTER TABLE presupuestos
      ADD COLUMN recargo_total DECIMAL(10,2) DEFAULT 0;
      
      -- Agregar comentario para documentar
      COMMENT ON COLUMN presupuestos.recargo_total IS 'Recargo total aplicado al presupuesto (por múltiples métodos de pago u otros conceptos)';
    END IF;
  END IF;
END $$;

-- También asegurar que pedidos tenga la columna recargo_total si no existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
    -- Agregar columna recargo_total si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pedidos' AND column_name = 'recargo_total'
    ) THEN
      ALTER TABLE pedidos
      ADD COLUMN recargo_total DECIMAL(10,2) DEFAULT 0;
      
      -- Agregar comentario para documentar
      COMMENT ON COLUMN pedidos.recargo_total IS 'Recargo total aplicado al pedido (por múltiples métodos de pago u otros conceptos)';
    END IF;
  END IF;
END $$;

-- También asegurar que presupuestos tenga la columna metodos_pago si no existe (usada por funciones)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
    -- Agregar columna metodos_pago si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'presupuestos' AND column_name = 'metodos_pago'
    ) THEN
      ALTER TABLE presupuestos
      ADD COLUMN metodos_pago JSONB;
      
      -- Agregar comentario para documentar
      COMMENT ON COLUMN presupuestos.metodos_pago IS 'Métodos de pago configurados para el presupuesto (JSONB)';
    END IF;
  END IF;
END $$;

-- También asegurar que pedidos tenga la columna metodos_pago si no existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
    -- Agregar columna metodos_pago si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pedidos' AND column_name = 'metodos_pago'
    ) THEN
      ALTER TABLE pedidos
      ADD COLUMN metodos_pago JSONB;
      
      -- Agregar comentario para documentar
      COMMENT ON COLUMN pedidos.metodos_pago IS 'Métodos de pago configurados para el pedido (JSONB)';
    END IF;
  END IF;
END $$;

COMMIT;

