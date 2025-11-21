-- ===========================================
-- AJUSTE: Horarios de corte y sistema de validación de cobros
-- Fecha: 2025-11-27
-- Descripción:
--   1. Cambiar horarios de corte automático:
--      - Si hora < 05:00 → turno mañana del mismo día
--      - Si hora >= 05:00 y < 15:00 → turno tarde del mismo día (por defecto)
--      - Si hora >= 15:00 → turno mañana del día siguiente (por defecto)
--   2. Agregar campos para tracking de pagos en detalles_ruta
--   3. Agregar campos para validación de rutas en rutas_reparto
-- ===========================================

-- 1. Modificar función de conversión de presupuesto a pedido con nuevos horarios
CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_item RECORD;
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_total_items DECIMAL(12,2) := 0;
    v_total_con_recargo DECIMAL(12,2) := 0;
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_cantidad_a_consumir DECIMAL(12,3);
    v_caja_movimiento_id UUID;
    v_cuenta_id UUID;
    v_referencia_pago VARCHAR(60);
    v_instruccion_repartidor TEXT;
    v_turno TEXT;
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_asign_result JSONB;
    v_ruta_id UUID;
BEGIN
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;

    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no está en un estado válido para facturar');
    END IF;

    IF v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto debe tener zona asignada antes de convertir');
    END IF;

    -- Determinar turno y fecha de entrega según nuevos horarios
    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);
    
    IF v_presupuesto.turno IS NULL THEN
        -- Lógica nueva de horarios de corte
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

        UPDATE presupuestos
        SET turno = v_turno,
            fecha_entrega_estimada = v_fecha_entrega,
            updated_at = NOW()
        WHERE id = p_presupuesto_id;
    ELSE
        v_turno := v_presupuesto.turno;
        v_fecha_entrega := COALESCE(v_presupuesto.fecha_entrega_estimada, DATE(v_now_ba));
    END IF;

    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true;

    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id
      AND pesable = true
      AND peso_final IS NOT NULL;

    IF v_presupuesto.estado = 'pendiente' AND v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este presupuesto tiene productos balanza que deben pesarse en almacén');
    END IF;

    SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
    INTO v_total_items
    FROM presupuesto_items
    WHERE presupuesto_id = p_presupuesto_id;

    v_total_con_recargo := v_total_items + COALESCE(v_presupuesto.recargo_total, 0);

    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    INSERT INTO pedidos (
        numero_pedido,
        cliente_id,
        usuario_vendedor,
        fecha_entrega_estimada,
        estado,
        tipo_pedido,
        origen,
        subtotal,
        total,
        total_final,
        observaciones,
        presupuesto_id,
        turno,
        zona_id,
        metodos_pago,
        recargo_total,
        pago_estado
    ) VALUES (
        v_numero_pedido,
        v_presupuesto.cliente_id,
        v_presupuesto.usuario_vendedor,
        v_fecha_entrega,
        'preparando',
        'venta',
        'presupuesto',
        v_total_items,
        v_total_con_recargo,
        v_total_con_recargo,
        v_presupuesto.observaciones,
        p_presupuesto_id,
        v_turno,
        v_presupuesto.zona_id,
        v_presupuesto.metodos_pago,
        COALESCE(v_presupuesto.recargo_total, 0),
        'pendiente'
    ) RETURNING id INTO v_pedido_id;

    FOR v_item IN
        SELECT *
        FROM presupuesto_items
        WHERE presupuesto_id = p_presupuesto_id
    LOOP
        v_cantidad_a_consumir := CASE
            WHEN v_item.pesable THEN COALESCE(v_item.peso_final, v_item.cantidad_solicitada)
            ELSE v_item.cantidad_solicitada
        END;

        INSERT INTO detalles_pedido (
            pedido_id,
            producto_id,
            lote_id,
            cantidad,
            precio_unitario,
            subtotal,
            peso_final,
            precio_unit_final
        ) VALUES (
            v_pedido_id,
            v_item.producto_id,
            v_item.lote_reservado_id,
            v_cantidad_a_consumir,
            COALESCE(v_item.precio_unit_final, v_item.precio_unit_est),
            COALESCE(v_item.subtotal_final, v_item.subtotal_est),
            CASE WHEN v_item.pesable THEN v_cantidad_a_consumir ELSE NULL END,
            v_item.precio_unit_final
        );

        IF v_item.lote_reservado_id IS NOT NULL THEN
            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_cantidad_a_consumir
            WHERE id = v_item.lote_reservado_id;

            INSERT INTO movimientos_stock (
                lote_id,
                tipo_movimiento,
                cantidad,
                motivo,
                usuario_id,
                pedido_id
            ) VALUES (
                v_item.lote_reservado_id,
                'salida',
                v_cantidad_a_consumir,
                'Conversión de presupuesto a pedido',
                p_user_id,
                v_pedido_id
            );
        END IF;
    END LOOP;

    UPDATE stock_reservations
    SET estado = 'consumida'
    WHERE presupuesto_id = p_presupuesto_id;

    UPDATE presupuestos
    SET estado = 'facturado',
        pedido_convertido_id = v_pedido_id,
        total_final = v_total_con_recargo,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    IF p_caja_id IS NULL THEN
        v_cuenta_id := fn_asegurar_cuenta_corriente(v_presupuesto.cliente_id);

        UPDATE cuentas_corrientes
        SET saldo = saldo + v_total_con_recargo,
            updated_at = NOW()
        WHERE id = v_cuenta_id;

        INSERT INTO cuentas_movimientos (
            cuenta_corriente_id,
            tipo,
            monto,
            descripcion,
            origen_tipo,
            origen_id
        ) VALUES (
            v_cuenta_id,
            'cargo',
            v_total_con_recargo,
            'Pedido ' || v_numero_pedido,
            'pedido',
            v_pedido_id
        );

        UPDATE clientes
        SET bloqueado_por_deuda = true
        WHERE id = v_presupuesto.cliente_id;

        v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        v_instruccion_repartidor := 'Cobrar al cliente: $' || v_total_con_recargo::TEXT || ' - Ref: ' || v_referencia_pago;

        UPDATE pedidos
        SET referencia_pago = v_referencia_pago,
            instruccion_repartidor = v_instruccion_repartidor
        WHERE id = v_pedido_id;
    END IF;

    IF p_caja_id IS NOT NULL THEN
        INSERT INTO tesoreria_movimientos (
            caja_id,
            tipo,
            monto,
            descripcion,
            origen_tipo,
            origen_id,
            user_id
        ) VALUES (
            p_caja_id,
            'ingreso',
            v_total_con_recargo,
            'Cobro por pedido ' || v_numero_pedido,
            'pedido',
            v_pedido_id,
            p_user_id
        )
        RETURNING id INTO v_caja_movimiento_id;

        UPDATE tesoreria_cajas
        SET saldo_actual = saldo_actual + v_total_con_recargo,
            updated_at = NOW()
        WHERE id = p_caja_id;

        UPDATE pedidos
        SET pago_estado = 'pagado',
            caja_movimiento_id = v_caja_movimiento_id
        WHERE id = v_pedido_id;
    END IF;

    PERFORM fn_asignar_pedido_a_ruta(v_pedido_id);

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total_con_recargo
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Agregar campos para tracking de pagos en detalles_ruta
ALTER TABLE detalles_ruta
ADD COLUMN IF NOT EXISTS pago_registrado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS metodo_pago_registrado VARCHAR(50),
ADD COLUMN IF NOT EXISTS monto_cobrado_registrado DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS numero_transaccion_registrado VARCHAR(100),
ADD COLUMN IF NOT EXISTS comprobante_url_registrado VARCHAR(500),
ADD COLUMN IF NOT EXISTS notas_pago TEXT,
ADD COLUMN IF NOT EXISTS pago_validado BOOLEAN DEFAULT false;

