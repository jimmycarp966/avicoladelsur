-- ===========================================
-- MIGRACIÓN: Venta por Mayor en Productos
-- Fecha: 11/12/2025
-- Objetivo:
--   Agregar campos para configurar venta por mayor en productos,
--   permitiendo que un mismo producto se venda por kg (minorista)
--   o por unidad mayor como caja (mayorista)
-- ===========================================

BEGIN;

-- ===========================================
-- 1. AGREGAR CAMPOS A TABLA PRODUCTOS
-- ===========================================

-- Campo: Habilitar venta por mayor
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS venta_mayor_habilitada BOOLEAN DEFAULT false;

-- Campo: Nombre de la unidad mayor (caja, bolsa, pack, etc.)
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS unidad_mayor_nombre VARCHAR(50) DEFAULT 'caja';

-- Campo: Cantidad de kg por unidad mayor
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS kg_por_unidad_mayor DECIMAL(10,3) DEFAULT 20.000;

-- ===========================================
-- 2. COMENTARIOS DESCRIPTIVOS
-- ===========================================

COMMENT ON COLUMN productos.venta_mayor_habilitada IS 
'Si true, el producto puede venderse por unidad mayor (caja, bolsa, etc.) en listas mayoristas/distribuidor';

COMMENT ON COLUMN productos.unidad_mayor_nombre IS 
'Nombre de la unidad mayor para mostrar en ventas: caja, bolsa, pack, bandeja, etc.';

COMMENT ON COLUMN productos.kg_por_unidad_mayor IS 
'Cantidad de kg que contiene una unidad mayor. Ej: 20 kg por caja';

-- ===========================================
-- 3. ÍNDICE PARA BÚSQUEDAS
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_productos_venta_mayor 
ON productos(venta_mayor_habilitada) 
WHERE venta_mayor_habilitada = true;

COMMIT;
