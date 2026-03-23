-- ===========================================
-- MIGRACIÓN: Pausar validación de horario de corte (TEMPORAL)
-- Fecha: 17/12/2025
-- Objetivo: Eliminar temporalmente la validación de horario de corte
--           para permitir pruebas del sistema sin restricciones de fecha
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_obtener_o_crear_pedido_abierto (SIN VALIDACIÓN DE HORARIO)
-- Busca pedido abierto para turno/zona/fecha, si no existe lo crea
-- MODIFICADA: Se eliminó la validación de horario de corte para pruebas
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_o_crear_pedido_abierto(
    p_zona_id UUID,
    p_turno TEXT,
    p_fecha DATE
) RETURNS UUID AS $$
DECLARE
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
BEGIN
    -- Validar parámetros
    IF p_zona_id IS NULL THEN
        RAISE EXCEPTION 'La zona es requerida';
    END IF;
    
    IF p_turno IS NULL OR p_turno NOT IN ('mañana', 'tarde') THEN
        RAISE EXCEPTION 'El turno debe ser mañana o tarde';
    END IF;
    
    IF p_fecha IS NULL THEN
        p_fecha := DATE(v_now_ba);
    END IF;
    
    -- NOTA: Se eliminó la validación de horario de corte para pruebas
    -- Cuando se quiera reactivar, descomentar el bloque de código en la migración original
    
    -- Buscar pedido abierto existente
    SELECT id INTO v_pedido_id
    FROM pedidos
    WHERE zona_id = p_zona_id
      AND turno = p_turno
      AND fecha_entrega_estimada = p_fecha
      AND estado_cierre = 'abierto'
    LIMIT 1;
    
    -- Si no existe, crear uno nuevo
    IF v_pedido_id IS NULL THEN
        -- Generar número de pedido único
        v_numero_pedido := 'PED-' || TO_CHAR(p_fecha, 'YYYYMMDD') || '-' || 
                          UPPER(SUBSTRING(p_turno FROM 1 FOR 1)) || '-' ||
                          UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
        
        INSERT INTO pedidos (
            numero_pedido,
            zona_id,
            turno,
            fecha_entrega_estimada,
            estado,
            estado_cierre,
            tipo_pedido,
            origen,
            subtotal,
            total,
            cantidad_entregas
        ) VALUES (
            v_numero_pedido,
            p_zona_id,
            p_turno,
            p_fecha,
            'preparando',
            'abierto',
            'venta',
            'agrupado',
            0,
            0,
            0
        ) RETURNING id INTO v_pedido_id;
    END IF;
    
    RETURN v_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_obtener_o_crear_pedido_abierto(UUID, TEXT, DATE) IS 
'Obtiene el pedido abierto para una combinación turno/zona/fecha, o lo crea si no existe. TEMPORAL: Sin validación de horario de corte.';

-- ===========================================
-- Reabrir solo el pedido más reciente por cada turno/zona/fecha
-- (para evitar conflictos con el índice único)
-- ===========================================

-- Primero, reabrir solo los pedidos más recientes de cada combinación turno/zona/fecha
UPDATE pedidos p
SET estado_cierre = 'abierto',
    hora_cierre = NULL
WHERE p.id IN (
    SELECT DISTINCT ON (turno, zona_id, fecha_entrega_estimada) id
    FROM pedidos
    WHERE estado_cierre = 'cerrado'
      AND estado NOT IN ('entregado', 'cancelado')
    ORDER BY turno, zona_id, fecha_entrega_estimada, created_at DESC
)
AND NOT EXISTS (
    -- Verificar que no haya ya un pedido abierto para esa combinación
    SELECT 1 FROM pedidos p2 
    WHERE p2.turno = p.turno 
      AND p2.zona_id = p.zona_id 
      AND p2.fecha_entrega_estimada = p.fecha_entrega_estimada
      AND p2.estado_cierre = 'abierto'
);

COMMIT;

