-- ===========================================
-- MIGRACIÓN: Optimización de Índices
-- Fecha: 16/12/2025
-- Objetivo: Agregar índices optimizados para consultas frecuentes
-- ===========================================

BEGIN;

-- ===========================================
-- ÍNDICES PARA PRESUPUESTOS
-- ===========================================

-- Índice compuesto para consultas de presupuestos por fecha, turno, zona y estado
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha_turno_zona 
  ON presupuestos(fecha_entrega_estimada, turno, zona_id, estado);

-- ===========================================
-- ÍNDICES PARA PEDIDOS
-- ===========================================

-- Índice para pedidos por sucursal y fecha (solo si tiene sucursal)
CREATE INDEX IF NOT EXISTS idx_pedidos_sucursal_fecha 
  ON pedidos(sucursal_id, fecha_pedido DESC) 
  WHERE sucursal_id IS NOT NULL;

-- ===========================================
-- ÍNDICES PARA LOTES
-- ===========================================

-- Índice compuesto para lotes por sucursal, producto y estado
CREATE INDEX IF NOT EXISTS idx_lotes_sucursal_producto_estado 
  ON lotes(sucursal_id, producto_id, estado, fecha_vencimiento);

-- Índice para consultas FIFO optimizadas (producto, sucursal, vencimiento, ingreso)
CREATE INDEX IF NOT EXISTS idx_lotes_producto_sucursal_vencimiento 
  ON lotes(producto_id, sucursal_id, fecha_vencimiento NULLS LAST, fecha_ingreso);

-- ===========================================
-- ÍNDICES PARA TRANSFERENCIAS
-- ===========================================

-- Índice compuesto para transferencias por estado y fecha
CREATE INDEX IF NOT EXISTS idx_transferencias_estado_fecha 
  ON transferencias_stock(estado, fecha_solicitud DESC);

-- ===========================================
-- ÍNDICES PARA ALERTAS DE STOCK
-- ===========================================

-- Índice compuesto para alertas por sucursal, estado y fecha
CREATE INDEX IF NOT EXISTS idx_alertas_stock_sucursal_estado 
  ON alertas_stock(sucursal_id, estado, created_at DESC);

-- ===========================================
-- ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- ===========================================

-- Índice para consultas de stock disponible por producto y sucursal
CREATE INDEX IF NOT EXISTS idx_lotes_stock_disponible 
  ON lotes(producto_id, sucursal_id, cantidad_disponible) 
  WHERE cantidad_disponible > 0 AND estado = 'disponible';

-- Índice para consultas de reservas de stock por presupuesto
CREATE INDEX IF NOT EXISTS idx_stock_reservations_presupuesto_estado 
  ON stock_reservations(presupuesto_id, estado, expires_at) 
  WHERE estado = 'activa';

COMMIT;

