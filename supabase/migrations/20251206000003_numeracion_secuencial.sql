-- ===========================================
-- MIGRACIÓN: Sistema de Numeración Secuencial
-- Fecha: 06/12/2025
-- Objetivo:
--   Implementar sistema de numeración secuencial simple
--   para Presupuestos (PR-000000001), Pedidos (PED-000000001),
--   Facturas (FAC-000000001) y Rutas (RUT-000000001)
-- ===========================================

BEGIN;

-- Tabla para almacenar contadores secuenciales
CREATE TABLE IF NOT EXISTS numeradores_secuenciales (
    tipo VARCHAR(20) PRIMARY KEY CHECK (tipo IN ('presupuesto', 'pedido', 'factura', 'ruta')),
    contador BIGINT NOT NULL DEFAULT 0,
    prefijo VARCHAR(10) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inicializar contadores si no existen
INSERT INTO numeradores_secuenciales (tipo, contador, prefijo)
VALUES 
    ('presupuesto', 0, 'PR'),
    ('pedido', 0, 'PED'),
    ('factura', 0, 'FAC'),
    ('ruta', 0, 'RUT')
ON CONFLICT (tipo) DO NOTHING;

-- Función helper para obtener el siguiente número secuencial
CREATE OR REPLACE FUNCTION fn_obtener_siguiente_numero(
    p_tipo VARCHAR(20)
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_contador BIGINT;
    v_prefijo VARCHAR(10);
    v_numero VARCHAR(50);
BEGIN
    -- Obtener y actualizar contador de forma atómica
    UPDATE numeradores_secuenciales
    SET 
        contador = contador + 1,
        updated_at = NOW()
    WHERE tipo = p_tipo
    RETURNING contador, prefijo INTO v_contador, v_prefijo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tipo de numerador inválido: %', p_tipo;
    END IF;

    -- Formatear número con 9 dígitos (ej: PR-000000001)
    v_numero := v_prefijo || '-' || LPAD(v_contador::TEXT, 9, '0');

    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_obtener_siguiente_numero(VARCHAR) IS
'Genera el siguiente número secuencial para un tipo dado (presupuesto, pedido, factura, ruta)';

-- Función para inicializar contador basado en registros existentes (opcional, para migración)
CREATE OR REPLACE FUNCTION fn_inicializar_contador(
    p_tipo VARCHAR(20)
) RETURNS BIGINT AS $$
DECLARE
    v_max_numero BIGINT := 0;
    v_numero_text VARCHAR(50);
    v_numero_extraido TEXT;
BEGIN
    -- Intentar extraer el número más alto según el tipo
    CASE p_tipo
        WHEN 'presupuesto' THEN
            SELECT MAX(
                CASE 
                    WHEN numero_presupuesto ~ '^PR-[0-9]+$' THEN
                        (SUBSTRING(numero_presupuesto FROM 4)::BIGINT)
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM presupuestos;
        
        WHEN 'pedido' THEN
            SELECT MAX(
                CASE 
                    WHEN numero_pedido ~ '^PED-[0-9]+$' THEN
                        (SUBSTRING(numero_pedido FROM 5)::BIGINT)
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM pedidos;
        
        WHEN 'factura' THEN
            SELECT MAX(
                CASE 
                    WHEN numero_factura ~ '^FAC-[0-9]+$' THEN
                        (SUBSTRING(numero_factura FROM 5)::BIGINT)
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM facturas;
        
        WHEN 'ruta' THEN
            SELECT MAX(
                CASE 
                    WHEN numero_ruta ~ '^RUT-[0-9]+$' THEN
                        (SUBSTRING(numero_ruta FROM 5)::BIGINT)
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM rutas_reparto;
        
        ELSE
            RAISE EXCEPTION 'Tipo de numerador inválido: %', p_tipo;
    END CASE;

    -- Actualizar contador si el máximo encontrado es mayor al actual
    UPDATE numeradores_secuenciales
    SET contador = GREATEST(contador, COALESCE(v_max_numero, 0))
    WHERE tipo = p_tipo;

    RETURN COALESCE(v_max_numero, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_inicializar_contador(VARCHAR) IS
'Inicializa el contador basándose en el número más alto existente en las tablas (útil para migración)';

-- Inicializar contadores basándose en registros existentes (solo para tipos con nuevo formato)
-- Nota: Esto no afectará los registros existentes con formato antiguo
SELECT fn_inicializar_contador('presupuesto');
SELECT fn_inicializar_contador('pedido');
SELECT fn_inicializar_contador('factura');
SELECT fn_inicializar_contador('ruta');

COMMIT;

