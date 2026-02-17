-- ===========================================
-- ALMACEN RECEPCION: SYNC CON PROVEEDORES
-- Fecha: 2026-02-17
-- Objetivo:
--   - Vincular ingresos de compra con deuda de proveedores.
--   - Trazabilidad entre recepcion_almacen y proveedores_facturas.
-- ===========================================

BEGIN;

ALTER TABLE recepcion_almacen
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id),
  ADD COLUMN IF NOT EXISTS factura_proveedor_id UUID REFERENCES proveedores_facturas(id),
  ADD COLUMN IF NOT EXISTS numero_comprobante_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tipo_comprobante_ref VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fecha_comprobante DATE,
  ADD COLUMN IF NOT EXISTS monto_compra NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_recepcion_almacen_proveedor_id
  ON recepcion_almacen(proveedor_id);

CREATE INDEX IF NOT EXISTS idx_recepcion_almacen_factura_proveedor_id
  ON recepcion_almacen(factura_proveedor_id);

COMMIT;

