-- ===========================================
-- MIGRACIÓN: Desactivar lógica de horario 15:00 temporalmente
-- Fecha: 12/12/2025
-- Objetivo: Desactivar temporalmente la funcionalidad que hace que los presupuestos
--           creados después de las 15:00 se asignen al día siguiente.
--           Permitir que todo se genere hoy para pruebas.
-- 
-- REVERSIÓN: Para reactivar la funcionalidad normal, revertir esta migración
--            o modificar las funciones para restaurar la lógica original.
-- ===========================================

BEGIN;

-- ===========================================
-- 1. MODIFICAR: fn_crear_presupuesto_desde_bot
-- Cambiar lógica después de las 15:00 para asignar turno tarde del mismo día
-- ===========================================

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
    v_lista_tipo VARCHAR(50);
    v_unidad_venta VARCHAR(50);
    v_cantidad_real DECIMAL(10,3);
    v_lista_precio_id_item UUID;
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
    -- TEMPORAL: Después de las 15:00 siempre asignar turno tarde del mismo día
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
            -- TEMPORAL: Después de las 3 PM → turno tarde del mismo día (antes era mañana día siguiente)
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        END IF;
    ELSE
        -- Si se proporciona fecha, respetarla pero forzar turno tarde si es después de las 15:00
        v_fecha_entrega := p_fecha_entrega_estimada;
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
        ELSE
            -- TEMPORAL: Después de las 3 PM → siempre turno tarde (ignorar selección manual)
            -- Si la fecha es hoy, mantenerla; si es futura, respetarla
            v_turno := 'tarde';
            -- No cambiar la fecha si fue proporcionada manualmente
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

    -- Obtener tipo de lista del cliente (para determinar si es mayorista)
    SELECT lp.tipo INTO v_lista_tipo
    FROM clientes_listas_precios clp
    INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
    WHERE clp.cliente_id = p_cliente_id
      AND lp.activa = true
    ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
    LIMIT 1;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener lista_precio_id del item (si existe) o usar la global
        IF (v_item->>'lista_precio_id') IS NOT NULL AND (v_item->>'lista_precio_id') != 'null' AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := p_lista_precio_id;
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

        -- Determinar unidad de venta y cantidad real
        -- Si es lista mayorista/distribuidor y el producto tiene venta_mayor_habilitada
        IF v_lista_tipo IN ('mayorista', 'distribuidor')
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

COMMENT ON FUNCTION fn_crear_presupuesto_desde_bot(UUID, JSONB, TEXT, UUID, DATE, UUID) IS 
'Crea un presupuesto desde el bot o web. TEMPORAL: Después de las 15:00 asigna turno tarde del mismo día (no día siguiente).';

-- ===========================================
-- 2. MODIFICAR: fn_convertir_presupuesto_a_pedido
-- Cambiar lógica cuando presupuesto no tiene turno y se convierte después de las 15:00
-- ===========================================

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_pedido_id UUID;
    v_turno TEXT;
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_result JSONB;
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_numero_pedido VARCHAR(50);
BEGIN
    -- Obtener datos del presupuesto
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;
    
    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no está en un estado válido para facturar');
    END IF;
    
    -- Validar que tenga zona asignada
    IF v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto debe tener una zona asignada');
    END IF;
    
    -- Validar productos pesables
    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true;
    
    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true
      AND peso_final IS NOT NULL;
    
    -- Validar que todos los productos pesables estén pesados (SIEMPRE, sin importar el estado)
    IF v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 
            'No se puede convertir a pedido: todos los productos pesables deben estar pesados. Faltan ' || 
            (v_total_pesables - v_pesables_pesados) || ' producto(s) por pesar.'
        );
    END IF;
    
    -- Determinar turno y fecha de entrega
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    IF v_presupuesto.turno IS NULL THEN
        -- TEMPORAL: Lógica de horarios de corte modificada
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        ELSE
            -- TEMPORAL: Después de las 3 PM → turno tarde del mismo día (antes era mañana día siguiente)
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        END IF;
        
        -- Actualizar presupuesto con turno y fecha
        UPDATE presupuestos
        SET turno = v_turno,
            fecha_entrega_estimada = v_fecha_entrega,
            updated_at = NOW()
        WHERE id = p_presupuesto_id;
    ELSE
        v_turno := v_presupuesto.turno;
        v_fecha_entrega := COALESCE(v_presupuesto.fecha_entrega_estimada, DATE(v_now_ba));
    END IF;
    
    -- Obtener o crear pedido abierto para este turno/zona/fecha
    BEGIN
        v_pedido_id := fn_obtener_o_crear_pedido_abierto(
            v_presupuesto.zona_id,
            v_turno,
            v_fecha_entrega
        );
    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
    
    -- Agregar presupuesto al pedido como entrega
    v_result := fn_agregar_presupuesto_a_pedido(
        p_presupuesto_id,
        v_pedido_id,
        p_user_id
    );
    
    IF NOT (v_result->>'success')::BOOLEAN THEN
        RETURN v_result;
    END IF;
    
    -- Obtener número de pedido para la respuesta
    SELECT numero_pedido INTO v_numero_pedido
    FROM pedidos WHERE id = v_pedido_id;
    
    -- Agregar información adicional al resultado
    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'entrega_id', v_result->>'entrega_id',
        'cliente_id', v_result->>'cliente_id',
        'total_entrega', v_result->>'total_entrega',
        'referencia_pago', v_result->>'referencia_pago',
        'turno', v_turno,
        'fecha_entrega', v_fecha_entrega,
        'mensaje', 'Presupuesto agregado al pedido ' || v_numero_pedido
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al convertir presupuesto: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_convertir_presupuesto_a_pedido(UUID, UUID, UUID) IS 
'Convierte un presupuesto a entrega dentro de un pedido agrupado por turno/zona/fecha. TEMPORAL: Después de las 15:00 asigna turno tarde del mismo día si no tiene turno.';

