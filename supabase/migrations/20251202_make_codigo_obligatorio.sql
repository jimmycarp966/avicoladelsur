-- ===========================================
-- MIGRACIÓN: HACER CAMPO CÓDIGO OBLIGATORIO EN CLIENTES
-- Fecha: 2025-12-02
-- Descripción: Hace el campo codigo obligatorio después de importar todos los códigos
-- ===========================================

-- ===========================================
-- VERIFICAR QUE TODOS LOS CLIENTES TENGAN CÓDIGO
-- ===========================================

DO $$
DECLARE
    clientes_sin_codigo INTEGER;
BEGIN
    SELECT COUNT(*) INTO clientes_sin_codigo
    FROM clientes
    WHERE codigo IS NULL OR codigo = '';

    IF clientes_sin_codigo > 0 THEN
        RAISE EXCEPTION 'No se puede hacer el campo codigo obligatorio. Hay % clientes sin código. Ejecuta primero el script de importación.', clientes_sin_codigo;
    END IF;
END $$;

-- ===========================================
-- ELIMINAR ÍNDICE ÚNICO PARCIAL
-- ===========================================

DROP INDEX IF EXISTS idx_clientes_codigo_unique;

-- ===========================================
-- HACER CAMPO CÓDIGO OBLIGATORIO
-- ===========================================

ALTER TABLE clientes 
    ALTER COLUMN codigo SET NOT NULL;

-- ===========================================
-- CREAR CONSTRAINT UNIQUE COMPLETO
-- ===========================================

ALTER TABLE clientes 
    ADD CONSTRAINT clientes_codigo_unique UNIQUE (codigo);

-- ===========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ===========================================

COMMENT ON COLUMN clientes.codigo IS 'Código único del cliente (numérico o alfanumérico). Campo obligatorio. Identificador externo para integración con sistemas legacy.';

-- ===========================================
-- VERIFICACIÓN FINAL
-- ===========================================

DO $$
DECLARE
    total_clientes INTEGER;
    clientes_con_codigo INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_clientes FROM clientes;
    SELECT COUNT(*) INTO clientes_con_codigo FROM clientes WHERE codigo IS NOT NULL;
    
    RAISE NOTICE 'Migración completada exitosamente. Total clientes: %, Clientes con código: %', total_clientes, clientes_con_codigo;
END $$;




















