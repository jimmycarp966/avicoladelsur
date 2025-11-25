-- ===========================================
-- AJUSTE: Asignación automática de turno al crear presupuesto
-- Fecha: 2025-11-30
-- Descripción:
--   - Al crear un presupuesto (manual o por bot), se asigna turno automáticamente
--     según la hora local usando la misma lógica que al convertir a pedido:
--     - Si hora < 5 AM → turno mañana del mismo día
--     - Si hora >= 5 AM y < 15:00 (3 PM) → turno tarde del mismo día
--     - Si hora >= 15:00 (3 PM) → turno mañana del día siguiente
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_presupuesto_desde_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL,
    p_fecha_entrega_estimada DATE DEFAULT NULL
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
    v_turno VARCHAR(20);
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_estado_inicial VARCHAR(50);
BEGIN
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

    -- Determinar turno y fecha de entrega automáticamente según horarios de corte
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    IF p_fecha_entrega_estimada IS NULL THEN
        -- Asignar fecha según horario de corte
        IF v_hora_actual < 5 THEN
            -- Antes de las 5 AM → turno mañana del mismo día
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            -- Entre 5 AM y 3 PM → turno tarde del mismo día
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        ELSE
            -- Después de las 3 PM → turno mañana del día siguiente
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
        END IF;
    ELSE
        -- Si se proporciona fecha, usar la misma lógica pero con la fecha proporcionada
        v_fecha_entrega := p_fecha_entrega_estimada;
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
        ELSE
            -- Si es después de las 3 PM y la fecha es hoy, asignar mañana del día siguiente
            IF p_fecha_entrega_estimada = DATE(v_now_ba) THEN
                v_turno := 'mañana';
                v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
            ELSE
                v_turno := 'mañana';
            END IF;
        END IF;
    END IF;

    -- Crear presupuestos directamente en estado 'en_almacen' para que aparezcan automáticamente en Presupuestos del Día
    -- Esto permite que el almacén vea inmediatamente los presupuestos que requieren procesamiento
    v_estado_inicial := 'en_almacen';

    -- Generar número de presupuesto único
    v_numero_presupuesto := 'PRES-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear presupuesto con turno y fecha asignados automáticamente
    -- Si tiene productos pesables, crear directamente en estado 'en_almacen' para que aparezca automáticamente en Presupuestos del Día
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones, turno, fecha_entrega_estimada
    ) VALUES (
        v_numero_presupuesto, 
        p_cliente_id, 
        p_zona_id, 
        v_estado_inicial,
        p_observaciones, 
        v_turno, 
        v_fecha_entrega
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
            presupuesto_id,
            producto_id,
            cantidad_solicitada,
            precio_unit_est,
            subtotal_est,
            pesable
        ) VALUES (
            v_presupuesto_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            v_precio_unit,
            v_subtotal,
            EXISTS (
                SELECT 1 FROM productos p
                WHERE p.id = (v_item->>'producto_id')::UUID
                AND LOWER(TRIM(p.categoria)) = 'balanza'
            )
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
        'turno', v_turno,
        'fecha_entrega_estimada', v_fecha_entrega,
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