-- ===========================================
-- 3. DESACTIVAR: fn_cerrar_pedidos_por_horario
-- Desactivar completamente el cierre automático de pedidos por horario
-- ===========================================

CREATE OR REPLACE FUNCTION fn_cerrar_pedidos_por_horario()
RETURNS INTEGER AS $$
DECLARE
    -- TEMPORAL: Función desactivada completamente
    -- Retornar 0 sin hacer cambios
BEGIN
    -- TEMPORAL: Cierre automático de pedidos desactivado para pruebas
    -- Para reactivar, restaurar la lógica original de esta función
    
    -- CÓDIGO ORIGINAL COMENTADO PARA FÁCIL REVERSIÓN:
    /*
    DECLARE
        v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
        v_hora_actual INTEGER;
        v_fecha_actual DATE;
        v_pedidos_cerrados INTEGER := 0;
        v_count INTEGER := 0;
    BEGIN
        v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
        v_fecha_actual := DATE(v_now_ba);
        
        -- Cerrar pedidos del turno mañana si pasó las 5:00
        IF v_hora_actual >= 5 THEN
            UPDATE pedidos
            SET estado_cierre = 'cerrado',
                hora_cierre = v_now_ba,
                updated_at = NOW()
            WHERE turno = 'mañana'
              AND fecha_entrega_estimada = v_fecha_actual
              AND estado_cierre = 'abierto';
            
            GET DIAGNOSTICS v_count = ROW_COUNT;
            v_pedidos_cerrados := v_pedidos_cerrados + v_count;
        END IF;
        
        -- Cerrar pedidos del turno tarde si pasó las 15:00
        IF v_hora_actual >= 15 THEN
            UPDATE pedidos
            SET estado_cierre = 'cerrado',
                hora_cierre = v_now_ba,
                updated_at = NOW()
            WHERE turno = 'tarde'
              AND fecha_entrega_estimada = v_fecha_actual
              AND estado_cierre = 'abierto';
            
            GET DIAGNOSTICS v_count = ROW_COUNT;
            v_pedidos_cerrados := v_pedidos_cerrados + v_count;
        END IF;
        
        -- También cerrar pedidos de días anteriores que quedaron abiertos
        UPDATE pedidos
        SET estado_cierre = 'cerrado',
            hora_cierre = v_now_ba,
            updated_at = NOW()
        WHERE fecha_entrega_estimada < v_fecha_actual
          AND estado_cierre = 'abierto';
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_pedidos_cerrados := v_pedidos_cerrados + v_count;
        
        RETURN v_pedidos_cerrados;
    */
    
    -- TEMPORAL: Retornar 0 sin hacer cambios
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_cerrar_pedidos_por_horario() IS 
'TEMPORAL: Función desactivada completamente. No cierra pedidos automáticamente por horario. Para reactivar, restaurar código comentado.';

COMMIT;

-- ===========================================
-- NOTAS DE REVERSIÓN
-- ===========================================
-- Para reactivar la funcionalidad normal:
-- 1. Restaurar la lógica original en fn_crear_presupuesto_desde_bot() (líneas 60-62 y 70-76)
-- 2. Restaurar la lógica original en fn_convertir_presupuesto_a_pedido() (líneas 507-509)
-- 3. Descomentar y restaurar el código en fn_cerrar_pedidos_por_horario()
-- 
-- O simplemente revertir esta migración ejecutando las migraciones anteriores.

