-- ===========================================
-- MIGRACIÓN: Actualizar función fn_asignar_lista_automatica_cliente para validar vigencia
-- Fecha: 07/12/2025
-- ===========================================

BEGIN;

-- ===========================================
-- ACTUALIZAR FUNCIÓN fn_asignar_lista_automatica_cliente
-- ===========================================

-- Función actualizada para validar vigencia si vigencia_activa = true
CREATE OR REPLACE FUNCTION fn_asignar_lista_automatica_cliente(
    p_cliente_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_tipo_cliente VARCHAR(50);
    v_lista_id UUID;
    v_existe BOOLEAN;
    v_count INTEGER;
    v_result JSONB;
BEGIN
    -- Obtener tipo_cliente del cliente
    SELECT tipo_cliente INTO v_tipo_cliente
    FROM clientes
    WHERE id = p_cliente_id;

    IF v_tipo_cliente IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;

    -- Solo procesar si es minorista, mayorista o distribuidor
    IF v_tipo_cliente NOT IN ('minorista', 'mayorista', 'distribuidor') THEN
        RETURN jsonb_build_object('success', true, 'message', 'Tipo de cliente no requiere lista automática');
    END IF;

    -- Buscar lista correspondiente al tipo
    -- Validar vigencia solo si vigencia_activa = true
    SELECT id INTO v_lista_id
    FROM listas_precios
    WHERE tipo = v_tipo_cliente
      AND activa = true
      AND (
        -- Si vigencia_activa es false o NULL, la lista está siempre vigente
        COALESCE(vigencia_activa, false) = false
        OR
        -- Si vigencia_activa es true, validar fechas
        (
          vigencia_activa = true
          AND (fecha_vigencia_desde IS NULL OR fecha_vigencia_desde <= CURRENT_DATE)
          AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= CURRENT_DATE)
        )
      )
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_lista_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No existe lista de precios vigente para el tipo ' || v_tipo_cliente);
    END IF;

    -- Verificar si el cliente ya tiene esta lista asignada
    SELECT EXISTS(
        SELECT 1 FROM clientes_listas_precios
        WHERE cliente_id = p_cliente_id
          AND lista_precio_id = v_lista_id
    ) INTO v_existe;

    IF v_existe THEN
        RETURN jsonb_build_object('success', true, 'message', 'Lista ya asignada');
    END IF;

    -- Desactivar listas automáticas anteriores del mismo tipo
    UPDATE clientes_listas_precios
    SET activa = false,
        updated_at = NOW()
    WHERE cliente_id = p_cliente_id
      AND es_automatica = true
      AND activa = true;

    -- Verificar que no exceda el límite de 2 listas
    SELECT COUNT(*) INTO v_count
    FROM clientes_listas_precios
    WHERE cliente_id = p_cliente_id
      AND activa = true;

    IF v_count >= 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente ya tiene 2 listas activas');
    END IF;

    -- Asignar nueva lista automática
    INSERT INTO clientes_listas_precios (
        cliente_id,
        lista_precio_id,
        es_automatica,
        prioridad,
        activa
    ) VALUES (
        p_cliente_id,
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

    RETURN jsonb_build_object('success', true, 'lista_id', v_lista_id);
END;
$$ LANGUAGE plpgsql;

COMMIT;

