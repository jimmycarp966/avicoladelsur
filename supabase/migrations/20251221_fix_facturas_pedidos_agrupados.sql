-- ===========================================
-- MIGRACIÓN: Fix facturas para pedidos agrupados
-- Fecha: 21/12/2025
-- Descripción: Modificar fn_crear_factura_desde_pedido para soportar
--              pedidos agrupados que no tienen cliente_id directo.
--              Para pedidos agrupados, crear una factura por cada entrega/presupuesto.
-- ===========================================

BEGIN;

-- Agregar campo entrega_id y presupuesto_id a facturas para trazabilidad
ALTER TABLE facturas 
ADD COLUMN IF NOT EXISTS entrega_id UUID REFERENCES entregas(id),
ADD COLUMN IF NOT EXISTS presupuesto_id UUID REFERENCES presupuestos(id);

COMMENT ON COLUMN facturas.entrega_id IS 'ID de la entrega individual (para pedidos agrupados)';
COMMENT ON COLUMN facturas.presupuesto_id IS 'ID del presupuesto original';

-- Recrear función para soportar pedidos agrupados
CREATE OR REPLACE FUNCTION fn_crear_factura_desde_pedido(
    p_pedido_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_factura_id UUID;
    v_numero_factura VARCHAR(50);
    v_subtotal DECIMAL(10,2);
    v_descuento DECIMAL(10,2);
    v_total DECIMAL(10,2);
    v_existente UUID;
    v_entrega RECORD;
    v_presupuesto RECORD;
    v_facturas_creadas INT := 0;
    v_errores TEXT[] := ARRAY[]::TEXT[];
    v_resultado JSONB;
BEGIN
    IF p_pedido_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido inválido');
    END IF;

    -- Verificar que el pedido exista
    SELECT *
    INTO v_pedido
    FROM pedidos
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
    END IF;

    -- CASO 1: Pedido individual (tiene cliente_id)
    IF v_pedido.cliente_id IS NOT NULL THEN
        -- Verificar que no exista ya una factura para este pedido
        SELECT id INTO v_existente
        FROM facturas
        WHERE pedido_id = p_pedido_id AND cliente_id = v_pedido.cliente_id
        LIMIT 1;

        IF v_existente IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'factura_id', v_existente,
                'warning', 'El pedido ya tiene una factura creada'
            );
        END IF;

        -- Determinar totales desde el pedido
        v_subtotal := COALESCE(v_pedido.subtotal, 0);
        v_descuento := COALESCE(v_pedido.descuento, 0);
        v_total := COALESCE(v_pedido.total, 0);

        -- Generar número de factura secuencial
        v_numero_factura := fn_obtener_siguiente_numero('factura');

        -- Crear factura
        INSERT INTO facturas (
            numero_factura, cliente_id, pedido_id, fecha_emision,
            subtotal, descuento, total, estado, tipo
        ) VALUES (
            v_numero_factura, v_pedido.cliente_id, v_pedido.id, NOW(),
            v_subtotal, v_descuento, v_total, 'emitida', 'interna'
        ) RETURNING id INTO v_factura_id;

        -- Crear items de factura a partir de detalles_pedido
        INSERT INTO factura_items (factura_id, producto_id, cantidad, precio_unitario, subtotal)
        SELECT v_factura_id, dp.producto_id, dp.cantidad, dp.precio_unitario, dp.subtotal
        FROM detalles_pedido dp
        WHERE dp.pedido_id = v_pedido.id;

        RETURN jsonb_build_object(
            'success', true,
            'factura_id', v_factura_id,
            'numero_factura', v_numero_factura,
            'tipo', 'individual'
        );
    
    -- CASO 2: Pedido agrupado (no tiene cliente_id, usar entregas)
    ELSE
        -- Iterar por cada entrega del pedido
        FOR v_entrega IN 
            SELECT e.*, c.nombre as cliente_nombre
            FROM entregas e
            JOIN clientes c ON c.id = e.cliente_id
            WHERE e.pedido_id = p_pedido_id
        LOOP
            -- Verificar si ya existe factura para esta entrega
            SELECT id INTO v_existente
            FROM facturas
            WHERE entrega_id = v_entrega.id
            LIMIT 1;

            IF v_existente IS NOT NULL THEN
                -- Ya existe, continuar con la siguiente
                CONTINUE;
            END IF;

            -- Obtener datos del presupuesto original
            SELECT * INTO v_presupuesto
            FROM presupuestos
            WHERE id = v_entrega.presupuesto_id;

            IF NOT FOUND THEN
                v_errores := array_append(v_errores, 
                    format('Presupuesto no encontrado para entrega %s', v_entrega.id));
                CONTINUE;
            END IF;

            -- Calcular total desde el presupuesto
            v_total := COALESCE(v_presupuesto.total_final, v_presupuesto.total_estimado, 0);
            v_subtotal := v_total; -- Sin descuento por ahora
            v_descuento := 0;

            -- Generar número de factura
            v_numero_factura := fn_obtener_siguiente_numero('factura');

            -- Crear factura para esta entrega
            INSERT INTO facturas (
                numero_factura, cliente_id, pedido_id, entrega_id, presupuesto_id,
                fecha_emision, subtotal, descuento, total, estado, tipo
            ) VALUES (
                v_numero_factura, v_entrega.cliente_id, p_pedido_id, v_entrega.id, v_entrega.presupuesto_id,
                NOW(), v_subtotal, v_descuento, v_total, 'emitida', 'interna'
            ) RETURNING id INTO v_factura_id;

            -- Crear items de factura desde presupuesto_items
            INSERT INTO factura_items (factura_id, producto_id, cantidad, precio_unitario, subtotal)
            SELECT 
                v_factura_id, 
                pi.producto_id, 
                COALESCE(pi.peso_final, pi.cantidad_solicitada),
                COALESCE(pi.precio_unit_final, pi.precio_unit_est),
                COALESCE(pi.subtotal_final, pi.subtotal_est)
            FROM presupuesto_items pi
            WHERE pi.presupuesto_id = v_entrega.presupuesto_id;

            v_facturas_creadas := v_facturas_creadas + 1;
        END LOOP;

        -- Retornar resultado
        IF v_facturas_creadas > 0 THEN
            RETURN jsonb_build_object(
                'success', true,
                'facturas_creadas', v_facturas_creadas,
                'tipo', 'agrupado',
                'errores', CASE WHEN array_length(v_errores, 1) > 0 THEN to_jsonb(v_errores) ELSE NULL END
            );
        ELSIF array_length(v_errores, 1) > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'No se pudo crear ninguna factura',
                'detalles', to_jsonb(v_errores)
            );
        ELSE
            RETURN jsonb_build_object(
                'success', true,
                'warning', 'No hay entregas pendientes de facturar o ya tienen facturas'
            );
        END IF;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al crear factura desde pedido: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_crear_factura_desde_pedido IS 
'Crea factura(s) desde un pedido.
- Pedido individual: Crea 1 factura con cliente_id del pedido
- Pedido agrupado: Crea 1 factura por cada entrega usando datos del presupuesto';

COMMIT;
