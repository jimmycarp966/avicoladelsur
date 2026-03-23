-- ===========================================
-- MIGRACIÓN: Agregar lista_precio_id a nivel de item
-- Fecha: 11/12/2024
-- Descripción: Permitir lista de precio diferente por cada producto
--   en presupuestos y pedidos
-- ===========================================

BEGIN;

-- Agregar lista_precio_id a items de presupuesto
ALTER TABLE presupuesto_items 
ADD COLUMN IF NOT EXISTS lista_precio_id UUID REFERENCES listas_precios(id);

-- Agregar lista_precio_id a items de pedido
ALTER TABLE detalles_pedido 
ADD COLUMN IF NOT EXISTS lista_precio_id UUID REFERENCES listas_precios(id);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_presupuesto_items_lista ON presupuesto_items(lista_precio_id);
CREATE INDEX IF NOT EXISTS idx_detalles_pedido_lista ON detalles_pedido(lista_precio_id);

COMMIT;

