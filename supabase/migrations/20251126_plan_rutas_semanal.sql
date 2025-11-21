-- ===========================================
-- PLAN DE RUTAS SEMANAL + VEHÍCULOS BASE
-- Fecha: 2025-11-26
-- ===========================================

-- Tabla de planificación semanal
CREATE TABLE IF NOT EXISTS plan_rutas_semanal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zona_id UUID NOT NULL REFERENCES zonas(id),
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    turno VARCHAR(20) NOT NULL CHECK (turno IN ('mañana', 'tarde')),
    vehiculo_id UUID NOT NULL REFERENCES vehiculos(id),
    repartidor_id UUID REFERENCES usuarios(id),
    max_peso_kg NUMERIC(10,2),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(zona_id, dia_semana, turno)
);

CREATE INDEX IF NOT EXISTS idx_plan_rutas_zona_turno
    ON plan_rutas_semanal(zona_id, dia_semana, turno);

ALTER TABLE plan_rutas_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_plan_rutas_full"
    ON plan_rutas_semanal FOR ALL
    USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "logistica_plan_rutas_read"
    ON plan_rutas_semanal FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

-- Relación con rutas reales
ALTER TABLE rutas_reparto
    ADD COLUMN IF NOT EXISTS plan_ruta_id UUID REFERENCES plan_rutas_semanal(id);

-- Vehículos base
INSERT INTO vehiculos (patente, marca, modelo, capacidad_kg, tipo_vehiculo, seguro_vigente, activo)
VALUES
    ('AA000FI', 'Fiat', 'Fiorino', 600, 'fiorino', true, true),
    ('BB000TH', 'Toyota', 'Hilux', 1500, 'pickup', true, true),
    ('CC000FF', 'Ford', 'F-4000', 4000, 'camion', true, true)
ON CONFLICT (patente) DO UPDATE SET
    marca = EXCLUDED.marca,
    modelo = EXCLUDED.modelo,
    capacidad_kg = EXCLUDED.capacidad_kg,
    tipo_vehiculo = EXCLUDED.tipo_vehiculo,
    seguro_vigente = true,
    activo = true,
    updated_at = NOW();

-- ===========================================
-- Actualizar función fn_asignar_pedido_a_ruta
-- ===========================================

CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta(
    p_pedido_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_ruta_id UUID;
    v_plan RECORD;
    v_dia_semana SMALLINT;
    v_capacidad_max NUMERIC(10,2);
    v_peso_pedido NUMERIC(10,2);
    v_peso_actual NUMERIC(10,2);
    v_detalle_id UUID;
BEGIN
    SELECT
        p.id,
        COALESCE(p.fecha_entrega_estimada::DATE, CURRENT_DATE) AS fecha_ruta,
        COALESCE(p.turno, 'mañana') AS turno,
        p.zona_id
    INTO v_pedido
    FROM pedidos p
    WHERE p.id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
    END IF;

    IF v_pedido.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El pedido no tiene zona asignada');
    END IF;

    v_dia_semana := EXTRACT(DOW FROM v_pedido.fecha_ruta)::SMALLINT;

    SELECT prs.*, veh.capacidad_kg AS veh_capacidad
    INTO v_plan
    FROM plan_rutas_semanal prs
    JOIN vehiculos veh ON veh.id = prs.vehiculo_id
    WHERE prs.zona_id = v_pedido.zona_id
      AND prs.turno = v_pedido.turno
      AND prs.dia_semana = v_dia_semana
      AND prs.activo = true
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay ruta planificada para la zona/turno/día seleccionado');
    END IF;

    v_capacidad_max := COALESCE(v_plan.max_peso_kg, v_plan.veh_capacidad);

    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_pedido
    FROM detalles_pedido dp
    WHERE dp.pedido_id = p_pedido_id;

    IF v_peso_pedido <= 0 THEN
        v_peso_pedido := 0;
    END IF;

    SELECT id INTO v_ruta_id
    FROM rutas_reparto
    WHERE fecha_ruta = v_pedido.fecha_ruta
      AND plan_ruta_id = v_plan.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_ruta_id IS NULL THEN
        INSERT INTO rutas_reparto (
            numero_ruta,
            vehiculo_id,
            repartidor_id,
            fecha_ruta,
            estado,
            turno,
            zona_id,
            plan_ruta_id
        ) VALUES (
            'RUT-' || TO_CHAR(v_pedido.fecha_ruta, 'YYYYMMDD') || '-' ||
                UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)),
            v_plan.vehiculo_id,
            v_plan.repartidor_id,
            v_pedido.fecha_ruta,
            'planificada',
            v_pedido.turno,
            v_pedido.zona_id,
            v_plan.id
        )
        RETURNING id INTO v_ruta_id;
    END IF;

    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_actual
    FROM detalles_ruta dr
    JOIN detalles_pedido dp ON dp.pedido_id = dr.pedido_id
    WHERE dr.ruta_id = v_ruta_id;

    IF v_peso_actual + v_peso_pedido > v_capacidad_max THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La ruta planificada no tiene capacidad disponible para este pedido'
        );
    END IF;

    SELECT id INTO v_detalle_id
    FROM detalles_ruta
    WHERE pedido_id = p_pedido_id;

    IF v_detalle_id IS NULL THEN
        INSERT INTO detalles_ruta (
            ruta_id,
            pedido_id,
            orden_entrega
        ) VALUES (
            v_ruta_id,
            p_pedido_id,
            COALESCE(v_peso_actual::INT, 0) + 1
        )
        RETURNING id INTO v_detalle_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'ruta_id', v_ruta_id,
        'detalle_ruta_id', v_detalle_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Actualizar fn_convertir_presupuesto_a_pedido (sin llamada directa)
-- ===========================================

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
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
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

    IF v_presupuesto.turno IS NULL THEN
        v_turno := CASE
            WHEN EXTRACT(HOUR FROM v_now_ba) < 6 THEN 'mañana'
            ELSE 'tarde'
        END;

        UPDATE presupuestos
        SET turno = v_turno,
            updated_at = NOW()
        WHERE id = p_presupuesto_id;
    ELSE
        v_turno := v_presupuesto.turno;
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
        v_presupuesto.fecha_entrega_estimada,
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

    v_asign_result := fn_asignar_pedido_a_ruta(v_pedido_id);

    IF COALESCE((v_asign_result->>'success')::BOOLEAN, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', COALESCE(v_asign_result->>'error', 'No se pudo asignar el pedido a una ruta planificada');
    END IF;

    v_ruta_id := (v_asign_result->>'ruta_id')::UUID;

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total_con_recargo,
        'ruta_id', v_ruta_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

