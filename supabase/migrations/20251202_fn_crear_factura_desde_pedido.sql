-- ===========================================
-- MIGRACIÓN: fn_crear_factura_desde_pedido
-- Fecha: 02/12/2025
-- Objetivo:
--   Crear función RPC para generar una factura interna
--   a partir de un pedido existente.
-- ===========================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_crear_factura_desde_pedido(
    p_pedido_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_factura_id UUID;
    v_numero_factura VARCHAR(50);
    v_subtotal DECIMAL(10,2);
    v_descuento DECIMAL(10,2);
    v_total DECIMAL(10,2);
    v_existente UUID;
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

    -- Verificar que no exista ya una factura para este pedido
    SELECT id
    INTO v_existente
    FROM facturas
    WHERE pedido_id = p_pedido_id
    LIMIT 1;

    IF v_existente IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success',
            true,
            'factura_id',
            v_existente,
            'warning',
            'El pedido ya tiene una factura creada'
        );
    END IF;

    -- Determinar totales desde el pedido
    v_subtotal := COALESCE(v_pedido.subtotal, 0);
    v_descuento := COALESCE(v_pedido.descuento, 0);
    v_total := COALESCE(v_pedido.total, 0);

    -- Generar número de factura interno
    v_numero_factura :=
        'FAC-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear factura
    INSERT INTO facturas (
        numero_factura,
        cliente_id,
        pedido_id,
        fecha_emision,
        subtotal,
        descuento,
        total,
        estado,
        tipo
    )
    VALUES (
        v_numero_factura,
        v_pedido.cliente_id,
        v_pedido.id,
        NOW(),
        v_subtotal,
        v_descuento,
        v_total,
        'emitida',
        'interna'
    )
    RETURNING id INTO v_factura_id;

    -- Crear items de factura a partir de detalles_pedido
    INSERT INTO factura_items (
        factura_id,
        producto_id,
        cantidad,
        precio_unitario,
        subtotal
    )
    SELECT
        v_factura_id,
        dp.producto_id,
        dp.cantidad,
        dp.precio_unitario,
        dp.subtotal
    FROM detalles_pedido dp
    WHERE dp.pedido_id = v_pedido.id;

    RETURN jsonb_build_object(
        'success',
        true,
        'factura_id',
        v_factura_id,
        'numero_factura',
        v_numero_factura
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success',
            false,
            'error',
            'Error al crear factura desde pedido: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_crear_factura_desde_pedido(UUID, UUID) IS
'Crea una factura interna y sus items a partir de un pedido existente.';

COMMIT;


