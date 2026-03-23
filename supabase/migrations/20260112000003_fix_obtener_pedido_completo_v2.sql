-- ===========================================
-- MIGRACIÓN: Fix fn_obtener_pedido_completo v2
-- Fecha: 12/01/2026
-- Objetivo: 
-- 1. Usar LEFT JOIN para clientes (soporte pedidos agrupados sans ID).
-- 2. Renombrar key 'cliente' -> 'clientes' para mach de frontend.
-- 3. Agregar 'zonas' y 'zona_entrega'.
-- 4. Mantener fixes de items (producto_id, peso_final).
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
    -- Obtener pedido con cliente, zona y detalles
    SELECT jsonb_build_object(
        'id', p.id,
        'numero_pedido', p.numero_pedido,
        'cliente_id', p.cliente_id,
        'clientes', CASE WHEN c.id IS NOT NULL THEN jsonb_build_object(
            'id', c.id,
            'nombre', c.nombre,
            'telefono', c.telefono,
            'direccion', c.direccion,
            'zona_entrega', c.zona_entrega
        ) ELSE NULL END, -- Key plural para coincidir con frontend
        'zonas', CASE WHEN z.id IS NOT NULL THEN jsonb_build_object(
            'id', z.id,
            'nombre', z.nombre
        ) ELSE NULL END,
        'estado', p.estado,
        'total', p.total,
        'fecha_pedido', p.fecha_pedido,
        'fecha_entrega_estimada', p.fecha_entrega_estimada,
        'observaciones', p.observaciones,
        'turno', p.turno, 
        'detalles_pedido', ( -- Renombrado de 'detalles' a 'detalles_pedido' para match posible (verify)
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', dp.id,
                    'producto_id', dp.producto_id,
                    'cantidad', dp.cantidad,
                    'peso_final', dp.peso_final,
                    'precio_unitario', dp.precio_unitario,
                    'subtotal', dp.subtotal,
                    'productos', jsonb_build_object( -- Key plural productos
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

    -- Obtener cuenta corriente del cliente (si existe cliente)
    IF (v_pedido->>'cliente_id') IS NOT NULL THEN
        SELECT jsonb_build_object(
            'id', cc.id,
            'saldo', COALESCE(cc.saldo, 0),
            'limite_credito', COALESCE(cc.limite_credito, 0)
        ) INTO v_cuenta
        FROM cuentas_corrientes cc
        WHERE cc.cliente_id = (v_pedido->>'cliente_id')::UUID;
    ELSE
        v_cuenta := NULL;
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
