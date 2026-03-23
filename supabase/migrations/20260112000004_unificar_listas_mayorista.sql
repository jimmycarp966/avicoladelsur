-- ===========================================
-- MIGRACIÓN: Unificar todos los clientes a lista MAYORISTA
-- Fecha: 12/01/2026
-- ===========================================

DO $$
DECLARE
    v_lista_id UUID;
BEGIN
    -- 1. Obtener ID de la lista MAYORISTA
    SELECT id INTO v_lista_id 
    FROM listas_precios 
    WHERE codigo = 'MAYORISTA' AND activa = true 
    LIMIT 1;

    IF v_lista_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró la lista de precios con código MAYORISTA y estado activo.';
    END IF;

    -- 2. Desactivar TODAS las listas de precios actuales de todos los clientes activos
    UPDATE clientes_listas_precios
    SET activa = false, 
        updated_at = NOW()
    WHERE cliente_id IN (SELECT id FROM clientes WHERE activo = true);

    -- 3. Insertar/Actualizar la lista MAYORISTA para todos los clientes activos
    INSERT INTO clientes_listas_precios (cliente_id, lista_precio_id, es_automatica, prioridad, activa)
    SELECT 
        c.id,
        v_lista_id,
        false,  -- No es automática
        1,      -- Prioridad máxima
        true    -- Activa
    FROM clientes c
    WHERE c.activo = true
    ON CONFLICT (cliente_id, lista_precio_id) 
    DO UPDATE SET 
        activa = true,
        prioridad = 1,
        updated_at = NOW();

END $$;
