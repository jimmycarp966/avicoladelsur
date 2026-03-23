-- ===========================================
-- MIGRACIÓN: Fix pedidos agrupados y estado en asignación a ruta
-- Fecha: 05/12/2025
-- Problemas corregidos:
-- 1. fn_obtener_pedido_completo fallaba con pedidos sin cliente_id (agrupados)
-- 2. fn_asignar_pedido_a_ruta no cambiaba el estado del pedido a 'enviado'
-- ===========================================

BEGIN;

-- ===========================================
-- FIX 1: fn_obtener_pedido_completo con LEFT JOIN para soportar pedidos agrupados
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_pedido_completo(
    p_pedido_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_pedido JSONB;
    v_pagos JSONB;
    v_cuenta JSONB;
    v_cliente_id UUID;
BEGIN
    -- Obtener pedido con cliente y detalles (LEFT JOIN para soportar cliente NULL)
    SELECT jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        'cliente_id', p.cliente_id,
        'estado', p.estado,
        'estado_cierre', p.estado_cierre,
        'total', p.total,
        'subtotal', p.subtotal,
        'descuento', p.descuento,
        'fecha_pedido', p.fecha_pedido,
        'fecha_entrega_estimada', p.fecha_entrega_estimada,
        'fecha_entrega_real', p.fecha_entrega_real,
        'turno', p.turno,
        'zona_id', p.zona_id,
        'observaciones', p.observaciones,
        'pago_estado', p.pago_estado,
        'clientes', CASE 
            WHEN c.id IS NOT NULL THEN jsonb_build_object(
                'id', c.id,
                'nombre', c.nombre,
                'telefono', c.telefono,
                'direccion', c.direccion,
                'zona_entrega', c.zona_entrega
            )
            ELSE NULL
        END,
        'zonas', CASE 
            WHEN z.id IS NOT NULL THEN jsonb_build_object(
                'id', z.id,
                'nombre', z.nombre
            )
            ELSE NULL
        END,
        'detalles_pedido', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', dp.id,
                    'cantidad', dp.cantidad,
                    'precio_unitario', dp.precio_unitario,
                    'subtotal', dp.subtotal,
                    'peso_final', dp.peso_final,
                    'productos', jsonb_build_object(
                        'id', pr.id,
                        'nombre', pr.nombre,
                        'codigo', pr.codigo
                    )
                )
            ), '[]'::JSONB)
            FROM detalles_pedido dp
            JOIN productos pr ON pr.id = dp.producto_id
            WHERE dp.pedido_id = p.id
        ),
        'cantidad_entregas', (
            SELECT COUNT(*)::INT
            FROM entregas_pedido ep
            WHERE ep.pedido_id = p.id
        )
    ),
    p.cliente_id
    INTO v_pedido, v_cliente_id
    FROM pedidos p
    LEFT JOIN clientes c ON c.id = p.cliente_id
    LEFT JOIN zonas z ON z.id = p.zona_id
    WHERE p.id = p_pedido_id;

    IF v_pedido IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pedido no encontrado'
        );
    END IF;

    -- Obtener pagos relacionados
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', tm.id,
            'tipo', tm.tipo,
            'monto', tm.monto,
            'metodo_pago', tm.metodo_pago,
            'created_at', tm.created_at,
            'tesoreria_cajas', jsonb_build_object(
                'nombre', tc.nombre
            )
        )
        ORDER BY tm.created_at DESC
    ), '[]'::JSONB) INTO v_pagos
    FROM tesoreria_movimientos tm
    LEFT JOIN tesoreria_cajas tc ON tc.id = tm.caja_id
    WHERE tm.origen_tipo = 'pedido'
        AND tm.origen_id = p_pedido_id;

    -- Obtener cuenta corriente del cliente (solo si tiene cliente)
    IF v_cliente_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'id', cc.id,
            'saldo', COALESCE(cc.saldo, 0),
            'limite_credito', COALESCE(cc.limite_credito, 0)
        ) INTO v_cuenta
        FROM cuentas_corrientes cc
        WHERE cc.cliente_id = v_cliente_id;
    END IF;

    -- Construir resultado final
    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'pedido', v_pedido,
            'pagos', v_pagos,
            'cuenta', v_cuenta
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FIX 2: fn_asignar_pedido_a_ruta debe cambiar estado a 'enviado'
-- ===========================================

CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta(
    p_pedido_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_plan RECORD;
    v_dia_semana SMALLINT;
    v_ruta RECORD;
    v_ruta_id UUID;
    v_numero_ruta TEXT;
    v_peso_pedido NUMERIC(12,3) := 0;
    v_peso_actual NUMERIC(12,3) := 0;
    v_capacidad_max NUMERIC(12,3);
    v_repartidor_id UUID;
    v_vehiculo RECORD;
    v_detalle_id UUID;
BEGIN
    SELECT
        p.id,
        COALESCE(p.fecha_entrega_estimada::DATE, fn_today_argentina()) AS fecha_ruta,
        COALESCE(p.turno, 'mañana') AS turno,
        p.zona_id,
        p.estado
    INTO v_pedido
    FROM pedidos p
    WHERE p.id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
    END IF;

    -- Validar que el pedido esté en estado 'preparando'
    IF v_pedido.estado != 'preparando' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden enviar a ruta pedidos en estado preparando');
    END IF;

    IF v_pedido.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El pedido no tiene zona asignada');
    END IF;

    v_dia_semana := EXTRACT(DOW FROM v_pedido.fecha_ruta)::SMALLINT;

    SELECT
        prs.id,
        prs.repartidor_id
    INTO v_plan
    FROM plan_rutas_semanal prs
    WHERE prs.zona_id = v_pedido.zona_id
      AND prs.turno = v_pedido.turno
      AND prs.dia_semana = v_dia_semana
      AND prs.activo = true
    ORDER BY prs.created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay ruta planificada para la zona/turno/día seleccionado');
    END IF;

    v_repartidor_id := v_plan.repartidor_id;

    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_pedido
    FROM detalles_pedido dp
    WHERE dp.pedido_id = p_pedido_id;

    SELECT
        rr.id,
        rr.vehiculo_id,
        veh.capacidad_kg AS veh_capacidad
    INTO v_ruta
    FROM rutas_reparto rr
    LEFT JOIN vehiculos veh ON veh.id = rr.vehiculo_id
    WHERE rr.fecha_ruta = v_pedido.fecha_ruta
      AND rr.plan_ruta_id = v_plan.id
    ORDER BY rr.created_at ASC
    LIMIT 1;

    IF v_ruta.id IS NULL THEN
        SELECT v.id, v.capacidad_kg
        INTO v_vehiculo
        FROM vehiculos v
        WHERE v.activo = true
          AND v.capacidad_kg IS NOT NULL
          AND v.capacidad_kg >= GREATEST(v_peso_pedido, 0)
        ORDER BY v.capacidad_kg ASC
        LIMIT 1;

        IF v_vehiculo.id IS NULL THEN
            SELECT v.id, v.capacidad_kg
            INTO v_vehiculo
            FROM vehiculos v
            WHERE v.activo = true
            ORDER BY v.capacidad_kg DESC NULLS LAST
            LIMIT 1;
        END IF;

        IF v_vehiculo.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No hay vehículos activos disponibles');
        END IF;

        IF v_repartidor_id IS NULL THEN
            SELECT u.id
            INTO v_repartidor_id
            FROM usuarios u
            WHERE u.rol = 'repartidor'
              AND u.activo = true
            ORDER BY u.created_at ASC
            LIMIT 1;
        END IF;

        IF v_repartidor_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No hay repartidores activos disponibles');
        END IF;

        -- Generar número de ruta secuencial
        v_numero_ruta := fn_obtener_siguiente_numero('ruta');

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
            v_numero_ruta,
            v_vehiculo.id,
            v_repartidor_id,
            v_pedido.fecha_ruta,
            'planificada',
            v_pedido.turno,
            v_pedido.zona_id,
            v_plan.id
        )
        RETURNING id INTO v_ruta_id;

        v_capacidad_max := v_vehiculo.capacidad_kg;
    ELSE
        v_ruta_id := v_ruta.id;
        v_capacidad_max := v_ruta.veh_capacidad;
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

    IF v_capacidad_max IS NOT NULL
       AND v_capacidad_max > 0
       AND v_peso_actual + v_peso_pedido > v_capacidad_max THEN
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
            COALESCE(
                (SELECT MAX(orden_entrega) + 1 FROM detalles_ruta WHERE ruta_id = v_ruta_id),
                1
            )
        )
        RETURNING id INTO v_detalle_id;
    END IF;

    -- *** FIX: Actualizar estado del pedido a 'enviado' ***
    UPDATE pedidos
    SET estado = 'enviado',
        updated_at = NOW()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object(
        'success', true,
        'ruta_id', v_ruta_id,
        'detalle_ruta_id', v_detalle_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

