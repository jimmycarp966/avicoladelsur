-- ===========================================
-- MIGRACIÓN: Corregir lógica de pesable para productos mayoristas
-- Fecha: 20/01/2025
-- Objetivo:
--   Los productos mayoristas NO deben ser pesables, incluso si tienen
--   categoría BALANZA, porque vienen en caja cerrada
-- ===========================================

BEGIN;

-- ===========================================
-- ELIMINAR TODAS LAS VERSIONES EXISTENTES DE LAS FUNCIONES
-- ===========================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Eliminar todas las versiones de fn_crear_presupuesto_desde_bot
    FOR r IN 
        SELECT p.oid::regprocedure::text as func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'fn_crear_presupuesto_desde_bot'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
    
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
-- ACTUALIZAR fn_crear_presupuesto_desde_bot
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
    v_producto RECORD;
    v_lista_tipo VARCHAR(50);
    v_unidad_venta VARCHAR(50);
    v_cantidad_real DECIMAL(10,3);
    v_es_mayorista BOOLEAN;
    v_es_pesable BOOLEAN;
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

    -- Obtener tipo de lista del cliente (para determinar si es mayorista)
    SELECT lp.tipo INTO v_lista_tipo
    FROM clientes_listas_precios clp
    INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
    WHERE clp.cliente_id = p_cliente_id
      AND lp.activa = true
    ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
    LIMIT 1;

    v_estado_inicial := 'en_almacen';

    -- Generar número de presupuesto secuencial
    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

    -- Crear presupuesto
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
        -- Obtener producto con campos de venta por mayor
        SELECT 
            id, precio_venta, unidad_medida, categoria,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre,
            COALESCE(kg_por_unidad_mayor, 20) as kg_por_unidad_mayor
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        -- Usar precio_unitario del JSON si está presente
        IF (v_item->>'precio_unitario') IS NOT NULL AND (v_item->>'precio_unitario')::DECIMAL > 0 THEN
            v_precio_unit := (v_item->>'precio_unitario')::DECIMAL;
        ELSE
            IF v_producto.precio_venta IS NULL OR v_producto.precio_venta = 0 THEN
                v_precio_unit := 0;
            ELSE
                v_precio_unit := v_producto.precio_venta;
            END IF;
        END IF;

        -- Determinar si es venta mayorista
        v_es_mayorista := (
            v_lista_tipo IN ('mayorista', 'distribuidor')
            AND v_producto.venta_mayor_habilitada = true
        );

        -- Determinar unidad de venta y cantidad real
        IF v_es_mayorista AND v_producto.unidad_medida = 'kg' THEN
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

        -- Verificar stock disponible (básico)
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = v_producto.id
        AND l.estado = 'disponible';

        -- Determinar si es pesable
        -- Si es mayorista, NO es pesable (productos vienen en caja cerrada)
        -- Si no es mayorista, verificar si tiene categoría BALANZA
        IF v_es_mayorista THEN
            v_es_pesable := false;
        ELSE
            v_es_pesable := EXISTS (
                SELECT 1 FROM productos p
                WHERE p.id = v_producto.id
                AND LOWER(TRIM(p.categoria)) = 'balanza'
            );
        END IF;

        -- Insertar item con unidad de venta
        INSERT INTO presupuesto_items (
            presupuesto_id,
            producto_id,
            cantidad_solicitada,
            precio_unit_est,
            subtotal_est,
            pesable,
            unidad_venta
        ) VALUES (
            v_presupuesto_id,
            v_producto.id,
            v_cantidad_real,
            v_precio_unit,
            v_subtotal,
            v_es_pesable,
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

    RETURN jsonb_build_object(
        'success', true,
        'presupuesto_id', v_presupuesto_id,
        'numero_presupuesto', v_numero_presupuesto,
        'total_estimado', v_total_estimado,
        'turno', v_turno,
        'fecha_entrega_estimada', v_fecha_entrega,
        'reserva_result', v_reserva_result,
        'tipo_lista_cliente', COALESCE(v_lista_tipo, 'minorista')
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_crear_presupuesto_desde_bot IS 
'Crea presupuesto desde WhatsApp con soporte para venta por mayor.
Si el cliente tiene lista mayorista y el producto tiene venta_mayor_habilitada,
guarda la unidad de venta correcta (caja, bolsa, etc.).
Los productos mayoristas NO son pesables, incluso si tienen categoría BALANZA.';

-- ===========================================
-- ACTUALIZAR fn_crear_presupuesto (manual desde frontend)
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_presupuesto(
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
    v_producto RECORD;
    v_lista_tipo VARCHAR(50);
    v_unidad_venta VARCHAR(50);
    v_es_mayorista BOOLEAN;
    v_es_pesable BOOLEAN;
BEGIN
    -- Generar número de presupuesto secuencial
    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

    -- Obtener tipo de lista del cliente
    SELECT lp.tipo INTO v_lista_tipo
    FROM clientes_listas_precios clp
    INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
    WHERE clp.cliente_id = p_cliente_id AND lp.activa = true
    ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
    LIMIT 1;

    -- Crear presupuesto
    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones
    ) VALUES (
        v_numero_presupuesto, p_cliente_id, p_zona_id, 'pendiente', p_observaciones
    ) RETURNING id INTO v_presupuesto_id;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener producto con campos de venta por mayor
        SELECT 
            id, precio_venta, unidad_medida, categoria,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        v_precio_unit := v_producto.precio_venta;

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
        -- Si es mayorista, NO es pesable (productos vienen en caja cerrada)
        -- Si no es mayorista, verificar si tiene categoría BALANZA
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
            precio_unit_est, subtotal_est, pesable, unidad_venta
        ) VALUES (
            v_presupuesto_id, v_producto.id, (v_item->>'cantidad')::DECIMAL,
            v_precio_unit, v_subtotal, v_es_pesable, v_unidad_venta
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

-- ===========================================
-- ACTUALIZAR fn_crear_presupuesto_basico
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_presupuesto_basico(
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
    v_producto RECORD;
    v_lista_tipo VARCHAR(50);
    v_unidad_venta VARCHAR(50);
    v_es_mayorista BOOLEAN;
    v_es_pesable BOOLEAN;
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

    -- Obtener tipo de lista del cliente
    SELECT lp.tipo INTO v_lista_tipo
    FROM clientes_listas_precios clp
    INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
    WHERE clp.cliente_id = p_cliente_id AND lp.activa = true
    ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
    LIMIT 1;

    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

    INSERT INTO presupuestos (
        numero_presupuesto, cliente_id, zona_id, estado, observaciones, turno
    ) VALUES (
        v_numero_presupuesto, p_cliente_id, p_zona_id, 'pendiente', p_observaciones, NULL
    ) RETURNING id INTO v_presupuesto_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT 
            id, precio_venta, unidad_medida, categoria,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        v_precio_unit := v_producto.precio_venta;

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
        -- Si es mayorista, NO es pesable (productos vienen en caja cerrada)
        -- Si no es mayorista, verificar si tiene categoría BALANZA
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
            precio_unit_est, subtotal_est, pesable, unidad_venta
        ) VALUES (
            v_presupuesto_id, v_producto.id, (v_item->>'cantidad')::DECIMAL,
            v_precio_unit, v_subtotal, v_es_pesable, v_unidad_venta
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

COMMIT;

