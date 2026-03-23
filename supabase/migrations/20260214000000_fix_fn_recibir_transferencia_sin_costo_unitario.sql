-- Fix: fn_recibir_transferencia must not insert lotes.costo_unitario
-- because the column was removed in 20251222_sistema_produccion_desposte.sql.

CREATE OR REPLACE FUNCTION fn_recibir_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID,
    p_items_recibidos JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_transferencia RECORD;
    v_item RECORD;
    v_lote_destino_id UUID;
    v_lote_origen RECORD;
    v_cantidad_a_recibir DECIMAL(10,3);
    v_recibido JSONB;
BEGIN
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;

    IF v_transferencia.estado NOT IN ('entregado', 'en_ruta', 'en_transito', 'preparado') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no esta en estado para recibir');
    END IF;

    IF p_items_recibidos IS NOT NULL THEN
        FOR v_recibido IN SELECT * FROM jsonb_array_elements(p_items_recibidos)
        LOOP
            UPDATE transferencia_items
            SET cantidad_recibida = (v_recibido->>'cantidad_recibida')::DECIMAL
            WHERE id = (v_recibido->>'item_id')::UUID
              AND transferencia_id = p_transferencia_id;
        END LOOP;
    END IF;

    FOR v_item IN
        SELECT * FROM transferencia_items WHERE transferencia_id = p_transferencia_id
    LOOP
        v_cantidad_a_recibir := COALESCE(v_item.cantidad_recibida, v_item.cantidad_enviada, v_item.cantidad_solicitada);

        IF v_item.cantidad_recibida IS NULL THEN
            UPDATE transferencia_items
            SET cantidad_recibida = v_cantidad_a_recibir
            WHERE id = v_item.id;
        END IF;

        SELECT * INTO v_lote_origen
        FROM lotes
        WHERE id = v_item.lote_origen_id;

        INSERT INTO lotes (
            producto_id,
            sucursal_id,
            cantidad_ingresada,
            cantidad_disponible,
            fecha_ingreso,
            fecha_vencimiento,
            proveedor,
            estado,
            numero_lote
        ) VALUES (
            v_item.producto_id,
            v_transferencia.sucursal_destino_id,
            v_cantidad_a_recibir,
            v_cantidad_a_recibir,
            NOW(),
            v_lote_origen.fecha_vencimiento,
            COALESCE(v_lote_origen.proveedor, 'Transferencia'),
            'disponible',
            'TRANS-' || COALESCE(v_lote_origen.numero_lote, v_transferencia.numero_transferencia)
        ) RETURNING id INTO v_lote_destino_id;

        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_lote_destino_id,
            'ingreso',
            v_cantidad_a_recibir,
            'Transferencia recibida: ' || v_transferencia.numero_transferencia,
            p_user_id
        );

        UPDATE transferencia_items
        SET lote_destino_id = v_lote_destino_id
        WHERE id = v_item.id;
    END LOOP;

    UPDATE transferencias_stock
    SET estado = 'recibido',
        fecha_recepcion = NOW(),
        recibido_por = p_user_id,
        updated_at = NOW()
    WHERE id = p_transferencia_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Transferencia recibida exitosamente'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_recibir_transferencia IS
'Sucursal destino confirma recepcion y crea lotes (sin costo_unitario en lotes)';
