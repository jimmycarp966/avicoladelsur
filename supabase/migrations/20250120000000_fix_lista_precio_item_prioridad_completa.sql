-- ===========================================
-- MIGRACIÓN: Corregir prioridad de lista de precios en TODAS las funciones
-- Fecha: 20/01/2025
-- Objetivo:
--   REGLA: SIEMPRE usar la lista del item individual primero.
--   La lista del presupuesto es solo una "configuración rápida" como fallback.
--   Esto aplica a: creación de presupuestos, pesaje, conversión a pedido, etc.
-- ===========================================

BEGIN;

-- Eliminar TODAS las versiones existentes de las funciones para evitar conflictos
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Eliminar todas las versiones de fn_crear_presupuesto
    FOR r IN 
        SELECT p.oid::regprocedure::text as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'fn_crear_presupuesto'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
    
    -- Eliminar todas las versiones de fn_crear_presupuesto_basico
    FOR r IN 
        SELECT p.oid::regprocedure::text as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'fn_crear_presupuesto_basico'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END
$$;

-- ===========================================
-- 1. ACTUALIZAR fn_crear_presupuesto_desde_bot (en fix_pesable_mayorista)
-- ===========================================

-- Esta función ya está corregida en 20251211_fix_fn_crear_presupuesto_lista_precio.sql
-- pero necesitamos asegurarnos de que la versión en fix_pesable_mayorista también esté correcta
-- La versión en fix_pesable_mayorista NO usa listas, así que la dejamos como está
-- porque la versión correcta está en fix_fn_crear_presupuesto_lista_precio.sql

