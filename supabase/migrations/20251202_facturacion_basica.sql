-- ===========================================
-- MIGRACIÓN: Facturación básica interna
-- Fecha: 02/12/2025
-- Objetivo:
--   - Crear tablas de facturación interna: facturas y factura_items
--   - No integra AFIP, solo documentos internos ligados a pedidos/clientes
-- ===========================================

BEGIN;

-- Índices para tablas de facturación
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id ON facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_pedido_id ON facturas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_emision ON facturas(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_factura_items_factura_id ON factura_items(factura_id);

COMMIT;


