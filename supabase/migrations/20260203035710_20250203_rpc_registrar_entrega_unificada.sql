-- ============================================
-- Migración: RPC Unificada de Registro de Entrega
-- Fecha: 2025-02-03
-- Descripción:
--   Crea fn_registrar_entrega_completa que centraliza toda la lógica
--   de registro de entrega que estaba duplicada en la API route
-- ============================================

BEGIN;

-- ============================================
-- FUNCIÓN: fn_registrar_entrega_completa
-- Centraliza toda la lógica de registro de entrega
-- NOTA: Los parámetros con default van al final
-- ============================================

CREATE OR REPLACE FUNCTION fn_registrar_entrega_completa(
    p_pedido_id UUID,
    p_repartidor_id UUID,
    p_entrega_id UUID DEFAULT NULL,
    p_facturas_pagadas UUID[] DEFAULT NULL,
    p_estado_entrega VARCHAR DEFAULT 'entregado',
    p_metodo_pago VARCHAR DEFAULT NULL,
    p_monto_cobrado DECIMAL DEFAULT 0,
    p_monto_cuenta_corriente DECIMAL DEFAULT 0,
    p_es_cuenta_corriente BOOLEAN DEFAULT FALSE,
    p_es_pago_parcial BOOLEAN DEFAULT FALSE,
    p_motivo_rechazo TEXT DEFAULT NULL,
    p_notas_entrega TEXT DEFAULT NULL,
    p_comprobante_url VARCHAR DEFAULT NULL,
    p_numero_transaccion VARCHAR DEFAULT NULL,
    p_firma_url VARCHAR DEFAULT NULL,
    p_qr_verificacion VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_detalle_ruta RECORD;
    v_entrega RECORD;
    v_cliente_id UUID;
    v_update_detalle JSONB;
    v_update_entrega JSONB;
    v_estado_factura VARCHAR;
    v_factura RECORD;
    v_factura_data RECORD;
    v_resultado JSONB;
    v_pago_registrado BOOLEAN;
    v_metodo_pago_registrado VARCHAR;
    v_monto_cobrado_registrado DECIMAL;
    v_notas_pago TEXT;
BEGIN
    -- 1. Obtener el detalle de ruta correspondiente
    SELECT * INTO v_detalle_ruta
    FROM detalles_ruta
    WHERE pedido_id = p_pedido_id
      AND estado_entrega NOT IN ('entregado', 'rechazado');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado en ruta activa o ya fue entregado/rechazado');
    END IF;

    -- 2. Determinar estado de pago y notas según los parámetros
    IF p_es_cuenta_corriente THEN
        -- Todo a cuenta corriente - marcar como registrado (a crédito)
        v_pago_registrado := TRUE;
        v_metodo_pago_registrado := 'cuenta_corriente';
        v_monto_cobrado_registrado := 0;
        v_notas_pago := COALESCE(p_notas_entrega, 'Cargado a cuenta corriente');
        v_estado_factura := 'pendiente';

    ELSIF p_motivo_rechazo IS NOT NULL THEN
        -- Pedido rechazado
        v_pago_registrado := TRUE;
        v_metodo_pago_registrado := NULL;
        v_monto_cobrado_registrado := 0;
        v_notas_pago := 'Rechazado: ' || p_motivo_rechazo || '. ' || COALESCE(p_notas_entrega, '');
        v_estado_factura := 'anulada';

    ELSIF p_es_pago_parcial AND p_monto_cobrado > 0 THEN
        -- Pago parcial
        v_pago_registrado := TRUE;
        v_metodo_pago_registrado := COALESCE(p_metodo_pago, 'efectivo');
        v_monto_cobrado_registrado := p_monto_cobrado;
        v_notas_pago := 'Pago parcial. ' || COALESCE(p_notas_entrega, '');
        v_estado_factura := 'parcial';

    ELSIF p_monto_cobrado > 0 THEN
        -- Ya pagó - registrar monto y método
        v_pago_registrado := TRUE;
        v_metodo_pago_registrado := COALESCE(p_metodo_pago, 'efectivo');
        v_monto_cobrado_registrado := p_monto_cobrado;
        v_notas_pago := p_notas_entrega;
        v_estado_factura := 'pagada';

    ELSIF p_metodo_pago IS NOT NULL AND p_monto_cobrado = 0 THEN
        -- Pendiente de pago - registrar método futuro pero sin monto
        v_pago_registrado := FALSE;
        v_metodo_pago_registrado := p_metodo_pago;
        v_monto_cobrado_registrado := NULL;
        v_notas_pago := COALESCE(p_notas_entrega, 'Pendiente de pago');
        v_estado_factura := 'pendiente';

    ELSE
        -- Pagará después - solo registrar notas
        v_pago_registrado := FALSE;
        v_metodo_pago_registrado := NULL;
        v_monto_cobrado_registrado := NULL;
        v_notas_pago := COALESCE(p_notas_entrega, 'Pagará después');
        v_estado_factura := 'pendiente';
    END IF;

    -- 3. Actualizar detalles_ruta
    UPDATE detalles_ruta
    SET
        pago_registrado = v_pago_registrado,
        metodo_pago_registrado = v_metodo_pago_registrado,
        monto_cobrado_registrado = v_monto_cobrado_registrado,
        numero_transaccion_registrado = p_numero_transaccion,
        comprobante_url_registrado = p_comprobante_url,
        notas_pago = v_notas_pago,
        notas_entrega = p_notas_entrega,
        estado_entrega = CASE
            WHEN p_motivo_rechazo IS NOT NULL THEN 'rechazado'
            ELSE COALESCE(p_estado_entrega, 'entregado')
        END,
        updated_at = NOW()
    WHERE id = v_detalle_ruta.id;

    -- 4. Si es una entrega individual (pedido agrupado), actualizar tabla entregas
    IF p_entrega_id IS NOT NULL THEN
        -- Obtener datos de la entrega
        SELECT * INTO v_entrega
        FROM entregas
        WHERE id = p_entrega_id;

        IF FOUND THEN
            v_cliente_id := v_entrega.cliente_id;

            -- Actualizar entrega
            UPDATE entregas
            SET
                estado_pago = CASE
                    WHEN p_motivo_rechazo IS NOT NULL THEN 'rechazado'
                    WHEN p_es_cuenta_corriente THEN 'cuenta_corriente'
                    WHEN p_es_pago_parcial THEN 'parcial'
                    WHEN p_monto_cobrado > 0 THEN 'pagado'
                    WHEN p_metodo_pago IS NOT NULL THEN 'pendiente'
                    ELSE 'pendiente'
                END,
                estado_entrega = CASE
                    WHEN p_motivo_rechazo IS NOT NULL THEN 'rechazado'
                    ELSE COALESCE(p_estado_entrega, 'entregado')
                END,
                metodo_pago = CASE
                    WHEN p_es_cuenta_corriente THEN 'cuenta_corriente'
                    WHEN p_monto_cobrado > 0 THEN COALESCE(p_metodo_pago, 'efectivo')
                    ELSE p_metodo_pago
                END,
                monto_cobrado = p_monto_cobrado,
                numero_transaccion = p_numero_transaccion,
                comprobante_url = p_comprobante_url,
                notas_pago = v_notas_pago,
                updated_at = NOW()
            WHERE id = p_entrega_id;

            -- 5. Si hay monto a cuenta corriente, registrar en la cuenta del cliente
            IF p_monto_cuenta_corriente > 0 THEN
                INSERT INTO movimientos_cuenta_corriente (
                    cliente_id,
                    tipo,
                    monto,
                    descripcion,
                    referencia_tipo,
                    referencia_id
                ) VALUES (
                    v_cliente_id,
                    'cargo',
                    p_monto_cuenta_corriente,
                    'Pedido ' || SUBSTRING(p_pedido_id::TEXT, 1, 8) || ' - Cargado a cuenta',
                    'entrega',
                    p_entrega_id
                );
            END IF;

            -- 6. Actualizar estado de la factura según el pago
            SELECT * INTO v_factura
            FROM facturas
            WHERE entrega_id = p_entrega_id;

            IF FOUND THEN
                UPDATE facturas
                SET
                    estado = v_estado_factura,
                    updated_at = NOW()
                WHERE id = v_factura.id;
            END IF;
        END IF;

        -- 7. Procesar facturas adicionales (deuda anterior) si se proporcionaron
        IF p_facturas_pagadas IS NOT NULL AND array_length(p_facturas_pagadas, 1) > 0 THEN
            FOR v_factura_data IN
                SELECT f.id, f.saldo_pendiente, f.cliente_id
                FROM facturas f
                WHERE f.id = ANY(p_facturas_pagadas)
            LOOP
                -- Registrar pago usando la RPC existente
                PERFORM fn_registrar_pago_cuenta_corriente(
                    v_factura_data.cliente_id,
                    v_factura_data.saldo_pendiente,
                    COALESCE(p_metodo_pago, 'efectivo'),
                    'Pago factura ' || SUBSTRING(v_factura_data.id::TEXT, 1, 8) || ' vía reparto',
                    p_repartidor_id,
                    v_factura_data.id
                );
            END LOOP;
        END IF;
    END IF;

    -- 8. Construir resultado
    v_resultado := jsonb_build_object(
        'success', true,
        'pedido_id', p_pedido_id,
        'detalle_ruta_id', v_detalle_ruta.id,
        'entrega_id', p_entrega_id,
        'estado_entrega', COALESCE(p_estado_entrega, 'entregado'),
        'pago_registrado', v_pago_registrado,
        'monto_cobrado', v_monto_cobrado_registrado,
        'metodo_pago', v_metodo_pago_registrado,
        'factura_estado', v_estado_factura
    );

    RETURN v_resultado;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al registrar entrega: ' || SQLERRM,
            'detalle', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_registrar_entrega_completa IS
'Registra una entrega completa actualizando detalles_ruta, entregas, facturas y cuenta corriente en una sola transacción atómica. Centraliza la lógica que antes estaba dispersa en la API route.';

COMMIT;;