-- ===========================================
-- 2. ACTUALIZAR fn_crear_presupuesto (manual desde frontend)
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_presupuesto(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL,
    p_lista_precio_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto_id UUID;
    v_numero_presupuesto VARCHAR(50);
    v_total_estimado DECIMAL(10,2) := 0;
    v_item JSONB;
    v_precio_unit DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_stock_disponible DECIMAL(10,3);
    v_producto RECORD;
    v_lista_tipo VARCHAR(50);
    v_unidad_venta VARCHAR(50);
    v_es_mayorista BOOLEAN;
    v_es_pesable BOOLEAN;
    v_lista_precio_id_item UUID;
    v_lista_precio_id_usar UUID;
BEGIN
    -- Generar número de presupuesto secuencial
    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

    -- Obtener tipo de lista del cliente (para determinar si es mayorista)
    SELECT lp.tipo INTO v_lista_tipo
    FROM clientes_listas_precios clp
    INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
    WHERE clp.cliente_id = p_cliente_id AND lp.activa = true
    ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
    LIMIT 1;

    -- Crear presupuesto con lista_precio_id
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones, lista_precio_id
    ) VALUES (
        v_numero_presupuesto, p_cliente_id, p_zona_id, 'pendiente', p_observaciones, p_lista_precio_id
    ) RETURNING id INTO v_presupuesto_id;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- REGLA: SIEMPRE priorizar lista_precio_id del item individual
        -- Solo usar lista del presupuesto si el item no tiene lista propia
        IF (v_item->>'lista_precio_id') IS NOT NULL 
           AND (v_item->>'lista_precio_id') != 'null' 
           AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := NULL;
        END IF;
        
        -- Determinar qué lista usar: item primero, presupuesto como fallback
        v_lista_precio_id_usar := COALESCE(v_lista_precio_id_item, p_lista_precio_id);

        -- Obtener producto con campos de venta por mayor
        SELECT 
            id, precio_venta, unidad_medida, categoria,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        -- Calcular precio: usar lista si está disponible, sino precio_venta
        IF v_lista_precio_id_usar IS NOT NULL THEN
            SELECT fn_obtener_precio_producto(v_lista_precio_id_usar, v_producto.id) INTO v_precio_unit;
        ELSE
            v_precio_unit := COALESCE(v_producto.precio_venta, 0);
        END IF;

        -- Determinar si es venta mayorista
        v_es_mayorista := (
            v_lista_tipo IN ('mayorista', 'distribuidor')
            AND v_producto.venta_mayor_habilitada = true
        );

        -- Determinar unidad de venta
        IF v_es_mayorista AND v_producto.unidad_medida = 'kg' THEN
            v_unidad_venta := v_producto.unidad_mayor_nombre;
        ELSE
            v_unidad_venta := v_producto.unidad_medida;
        END IF;

        v_subtotal := (v_item->>'cantidad')::DECIMAL * v_precio_unit;

        -- Verificar stock
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l WHERE l.producto_id = v_producto.id AND l.estado = 'disponible';

        -- Determinar si es pesable
        IF v_es_mayorista THEN
            v_es_pesable := false;
        ELSE
            v_es_pesable := EXISTS (
                SELECT 1 FROM productos p
                WHERE p.id = v_producto.id
                AND LOWER(TRIM(p.categoria)) = 'balanza'
            );
        END IF;

        INSERT INTO presupuesto_items (
            presupuesto_id, producto_id, cantidad_solicitada,
            precio_unit_est, subtotal_est, pesable, unidad_venta, lista_precio_id
        ) VALUES (
            v_presupuesto_id, v_producto.id, (v_item->>'cantidad')::DECIMAL,
            v_precio_unit, v_subtotal, v_es_pesable, v_unidad_venta, v_lista_precio_id_item
        );

        v_total_estimado := v_total_estimado + v_subtotal;
    END LOOP;

    UPDATE presupuestos SET total_estimado = v_total_estimado WHERE id = v_presupuesto_id;

    RETURN jsonb_build_object(
        'success', true,
        'presupuesto_id', v_presupuesto_id,
        'numero_presupuesto', v_numero_presupuesto
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Error al crear presupuesto: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_crear_presupuesto IS 
'Crea presupuesto manual desde frontend.
REGLA: SIEMPRE usar la lista del item individual. La lista del presupuesto es solo una "configuración rápida" como fallback.';

-- ===========================================
-- 3. ACTUALIZAR fn_crear_presupuesto_basico
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_presupuesto_basico(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL,
    p_lista_precio_id UUID DEFAULT NULL
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
    v_producto RECORD;
    v_lista_tipo VARCHAR(50);
    v_unidad_venta VARCHAR(50);
    v_es_mayorista BOOLEAN;
    v_es_pesable BOOLEAN;
    v_lista_precio_id_item UUID;
    v_lista_precio_id_usar UUID;
BEGIN
    -- Detectar zona del cliente
    IF p_zona_id IS NULL THEN
        SELECT z.id INTO v_cliente_zona_id
        FROM clientes c
        LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(c.zona_entrega))
        WHERE c.id = p_cliente_id
        LIMIT 1;
        p_zona_id := v_cliente_zona_id;
    END IF;

    -- Obtener tipo de lista del cliente (para determinar si es mayorista)
    SELECT lp.tipo INTO v_lista_tipo
    FROM clientes_listas_precios clp
    INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
    WHERE clp.cliente_id = p_cliente_id AND lp.activa = true
    ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
    LIMIT 1;

    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones, turno, lista_precio_id
    ) VALUES (
        v_numero_presupuesto, p_cliente_id, p_zona_id, 'pendiente', p_observaciones, NULL, p_lista_precio_id
    ) RETURNING id INTO v_presupuesto_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- REGLA: SIEMPRE priorizar lista_precio_id del item individual
        IF (v_item->>'lista_precio_id') IS NOT NULL 
           AND (v_item->>'lista_precio_id') != 'null' 
           AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := NULL;
        END IF;
        
        -- Determinar qué lista usar: item primero, presupuesto como fallback
        v_lista_precio_id_usar := COALESCE(v_lista_precio_id_item, p_lista_precio_id);

        SELECT 
            id, precio_venta, unidad_medida, categoria,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        -- Calcular precio: usar lista si está disponible, sino precio_venta
        IF v_lista_precio_id_usar IS NOT NULL THEN
            SELECT fn_obtener_precio_producto(v_lista_precio_id_usar, v_producto.id) INTO v_precio_unit;
        ELSE
            v_precio_unit := COALESCE(v_producto.precio_venta, 0);
        END IF;

        -- Determinar si es venta mayorista
        v_es_mayorista := (
            v_lista_tipo IN ('mayorista', 'distribuidor')
            AND v_producto.venta_mayor_habilitada = true
        );

        -- Determinar unidad de venta
        IF v_es_mayorista AND v_producto.unidad_medida = 'kg' THEN
            v_unidad_venta := v_producto.unidad_mayor_nombre;
        ELSE
            v_unidad_venta := v_producto.unidad_medida;
        END IF;

        v_subtotal := (v_item->>'cantidad')::DECIMAL * v_precio_unit;

        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l WHERE l.producto_id = v_producto.id AND l.estado = 'disponible';

        -- Determinar si es pesable
        IF v_es_mayorista THEN
            v_es_pesable := false;
        ELSE
            v_es_pesable := EXISTS (
                SELECT 1 FROM productos p
                WHERE p.id = v_producto.id
                AND LOWER(TRIM(p.categoria)) = 'balanza'
            );
        END IF;

        INSERT INTO presupuesto_items (
            presupuesto_id, producto_id, cantidad_solicitada,
            precio_unit_est, subtotal_est, pesable, unidad_venta, lista_precio_id
        ) VALUES (
            v_presupuesto_id, v_producto.id, (v_item->>'cantidad')::DECIMAL,
            v_precio_unit, v_subtotal, v_es_pesable, v_unidad_venta, v_lista_precio_id_item
        );

        v_total_estimado := v_total_estimado + v_subtotal;
    END LOOP;

    UPDATE presupuestos SET total_estimado = v_total_estimado WHERE id = v_presupuesto_id;

    SELECT fn_reservar_stock_por_presupuesto(v_presupuesto_id) INTO v_reserva_result;

    RETURN jsonb_build_object(
        'success', true,
        'presupuesto_id', v_presupuesto_id,
        'numero_presupuesto', v_numero_presupuesto,
        'total_estimado', v_total_estimado,
        'reserva_result', v_reserva_result
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_crear_presupuesto_basico IS 
'Crea presupuesto básico.
REGLA: SIEMPRE usar la lista del item individual. La lista del presupuesto es solo una "configuración rápida" como fallback.';

-- ===========================================
-- RESUMEN DE CAMBIOS
-- ===========================================

-- 1. fn_actualizar_peso_item_presupuesto: ✅ Ya corregida en 20250120_fix_precio_pesaje_lista_precio.sql
--    - Prioriza lista_precio_id del item individual
--    - Usa lista del presupuesto solo como fallback

-- 2. fn_crear_presupuesto_desde_bot: ✅ Ya corregida en 20251211_fix_fn_crear_presupuesto_lista_precio.sql
--    - Prioriza lista_precio_id del item individual
--    - Usa lista del presupuesto solo como fallback

-- 3. fn_crear_presupuesto: ✅ Corregida en esta migración
--    - Ahora acepta p_lista_precio_id como parámetro
--    - Prioriza lista_precio_id del item individual
--    - Usa lista del presupuesto solo como fallback
--    - Guarda lista_precio_id en cada item

-- 4. fn_crear_presupuesto_basico: ✅ Corregida en esta migración
--    - Ahora acepta p_lista_precio_id como parámetro
--    - Prioriza lista_precio_id del item individual
--    - Usa lista del presupuesto solo como fallback
--    - Guarda lista_precio_id en cada item

-- 5. fn_convertir_presupuesto_a_pedido: ✅ No requiere cambios
--    - Los precios ya están calculados en el presupuesto usando la lista correcta
--    - Solo copia los precios finales calculados

-- REGLA APLICADA EN TODAS LAS FUNCIONES:
-- SIEMPRE usar la lista del item individual primero.
-- La lista del presupuesto es solo una "configuración rápida" como fallback.

COMMIT;

