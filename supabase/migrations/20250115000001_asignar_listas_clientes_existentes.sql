-- ===========================================
-- MIGRACIÓN: Asignar listas automáticas a clientes existentes
-- Fecha: 15/01/2025
-- ===========================================

BEGIN;

-- Asignar listas automáticas a todos los clientes existentes según su tipo_cliente
DO $$
DECLARE
    v_cliente RECORD;
    v_lista_id UUID;
    v_result JSONB;
BEGIN
    -- Iterar sobre todos los clientes activos
    FOR v_cliente IN
        SELECT id, tipo_cliente
        FROM clientes
        WHERE activo = true
          AND tipo_cliente IN ('minorista', 'mayorista', 'distribuidor')
    LOOP
        -- Buscar lista correspondiente al tipo
        SELECT id INTO v_lista_id
        FROM listas_precios
        WHERE tipo = v_cliente.tipo_cliente
          AND activa = true
        ORDER BY created_at ASC
        LIMIT 1;

        -- Si existe la lista y el cliente no la tiene asignada, asignarla
        IF v_lista_id IS NOT NULL THEN
            -- Verificar si ya tiene esta lista asignada
            IF NOT EXISTS (
                SELECT 1 FROM clientes_listas_precios
                WHERE cliente_id = v_cliente.id
                  AND lista_precio_id = v_lista_id
            ) THEN
                -- Verificar que no exceda el límite de 2 listas
                IF (
                    SELECT COUNT(*) FROM clientes_listas_precios
                    WHERE cliente_id = v_cliente.id
                      AND activa = true
                ) < 2 THEN
                    -- Asignar lista automática
                    INSERT INTO clientes_listas_precios (
                        cliente_id,
                        lista_precio_id,
                        es_automatica,
                        prioridad,
                        activa
                    ) VALUES (
                        v_cliente.id,
                        v_lista_id,
                        true,
                        1,
                        true
                    )
                    ON CONFLICT (cliente_id, lista_precio_id) DO UPDATE
                    SET es_automatica = true,
                        activa = true,
                        prioridad = 1,
                        updated_at = NOW();
                END IF;
            END IF;
        END IF;
    END LOOP;
END $$;

COMMIT;

