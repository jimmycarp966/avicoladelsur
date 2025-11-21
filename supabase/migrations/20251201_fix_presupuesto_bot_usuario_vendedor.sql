-- =====================================================
-- FIX: Asignar usuario_vendedor a presupuestos creados desde bot
-- =====================================================
-- Fecha: 2025-12-01
-- Problema: Los presupuestos creados desde el bot no tienen usuario_vendedor
--           asignado, causando errores al intentar listarlos por JOIN con usuarios
-- Solución: Asignar el primer usuario admin activo como usuario_vendedor por defecto

-- Actualizar fn_crear_presupuesto_desde_bot para asignar usuario_vendedor
CREATE OR REPLACE FUNCTION fn_crear_presupuesto_desde_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto_id UUID;
    v_numero_presupuesto VARCHAR(50);
    v_total_estimado DECIMAL(10,2) := 0;
    v_item JSONB;
    v_precio_unit DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_stock_disponible DECIMAL(10,3);
    v_reserva_result JSONB;
    v_cliente_zona_id UUID;
    v_usuario_admin_id UUID;
BEGIN
    -- Obtener el primer usuario admin activo para asignarlo como vendedor por defecto
    SELECT id INTO v_usuario_admin_id
    FROM usuarios
    WHERE rol = 'admin' AND activo = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- Si no hay admin, intentar obtener cualquier usuario activo
    IF v_usuario_admin_id IS NULL THEN
        SELECT id INTO v_usuario_admin_id
        FROM usuarios
        WHERE activo = true
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- Intentar detectar zona del cliente si no se proporciona
    IF p_zona_id IS NULL THEN
        -- Buscar zona por nombre en zona_entrega del cliente
        SELECT z.id INTO v_cliente_zona_id
        FROM clientes c
        LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(c.zona_entrega))
        WHERE c.id = p_cliente_id
        LIMIT 1;
        
        p_zona_id := v_cliente_zona_id;
    END IF;

    -- Generar número de presupuesto único
    v_numero_presupuesto := 'PRES-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear presupuesto (asignar usuario_vendedor por defecto si existe)
    INSERT INTO presupuestos (
        numero_presupuesto, 
        cliente_id, 
        zona_id, 
        estado, 
        observaciones, 
        turno,
        usuario_vendedor
    ) VALUES (
        v_numero_presupuesto, 
        p_cliente_id, 
        p_zona_id, 
        'pendiente', 
        p_observaciones, 
        NULL,
        v_usuario_admin_id
    ) RETURNING id INTO v_presupuesto_id;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener precio del producto
        SELECT precio_venta INTO v_precio_unit
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        -- Calcular subtotal
        v_subtotal := (v_item->>'cantidad')::DECIMAL * v_precio_unit;

        -- Verificar stock disponible (básico)
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
        AND l.estado = 'disponible';

        -- Determinar si es pesable (productos con categoria BALANZA)
        INSERT INTO presupuesto_items (
            presupuesto_id, producto_id, cantidad_solicitada,
            precio_unit_est, subtotal_est, pesable
        ) VALUES (
            v_presupuesto_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            v_precio_unit,
            v_subtotal,
            EXISTS (SELECT 1 FROM productos WHERE id = (v_item->>'producto_id')::UUID AND categoria = 'BALANZA')
        );

        v_total_estimado := v_total_estimado + v_subtotal;
    END LOOP;

    -- Actualizar total estimado
    UPDATE presupuestos
    SET total_estimado = v_total_estimado
    WHERE id = v_presupuesto_id;

    -- Intentar reservar stock preventivo
    SELECT fn_reservar_stock_por_presupuesto(v_presupuesto_id) INTO v_reserva_result;

    -- Retornar resultado
    RETURN jsonb_build_object(
        'success', true,
        'presupuesto_id', v_presupuesto_id,
        'numero_presupuesto', v_numero_presupuesto,
        'total_estimado', v_total_estimado,
        'reserva_result', v_reserva_result
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar presupuestos existentes sin usuario_vendedor (solo si no tienen uno asignado)
UPDATE presupuestos
SET usuario_vendedor = (
    SELECT id 
    FROM usuarios 
    WHERE rol = 'admin' AND activo = true 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE usuario_vendedor IS NULL
AND estado IN ('pendiente', 'en_almacen');

COMMENT ON FUNCTION fn_crear_presupuesto_desde_bot IS 'Crea presupuestos desde el bot de WhatsApp, asignando automáticamente un usuario admin como vendedor por defecto';

