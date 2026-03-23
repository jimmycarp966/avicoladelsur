-- ===========================================
-- MIGRACIÓN: Optimización de Queries N+1
-- Fecha: 16/12/2025
-- Objetivo: Crear funciones RPC optimizadas para obtener cliente y pedido con todas sus relaciones
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_obtener_cliente_completo
-- Obtiene cliente con todas sus estadísticas y relaciones en una sola query
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_cliente_completo(
    p_cliente_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_cliente JSONB;
    v_estadisticas JSONB;
    v_cuenta_corriente JSONB;
    v_listas_precios JSONB;
BEGIN
    -- Obtener cliente con datos básicos
    SELECT row_to_json(c.*)::JSONB INTO v_cliente
    FROM clientes c
    WHERE c.id = p_cliente_id;

    IF v_cliente IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cliente no encontrado'
        );
    END IF;

    -- Calcular estadísticas de pedidos en una sola subquery
    SELECT jsonb_build_object(
        'total_pedidos', COUNT(*),
        'pedidos_entregados', COUNT(*) FILTER (WHERE estado = 'entregado'),
        'pedidos_pendientes', COUNT(*) FILTER (WHERE estado NOT IN ('entregado', 'cancelado')),
        'total_compras', COALESCE(SUM(total) FILTER (WHERE estado = 'entregado'), 0),
        'ultimo_pedido', MAX(fecha_pedido) FILTER (WHERE estado = 'entregado')
    ) INTO v_estadisticas
    FROM pedidos
    WHERE cliente_id = p_cliente_id;

    -- Obtener cuenta corriente
    SELECT jsonb_build_object(
        'saldo', COALESCE(saldo, 0),
        'limite_credito', COALESCE(limite_credito, 0)
    ) INTO v_cuenta_corriente
    FROM cuentas_corrientes
    WHERE cliente_id = p_cliente_id;

    -- Si no existe cuenta corriente, usar valores del cliente
    IF v_cuenta_corriente IS NULL THEN
        SELECT jsonb_build_object(
            'saldo', 0,
            'limite_credito', COALESCE((v_cliente->>'limite_credito')::numeric, 0)
        ) INTO v_cuenta_corriente;
    END IF;

    -- Obtener listas de precios activas con vigencia
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', clp.id,
            'prioridad', clp.prioridad,
            'activa', clp.activa,
            'lista_precio', jsonb_build_object(
                'id', lp.id,
                'nombre', lp.nombre,
                'tipo', lp.tipo,
                'activa', lp.activa,
                'vigencia_activa', lp.vigencia_activa,
                'fecha_vigencia_desde', lp.fecha_vigencia_desde,
                'fecha_vigencia_hasta', lp.fecha_vigencia_hasta
            )
        )
        ORDER BY clp.prioridad ASC
    ), '[]'::JSONB) INTO v_listas_precios
    FROM clientes_listas_precios clp
    JOIN listas_precios lp ON lp.id = clp.lista_precio_id
    WHERE clp.cliente_id = p_cliente_id
        AND clp.activa = true
        AND lp.activa = true
        AND (
            lp.vigencia_activa = false
            OR (
                (lp.fecha_vigencia_desde IS NULL OR lp.fecha_vigencia_desde <= CURRENT_DATE)
                AND (lp.fecha_vigencia_hasta IS NULL OR lp.fecha_vigencia_hasta >= CURRENT_DATE)
            )
        );

    -- Construir resultado final
    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'cliente', v_cliente,
            'estadisticas', v_estadisticas,
            'cuenta_corriente', v_cuenta_corriente,
            'listas_precios', v_listas_precios
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_obtener_pedido_completo
-- Obtiene pedido con pagos y cuenta corriente en una sola query
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
BEGIN
    -- Obtener pedido con cliente y detalles
    SELECT jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        'cliente_id', p.cliente_id,
        'cliente', jsonb_build_object(
            'id', c.id,
            'nombre', c.nombre,
            'telefono', c.telefono,
            'direccion', c.direccion
        ),
        'estado', p.estado,
        'total', p.total,
        'fecha_pedido', p.fecha_pedido,
        'fecha_entrega_estimada', p.fecha_entrega_estimada,
        'detalles', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', dp.id,
                    'cantidad', dp.cantidad,
                    'precio_unitario', dp.precio_unitario,
                    'subtotal', dp.subtotal,
                    'producto', jsonb_build_object(
                        'id', pr.id,
                        'nombre', pr.nombre,
                        'codigo', pr.codigo
                    )
                )
            ), '[]'::JSONB)
            FROM detalles_pedido dp
            JOIN productos pr ON pr.id = dp.producto_id
            WHERE dp.pedido_id = p.id
        )
    ) INTO v_pedido
    FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
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
            'caja', jsonb_build_object(
                'nombre', tc.nombre
            )
        )
        ORDER BY tm.created_at DESC
    ), '[]'::JSONB) INTO v_pagos
    FROM tesoreria_movimientos tm
    LEFT JOIN tesoreria_cajas tc ON tc.id = tm.caja_id
    WHERE tm.origen_tipo = 'pedido'
        AND tm.origen_id = p_pedido_id;

    -- Obtener cuenta corriente del cliente
    SELECT jsonb_build_object(
        'id', cc.id,
        'saldo', COALESCE(cc.saldo, 0),
        'limite_credito', COALESCE(cc.limite_credito, 0)
    ) INTO v_cuenta
    FROM cuentas_corrientes cc
    WHERE cc.cliente_id = (v_pedido->>'cliente_id')::UUID;

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

COMMIT;

