-- Migración: Agregar campo tipo_venta a presupuestos
-- Fecha: 2025-12-14
-- Propósito: Distinguir entre presupuestos que van a reparto vs los que el cliente retira en casa central

-- 1. Agregar columna tipo_venta a presupuestos
ALTER TABLE presupuestos 
  ADD COLUMN IF NOT EXISTS tipo_venta TEXT DEFAULT 'reparto';

-- 2. Agregar constraint CHECK para validar valores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_tipo_venta_check'
  ) THEN
    ALTER TABLE presupuestos 
      ADD CONSTRAINT presupuestos_tipo_venta_check 
      CHECK (tipo_venta IN ('reparto', 'retira_casa_central'));
  END IF;
END $$;

-- 3. Crear índice para consultas filtradas
CREATE INDEX IF NOT EXISTS idx_presupuestos_tipo_venta 
  ON presupuestos(tipo_venta) 
  WHERE tipo_venta = 'reparto';

-- 4. Comentario sobre la columna
COMMENT ON COLUMN presupuestos.tipo_venta IS 'Tipo de venta: reparto (va a ruta de entrega) o retira_casa_central (cliente retira en local)';

-- 5. Opcional: Agregar campo motivo_rechazo a detalles_ruta para pedidos rechazados
ALTER TABLE detalles_ruta 
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

COMMENT ON COLUMN detalles_ruta.motivo_rechazo IS 'Motivo por el cual el cliente rechazó el pedido durante la entrega';
