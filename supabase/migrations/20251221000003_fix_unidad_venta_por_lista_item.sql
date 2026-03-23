-- ===========================================
-- MIGRACIÓN: Fix unidad_venta usa lista del item, no del cliente
-- Fecha: 21/12/2025
-- Descripción: Corregir lógica para que unidad_venta se determine
--              según la lista de precios seleccionada para CADA ITEM,
--              no según la lista asociada al cliente.
-- Bug: Al seleccionar Lista Mayorista para un producto, el sistema
--      seguía usando la unidad del cliente en lugar de la del item.
-- ===========================================

BEGIN;

-- Actualizar función fn_crear_presupuesto_desde_bot
CREATE OR REPLACE FUNCTION fn_crear_presupuesto_desde_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL,
    p_fecha_entrega_estimada DATE DEFAULT NULL,
    p_lista_precio_id UUID DEFAULT NULL -- Lista global (opcional)
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
    v_producto RECORD;
    v_lista_tipo_item VARCHAR(50); -- CAMBIADO: Ahora es por item, no global
    v_unidad_venta VARCHAR(50);
    v_cantidad_real DECIMAL(10,3);
    v_lista_precio_id_item UUID;
    v_es_mayorista BOOLEAN;
BEGIN
    -- Intentar detectar zona del cliente si no se proporciona
    IF p_zona_id IS NULL THEN
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
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        ELSE
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
        END IF;
    ELSE
        v_fecha_entrega := p_fecha_entrega_estimada;
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
        ELSE
            IF p_fecha_entrega_estimada = DATE(v_now_ba) THEN
                v_turno := 'mañana';
                v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
            ELSE
                v_turno := 'mañana';
            END IF;
        END IF;
    END IF;

    v_estado_inicial := 'en_almacen';

    -- Generar número de presupuesto secuencial
    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

    -- Crear presupuesto con lista_precio_id
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones, turno, fecha_entrega_estimada, lista_precio_id
    ) VALUES (
        v_numero_presupuesto, 
        p_cliente_id, 
        p_zona_id, 
        v_estado_inicial,
        p_observaciones, 
        v_turno, 
        v_fecha_entrega,
        p_lista_precio_id
    ) RETURNING id INTO v_presupuesto_id;

    -- REMOVIDO: Ya no obtenemos tipo de lista del cliente globalmente
    -- Ahora cada item determina su propia lista

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener lista_precio_id del item (si existe) o usar la global
        IF (v_item->>'lista_precio_id') IS NOT NULL AND (v_item->>'lista_precio_id') != 'null' AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := p_lista_precio_id;
        END IF;

        -- NUEVO: Obtener tipo de lista para ESTE item específico
        v_lista_tipo_item := NULL;
        v_es_mayorista := FALSE;
        IF v_lista_precio_id_item IS NOT NULL THEN
            SELECT tipo INTO v_lista_tipo_item
            FROM listas_precios
            WHERE id = v_lista_precio_id_item
              AND activa = true;
            
            v_es_mayorista := v_lista_tipo_item IN ('mayorista', 'distribuidor');
        END IF;

        -- Obtener producto con campos de venta por mayor
        SELECT 
            id, precio_venta, unidad_medida, categoria,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre,
            COALESCE(kg_por_unidad_mayor, 20) as kg_por_unidad_mayor
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Producto no encontrado: %s', v_item->>'producto_id')
            );
        END IF;

        -- Usar precio_unitario del JSON si está presente, sino obtener precio desde lista o producto
        IF (v_item->>'precio_unitario') IS NOT NULL AND (v_item->>'precio_unitario')::DECIMAL > 0 THEN
            v_precio_unit := (v_item->>'precio_unitario')::DECIMAL;
        ELSE
            -- Si hay lista_precio_id, obtener precio desde la lista usando fn_obtener_precio_producto
            IF v_lista_precio_id_item IS NOT NULL THEN
                SELECT fn_obtener_precio_producto(v_lista_precio_id_item, (v_item->>'producto_id')::UUID) INTO v_precio_unit;
            ELSE
                -- Fallback: obtener precio del producto desde BD
                IF v_producto.precio_venta IS NULL OR v_producto.precio_venta = 0 THEN
                    v_precio_unit := 0;
                ELSE
                    v_precio_unit := v_producto.precio_venta;
                END IF;
            END IF;
            
            IF v_precio_unit IS NULL OR v_precio_unit = 0 THEN
                v_precio_unit := 0;
            END IF;
        END IF;

        -- CORREGIDO: Determinar unidad de venta y cantidad real
        -- Ahora usa v_es_mayorista que viene de la lista del ITEM, no del cliente
        IF v_es_mayorista
           AND v_producto.venta_mayor_habilitada
           AND v_producto.unidad_medida = 'kg' THEN
            -- La cantidad representa unidades mayores (cajas)
            v_unidad_venta := v_producto.unidad_mayor_nombre;
            -- La cantidad real en kg para stock se calculará al convertir a pedido
            v_cantidad_real := (v_item->>'cantidad')::DECIMAL;
        ELSE
            -- Venta normal en unidad base
            v_unidad_venta := v_producto.unidad_medida;
            v_cantidad_real := (v_item->>'cantidad')::DECIMAL;
        END IF;

        -- Calcular subtotal
        v_subtotal := v_cantidad_real * v_precio_unit;

        -- Verificar stock disponible
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
        AND l.estado = 'disponible';

        -- Insertar item con lista_precio_id y unidad_venta
        INSERT INTO presupuesto_items (
            presupuesto_id,
            producto_id,
            cantidad_solicitada,
            precio_unit_est,
            subtotal_est,
            pesable,
            lista_precio_id,
            unidad_venta
        ) VALUES (
            v_presupuesto_id,
            v_producto.id,
            v_cantidad_real,
            v_precio_unit,
            v_subtotal,
            EXISTS (
                SELECT 1 FROM productos p
                WHERE p.id = v_producto.id
                AND LOWER(TRIM(p.categoria)) = 'balanza'
            ),
            v_lista_precio_id_item,
            v_unidad_venta
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

-- Agregar comentario explicativo
COMMENT ON FUNCTION fn_crear_presupuesto_desde_bot IS 
'Crea un presupuesto desde el formulario o bot.
IMPORTANTE: La unidad_venta (kg o caja) se determina según la lista de precios
seleccionada para CADA ITEM individual, no según la lista asociada al cliente.
Si el item usa Lista Mayorista y el producto tiene venta_mayor_habilitada,
la cantidad se interpreta como cajas (unidad_mayor).';

COMMIT;
