-- ===========================================
-- MIGRACIÓN: AGREGAR CAMPO CÓDIGO A CLIENTES
-- Fecha: 2025-12-02
-- Descripción: Agrega campo codigo único a tabla clientes para identificar clientes por código numérico
-- ===========================================

-- ===========================================
-- AGREGAR CAMPO CÓDIGO A CLIENTES
-- ===========================================

-- Agregar columna codigo (inicialmente nullable para permitir migración de datos existentes)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);

-- Crear índice único en codigo (solo para valores no nulos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo_unique ON clientes(codigo) WHERE codigo IS NOT NULL;

-- Índice para búsquedas rápidas por código
CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON clientes(codigo) WHERE codigo IS NOT NULL;

-- ===========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ===========================================

COMMENT ON COLUMN clientes.codigo IS 'Código único del cliente (numérico o alfanumérico). Identificador externo para integración con sistemas legacy.';

-- ===========================================
-- NOTA IMPORTANTE
-- ===========================================
-- Después de importar los códigos desde CLIENTES.xlsx usando el script de importación,
-- se debe ejecutar una migración adicional para hacer el campo obligatorio:
-- ALTER TABLE clientes ALTER COLUMN codigo SET NOT NULL;
-- DROP INDEX IF EXISTS idx_clientes_codigo_unique;
-- CREATE UNIQUE INDEX idx_clientes_codigo_unique ON clientes(codigo);

