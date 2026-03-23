-- Migration: Cliente Memoria - Almacenamiento persistente de hechos aprendidos
-- Fecha: 2026-01-24
-- Propósito: Guardar hechos aprendidos del cliente que no expiran con las sesiones

BEGIN;

-- Crear tabla cliente_memoria
CREATE TABLE IF NOT EXISTS cliente_memoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    learned_facts JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Garantizar un solo registro de memoria por cliente
    CONSTRAINT unique_cliente_memoria UNIQUE (cliente_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cliente_memoria_cliente_id ON cliente_memoria(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_memoria_updated_at ON cliente_memoria(updated_at DESC);

-- Función RPC: upsert_cliente_memoria
-- Inserta o actualiza los hechos aprendidos de un cliente
CREATE OR REPLACE FUNCTION upsert_cliente_memoria(
    p_cliente_id UUID,
    p_learned_facts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO cliente_memoria (
        cliente_id,
        learned_facts,
        updated_at
    )
    VALUES (
        p_cliente_id,
        p_learned_facts,
        NOW()
    )
    ON CONFLICT (cliente_id)
    DO UPDATE SET
        learned_facts = p_learned_facts,
        updated_at = NOW()
    RETURNING
        jsonb_build_object(
            'success', true,
            'message', 'Memoria actualizada'
        ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Función RPC: get_cliente_memoria
-- Obtiene los hechos aprendidos de un cliente
CREATE OR REPLACE FUNCTION get_cliente_memoria(
    p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_memoria RECORD;
BEGIN
    SELECT * INTO v_memoria
    FROM cliente_memoria
    WHERE cliente_id = p_cliente_id
    LIMIT 1;

    IF FOUND THEN
        v_result := jsonb_build_object(
            'success', true,
            'learned_facts', v_memoria.learned_facts,
            'updated_at', v_memoria.updated_at
        );
    ELSE
        v_result := jsonb_build_object(
            'success', true,
            'learned_facts', '{}'::jsonb,
            'message', 'No hay memoria registrada'
        );
    END IF;

    RETURN v_result;
END;
$$;

-- Función RPC: delete_cliente_memoria
-- Elimina la memoria de un cliente
CREATE OR REPLACE FUNCTION delete_cliente_memoria(
    p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    DELETE FROM cliente_memoria
    WHERE cliente_id = p_cliente_id;

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Memoria eliminada'
    );

    RETURN v_result;
END;
$$;

COMMIT;

-- Verificación de la migración
DO $$
BEGIN
    -- Verificar que la tabla existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'cliente_memoria'
    ) THEN
        RAISE NOTICE '✓ Tabla cliente_memoria creada correctamente';
    ELSE
        RAISE EXCEPTION '✗ Tabla cliente_memoria no creada';
    END IF;

    -- Verificar que las funciones RPC existen
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'upsert_cliente_memoria'
    ) THEN
        RAISE NOTICE '✓ Función upsert_cliente_memoria creada';
    ELSE
        RAISE EXCEPTION '✗ Función upsert_cliente_memoria no creada';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_cliente_memoria'
    ) THEN
        RAISE NOTICE '✓ Función get_cliente_memoria creada';
    ELSE
        RAISE EXCEPTION '✗ Función get_cliente_memoria no creada';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'delete_cliente_memoria'
    ) THEN
        RAISE NOTICE '✓ Función delete_cliente_memoria creada';
    ELSE
        RAISE EXCEPTION '✗ Función delete_cliente_memoria no creada';
    END IF;

    -- Verificar restricción única
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_cliente_memoria'
    ) THEN
        RAISE NOTICE '✓ Restricción única cliente_id creada';
    ELSE
        RAISE EXCEPTION '✗ Restricción única cliente_id no creada';
    END IF;

    RAISE NOTICE '✓ Migración 20260124_cliente_memoria completada con éxito';
END $$;