-- 3. Agregar campos para validación de rutas en rutas_reparto
ALTER TABLE rutas_reparto
ADD COLUMN IF NOT EXISTS recaudacion_total_registrada DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS recaudacion_total_validada DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS validada_por_tesorero BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tesorero_validador_id UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS fecha_validacion TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS observaciones_validacion TEXT;

-- 4. Crear función para actualizar recaudación total registrada
CREATE OR REPLACE FUNCTION fn_actualizar_recaudacion_ruta(p_ruta_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(monto_cobrado_registrado), 0)
    INTO v_total
    FROM detalles_ruta
    WHERE ruta_id = p_ruta_id
      AND pago_registrado = true
      AND monto_cobrado_registrado IS NOT NULL;

    UPDATE rutas_reparto
    SET recaudacion_total_registrada = v_total,
        updated_at = NOW()
    WHERE id = p_ruta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear trigger para actualizar recaudación automáticamente
CREATE OR REPLACE FUNCTION trigger_actualizar_recaudacion_ruta()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM fn_actualizar_recaudacion_ruta(COALESCE(NEW.ruta_id, OLD.ruta_id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_recaudacion_ruta ON detalles_ruta;
CREATE TRIGGER trg_actualizar_recaudacion_ruta
AFTER INSERT OR UPDATE OF monto_cobrado_registrado, pago_registrado ON detalles_ruta
FOR EACH ROW
EXECUTE FUNCTION trigger_actualizar_recaudacion_ruta();

-- Comentarios para documentación
COMMENT ON COLUMN detalles_ruta.pago_registrado IS 'Indica si el repartidor registró información de pago';
COMMENT ON COLUMN detalles_ruta.metodo_pago_registrado IS 'Método de pago registrado por el repartidor';
COMMENT ON COLUMN detalles_ruta.monto_cobrado_registrado IS 'Monto cobrado registrado por el repartidor';
COMMENT ON COLUMN detalles_ruta.pago_validado IS 'Indica si el tesorero validó este pago';
COMMENT ON COLUMN rutas_reparto.recaudacion_total_registrada IS 'Suma total de todos los cobros registrados por el repartidor';
COMMENT ON COLUMN rutas_reparto.recaudacion_total_validada IS 'Suma total validada por el tesorero';
COMMENT ON COLUMN rutas_reparto.validada_por_tesorero IS 'Indica si la ruta fue validada por un tesorero';

