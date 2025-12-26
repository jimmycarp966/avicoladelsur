-- ===========================================
-- SCRIPT TEMPORAL: Corregir presupuestos para pruebas
-- Fecha: 26/12/2025
-- Descripción: 
--   1. Actualiza presupuestos de mañana para que aparezcan HOY
--   2. Reaplica lógica temporal en fn_crear_presupuesto_desde_bot
--      para que TODOS los nuevos presupuestos se asignen a HOY
-- 
-- ⚠️ REVERTIR DESPUÉS DE LAS PRUEBAS:
--    Ejecutar la migración 20251212_revertir_logica_dia_siguiente.sql
-- ===========================================

BEGIN;

-- =============================================
-- PASO 1: Actualizar presupuestos existentes
-- Cambiar fecha_entrega_estimada de MAÑANA a HOY
-- =============================================
UPDATE presupuestos
SET fecha_entrega_estimada = CURRENT_DATE,
    updated_at = NOW()
WHERE fecha_entrega_estimada = CURRENT_DATE + INTERVAL '1 day'
  AND estado NOT IN ('anulado', 'entregado');

-- Mostrar cuántos presupuestos se actualizaron
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Presupuestos actualizados de mañana a hoy: %', v_count;
END $$;

-- =============================================
-- PASO 2: Reemplazar función fn_crear_presupuesto_desde_bot
-- ⚠️ LÓGICA TEMPORAL: Siempre asignar a HOY
-- =============================================
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
    v_lista_tipo_item VARCHAR(50);
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

    -- ⚠️ LÓGICA TEMPORAL: Siempre asignar a HOY sin importar la hora
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    -- TEMPORAL: Siempre usar fecha de HOY
    v_fecha_entrega := COALESCE(p_fecha_entrega_estimada, DATE(v_now_ba));
    
    -- Forzar fecha de HOY si la fecha es mañana (para presupuestos creados después de las 15)
    IF v_fecha_entrega = DATE(v_now_ba) + INTERVAL '1 day' THEN
        v_fecha_entrega := DATE(v_now_ba);
    END IF;
    
    -- Asignar turno según hora (pero siempre el mismo día)
    IF v_hora_actual < 12 THEN
        v_turno := 'mañana';
    ELSE
        v_turno := 'tarde';
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

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener lista_precio_id del item (si existe) o usar la global
        IF (v_item->>'lista_precio_id') IS NOT NULL AND (v_item->>'lista_precio_id') != 'null' AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := p_lista_precio_id;
        END IF;

        -- Obtener tipo de lista para este item específico
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

        -- Determinar unidad de venta según lista del ITEM
        IF v_es_mayorista
           AND v_producto.venta_mayor_habilitada
           AND v_producto.unidad_medida = 'kg' THEN
            v_unidad_venta := v_producto.unidad_mayor_nombre;
            v_cantidad_real := (v_item->>'cantidad')::DECIMAL;
        ELSE
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
        'reserva_result', v_reserva_result,
        '_temporal_mode', 'SIEMPRE HOY - Revertir después de pruebas'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agregar comentario para recordar que es temporal
COMMENT ON FUNCTION fn_crear_presupuesto_desde_bot IS 
'⚠️ VERSIÓN TEMPORAL: Todos los presupuestos se asignan a HOY. 
La unidad_venta se determina según la lista de cada item.
Revertir con 20251212_revertir_logica_dia_siguiente.sql';

COMMIT;

-- =============================================
-- VERIFICACIÓN
-- Mostrar presupuestos de hoy
-- =============================================
SELECT 
    numero_presupuesto,
    estado,
    turno,
    fecha_entrega_estimada,
    created_at
FROM presupuestos
WHERE fecha_entrega_estimada = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 10;
