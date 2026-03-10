-- ===========================================
-- MIGRACION: Fix flujo presupuesto -> pesaje -> pedido
-- Fecha: 2026-03-10
-- Objetivo:
--   1. Unificar la deteccion de items pesables con la misma logica del frontend.
--   2. Preservar el precio manual/estimado cuando pesaje no encuentra precio valido.
--   3. Evitar que la conversion a pedido pierda peso o importe por finales en cero.
-- ===========================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_es_item_pesable_contexto(
    p_nombre TEXT,
    p_categoria TEXT,
    p_requiere_pesaje BOOLEAN DEFAULT FALSE,
    p_item_pesable BOOLEAN DEFAULT FALSE,
    p_es_mayorista BOOLEAN DEFAULT FALSE,
    p_venta_mayor_habilitada BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN AS $$
BEGIN
    IF COALESCE(p_requiere_pesaje, false) THEN
        RETURN true;
    END IF;

    IF COALESCE(p_es_mayorista, false) AND COALESCE(p_venta_mayor_habilitada, false) THEN
        RETURN false;
    END IF;

    RETURN
        COALESCE(p_item_pesable, false)
        OR LOWER(TRIM(COALESCE(p_categoria, ''))) = 'balanza'
        OR COALESCE(p_nombre, '') ~* '(^|[^0-9])xkg';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_actualizar_peso_item_presupuesto(
    p_presupuesto_item_id UUID,
    p_peso_final DECIMAL(10,3)
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_es_mayorista BOOLEAN := false;
    v_es_pesable BOOLEAN := false;
    v_precio_unit_final DECIMAL(10,2) := 0;
    v_subtotal_final DECIMAL(10,2) := 0;
BEGIN
    SELECT
        pi.*,
        p.nombre AS producto_nombre,
        p.categoria AS producto_categoria,
        COALESCE(p.requiere_pesaje, false) AS producto_requiere_pesaje,
        COALESCE(p.venta_mayor_habilitada, false) AS venta_mayor_habilitada,
        p.precio_venta AS producto_precio_venta,
        lp.tipo AS lista_tipo_item
    INTO v_item
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp ON lp.id = pi.lista_precio_id
    WHERE pi.id = p_presupuesto_item_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item de presupuesto no encontrado');
    END IF;

    v_es_mayorista := COALESCE(v_item.lista_tipo_item, '') IN ('mayorista', 'distribuidor');
    v_es_pesable := fn_es_item_pesable_contexto(
        v_item.producto_nombre,
        v_item.producto_categoria,
        v_item.producto_requiere_pesaje,
        COALESCE(v_item.pesable, false),
        v_es_mayorista,
        v_item.venta_mayor_habilitada
    );

    IF v_item.lista_precio_id IS NOT NULL THEN
        SELECT fn_obtener_precio_producto(v_item.lista_precio_id, v_item.producto_id)
        INTO v_precio_unit_final;
    END IF;

    IF v_precio_unit_final IS NULL OR v_precio_unit_final <= 0 THEN
        v_precio_unit_final := NULLIF(v_item.precio_unit_est, 0);
    END IF;

    IF v_precio_unit_final IS NULL OR v_precio_unit_final <= 0 THEN
        v_precio_unit_final := NULLIF(v_item.producto_precio_venta, 0);
    END IF;

    v_precio_unit_final := COALESCE(v_precio_unit_final, 0);
    v_subtotal_final := ROUND(p_peso_final * v_precio_unit_final, 2);

    UPDATE presupuesto_items
    SET
        peso_final = p_peso_final,
        precio_unit_final = v_precio_unit_final,
        subtotal_final = v_subtotal_final,
        pesable = CASE WHEN v_es_pesable THEN true ELSE pesable END,
        updated_at = NOW()
    WHERE id = p_presupuesto_item_id;

    UPDATE presupuestos
    SET total_final = (
        SELECT COALESCE(SUM(
            CASE
                WHEN fn_es_item_pesable_contexto(
                    p.nombre,
                    p.categoria,
                    COALESCE(p.requiere_pesaje, false),
                    COALESCE(pi.pesable, false),
                    COALESCE(lp.tipo, '') IN ('mayorista', 'distribuidor'),
                    COALESCE(p.venta_mayor_habilitada, false)
                ) AND pi.peso_final IS NOT NULL THEN
                    ROUND(
                        COALESCE(pi.peso_final, pi.cantidad_solicitada) *
                        COALESCE(
                            NULLIF(pi.precio_unit_final, 0),
                            NULLIF(pi.precio_unit_est, 0),
                            NULLIF(p.precio_venta, 0),
                            0
                        ),
                        2
                    )
                ELSE
                    COALESCE(
                        NULLIF(pi.subtotal_final, 0),
                        NULLIF(pi.subtotal_est, 0),
                        ROUND(
                            pi.cantidad_solicitada *
                            COALESCE(
                                NULLIF(pi.precio_unit_final, 0),
                                NULLIF(pi.precio_unit_est, 0),
                                NULLIF(p.precio_venta, 0),
                                0
                            ),
                            2
                        ),
                        0
                    )
            END
        ), 0)
        FROM presupuesto_items pi
        JOIN productos p ON p.id = pi.producto_id
        LEFT JOIN listas_precios lp ON lp.id = pi.lista_precio_id
        WHERE pi.presupuesto_id = v_item.presupuesto_id
    ),
    updated_at = NOW()
    WHERE id = v_item.presupuesto_id;

    RETURN jsonb_build_object(
        'success', true,
        'precio_unit_final', v_precio_unit_final,
        'subtotal_final', v_subtotal_final
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_finalizar_pesaje_presupuesto(
    p_presupuesto_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_total_final DECIMAL(12,2);
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_lista_tipo VARCHAR(50);
BEGIN
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;

    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no esta en un estado valido para finalizar pesaje');
    END IF;

    SELECT lp.tipo INTO v_lista_tipo
    FROM listas_precios lp
    WHERE lp.id = v_presupuesto.lista_precio_id;

    IF v_lista_tipo IS NULL THEN
        SELECT lp.tipo INTO v_lista_tipo
        FROM clientes_listas_precios clp
        INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
        WHERE clp.cliente_id = v_presupuesto.cliente_id
          AND lp.activa = true
        ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
        LIMIT 1;
    END IF;

    SELECT COUNT(*) INTO v_total_pesables
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id
      AND fn_es_item_pesable_contexto(
          p.nombre,
          p.categoria,
          COALESCE(p.requiere_pesaje, false),
          COALESCE(pi.pesable, false),
          COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor'),
          COALESCE(p.venta_mayor_habilitada, false)
      );

    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id
      AND pi.peso_final IS NOT NULL
      AND fn_es_item_pesable_contexto(
          p.nombre,
          p.categoria,
          COALESCE(p.requiere_pesaje, false),
          COALESCE(pi.pesable, false),
          COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor'),
          COALESCE(p.venta_mayor_habilitada, false)
      );

    IF v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',
            'No se puede finalizar: todos los productos pesables deben estar pesados. Faltan ' ||
            (v_total_pesables - v_pesables_pesados) || ' producto(s) por pesar.'
        );
    END IF;

    SELECT COALESCE(SUM(
        CASE
            WHEN fn_es_item_pesable_contexto(
                p.nombre,
                p.categoria,
                COALESCE(p.requiere_pesaje, false),
                COALESCE(pi.pesable, false),
                COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor'),
                COALESCE(p.venta_mayor_habilitada, false)
            ) THEN
                ROUND(
                    COALESCE(pi.peso_final, pi.cantidad_solicitada) *
                    COALESCE(
                        NULLIF(pi.precio_unit_final, 0),
                        NULLIF(pi.precio_unit_est, 0),
                        NULLIF(p.precio_venta, 0),
                        0
                    ),
                    2
                )
            ELSE
                COALESCE(
                    NULLIF(pi.subtotal_final, 0),
                    NULLIF(pi.subtotal_est, 0),
                    ROUND(
                        pi.cantidad_solicitada *
                        COALESCE(
                            NULLIF(pi.precio_unit_final, 0),
                            NULLIF(pi.precio_unit_est, 0),
                            NULLIF(p.precio_venta, 0),
                            0
                        ),
                        2
                    ),
                    0
                )
        END
    ), 0)
    INTO v_total_final
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id;

    v_total_final := v_total_final + COALESCE(v_presupuesto.recargo_total, 0);

    UPDATE presupuestos
    SET total_final = v_total_final,
        updated_at = NOW()
    WHERE id = p_presupuesto_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pesaje finalizado correctamente. El presupuesto seguira disponible en Presupuestos del Dia.',
        'total_final', v_total_final,
        'estado', v_presupuesto.estado
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Error al finalizar pesaje: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_presupuesto RECORD;
    v_item RECORD;
    v_producto RECORD;
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_total_items DECIMAL(12,2) := 0;
    v_total_con_recargo DECIMAL(12,2) := 0;
    v_total_pesables INTEGER := 0;
    v_pesables_pesados INTEGER := 0;
    v_cantidad_a_consumir DECIMAL(12,3);
    v_cantidad_stock DECIMAL(12,3);
    v_caja_movimiento_id UUID;
    v_cuenta_id UUID;
    v_referencia_pago VARCHAR(60);
    v_instruccion_repartidor TEXT;
    v_turno TEXT;
    v_fecha_entrega DATE;
    v_now_ba TIMESTAMPTZ := timezone('America/Argentina/Buenos_Aires', NOW());
    v_hora_actual INTEGER;
    v_lista_tipo VARCHAR(50);
    v_es_venta_mayor BOOLEAN;
    v_unidad_venta VARCHAR(50);
    v_es_pedido_nuevo BOOLEAN := false;
    v_entrega_id UUID;
    v_orden_entrega INTEGER;
    v_cliente RECORD;
    v_item_lista_tipo VARCHAR(50);
    v_item_es_pesable BOOLEAN := false;
    v_precio_unitario_item DECIMAL(12,2) := 0;
    v_subtotal_item DECIMAL(12,2) := 0;
BEGIN
    SELECT * INTO v_presupuesto
    FROM presupuestos
    WHERE id = p_presupuesto_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto no encontrado');
    END IF;

    IF v_presupuesto.estado NOT IN ('pendiente', 'en_almacen') THEN
        RETURN jsonb_build_object('success', false, 'error', 'El presupuesto no esta en un estado valido para facturar');
    END IF;

    IF v_presupuesto.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Presupuesto debe tener zona asignada antes de convertir');
    END IF;

    SELECT lp.tipo INTO v_lista_tipo
    FROM listas_precios lp
    WHERE lp.id = v_presupuesto.lista_precio_id;

    IF v_lista_tipo IS NULL THEN
        SELECT lp.tipo INTO v_lista_tipo
        FROM clientes_listas_precios clp
        INNER JOIN listas_precios lp ON lp.id = clp.lista_precio_id
        WHERE clp.cliente_id = v_presupuesto.cliente_id
          AND lp.activa = true
        ORDER BY lp.tipo = 'mayorista' DESC, lp.tipo = 'distribuidor' DESC
        LIMIT 1;
    END IF;

    v_es_venta_mayor := v_lista_tipo IN ('mayorista', 'distribuidor');

    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);

    IF v_presupuesto.turno IS NULL THEN
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        ELSE
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
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id
      AND fn_es_item_pesable_contexto(
          p.nombre,
          p.categoria,
          COALESCE(p.requiere_pesaje, false),
          COALESCE(pi.pesable, false),
          COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor'),
          COALESCE(p.venta_mayor_habilitada, false)
      );

    SELECT COUNT(*) INTO v_pesables_pesados
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id
      AND pi.peso_final IS NOT NULL
      AND fn_es_item_pesable_contexto(
          p.nombre,
          p.categoria,
          COALESCE(p.requiere_pesaje, false),
          COALESCE(pi.pesable, false),
          COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor'),
          COALESCE(p.venta_mayor_habilitada, false)
      );

    IF v_total_pesables > 0 AND v_pesables_pesados < v_total_pesables THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No se puede convertir a pedido: todos los productos pesables deben estar pesados. Faltan ' ||
            (v_total_pesables - v_pesables_pesados) || ' producto(s) por pesar.'
        );
    END IF;

    SELECT COALESCE(SUM(
        CASE
            WHEN fn_es_item_pesable_contexto(
                p.nombre,
                p.categoria,
                COALESCE(p.requiere_pesaje, false),
                COALESCE(pi.pesable, false),
                COALESCE(lp_item.tipo, lp_pres.tipo, v_lista_tipo) IN ('mayorista', 'distribuidor'),
                COALESCE(p.venta_mayor_habilitada, false)
            ) THEN
                ROUND(
                    COALESCE(pi.peso_final, pi.cantidad_solicitada) *
                    COALESCE(
                        NULLIF(pi.precio_unit_final, 0),
                        NULLIF(pi.precio_unit_est, 0),
                        NULLIF(p.precio_venta, 0),
                        0
                    ),
                    2
                )
            ELSE
                COALESCE(
                    NULLIF(pi.subtotal_final, 0),
                    NULLIF(pi.subtotal_est, 0),
                    ROUND(
                        pi.cantidad_solicitada *
                        COALESCE(
                            NULLIF(pi.precio_unit_final, 0),
                            NULLIF(pi.precio_unit_est, 0),
                            NULLIF(p.precio_venta, 0),
                            0
                        ),
                        2
                    ),
                    0
                )
        END
    ), 0)
    INTO v_total_items
    FROM presupuesto_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN listas_precios lp_item ON lp_item.id = pi.lista_precio_id
    LEFT JOIN listas_precios lp_pres ON lp_pres.id = v_presupuesto.lista_precio_id
    WHERE pi.presupuesto_id = p_presupuesto_id;

    v_total_con_recargo := v_total_items + COALESCE(v_presupuesto.recargo_total, 0);

    SELECT id INTO v_pedido_id
    FROM pedidos
    WHERE zona_id = v_presupuesto.zona_id
      AND turno = v_turno
      AND fecha_entrega_estimada = v_fecha_entrega
      AND estado_cierre = 'abierto'
    LIMIT 1;

    IF v_pedido_id IS NULL THEN
        v_es_pedido_nuevo := true;
        v_numero_pedido := fn_obtener_siguiente_numero('pedido');

        INSERT INTO pedidos (
            numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
            estado, estado_cierre, tipo_pedido, origen, subtotal, total, total_final,
            observaciones, lista_precio_id, turno, zona_id,
            metodos_pago, recargo_total, pago_estado, cantidad_entregas
        ) VALUES (
            v_numero_pedido, NULL, v_presupuesto.usuario_vendedor,
            v_fecha_entrega, 'preparando', 'abierto', 'venta', 'agrupado',
            0, 0, 0,
            NULL, NULL,
            v_turno, v_presupuesto.zona_id, NULL,
            0, 'pendiente', 0
        ) RETURNING id INTO v_pedido_id;
    ELSE
        SELECT numero_pedido INTO v_numero_pedido
        FROM pedidos WHERE id = v_pedido_id;
    END IF;

    SELECT * INTO v_cliente
    FROM clientes
    WHERE id = v_presupuesto.cliente_id;

    SELECT COALESCE(MAX(orden_entrega), 0) + 1 INTO v_orden_entrega
    FROM entregas
    WHERE pedido_id = v_pedido_id;

    v_referencia_pago := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    v_instruccion_repartidor := 'Cobrar al cliente ' || v_cliente.nombre || ': $' ||
        v_total_con_recargo::TEXT || ' - Ref: ' || v_referencia_pago;

    INSERT INTO entregas (
        pedido_id,
        cliente_id,
        presupuesto_id,
        subtotal,
        recargo,
        total,
        direccion,
        coordenadas,
        orden_entrega,
        estado_entrega,
        estado_pago,
        referencia_pago,
        instruccion_repartidor,
        observaciones
    ) VALUES (
        v_pedido_id,
        v_presupuesto.cliente_id,
        p_presupuesto_id,
        v_total_items,
        COALESCE(v_presupuesto.recargo_total, 0),
        v_total_con_recargo,
        v_cliente.direccion,
        v_cliente.coordenadas,
        v_orden_entrega,
        'pendiente',
        'pendiente',
        v_referencia_pago,
        v_instruccion_repartidor,
        v_presupuesto.observaciones
    ) RETURNING id INTO v_entrega_id;

    FOR v_item IN
        SELECT pi.*, lp.tipo as lista_tipo_item
        FROM presupuesto_items pi
        LEFT JOIN listas_precios lp ON lp.id = pi.lista_precio_id
        WHERE pi.presupuesto_id = p_presupuesto_id
    LOOP
        SELECT
            id,
            nombre,
            categoria,
            unidad_medida,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(kg_por_unidad_mayor, 20) as kg_por_unidad_mayor,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre,
            COALESCE(requiere_pesaje, false) as requiere_pesaje,
            precio_venta
        INTO v_producto
        FROM productos
        WHERE id = v_item.producto_id;

        v_item_lista_tipo := COALESCE(v_item.lista_tipo_item, v_lista_tipo);
        v_item_es_pesable := fn_es_item_pesable_contexto(
            v_producto.nombre,
            v_producto.categoria,
            v_producto.requiere_pesaje,
            COALESCE(v_item.pesable, false),
            v_item_lista_tipo IN ('mayorista', 'distribuidor'),
            v_producto.venta_mayor_habilitada
        );

        v_cantidad_a_consumir := CASE
            WHEN v_item_es_pesable THEN COALESCE(v_item.peso_final, v_item.cantidad_solicitada)
            WHEN v_item_lista_tipo IN ('mayorista', 'distribuidor') AND v_producto.venta_mayor_habilitada THEN v_item.cantidad_solicitada
            ELSE v_item.cantidad_solicitada
        END;

        IF v_item_lista_tipo IN ('mayorista', 'distribuidor')
           AND v_producto.venta_mayor_habilitada
           AND v_producto.unidad_medida = 'kg'
           AND NOT v_item_es_pesable THEN
            v_cantidad_stock := v_cantidad_a_consumir * v_producto.kg_por_unidad_mayor;
            v_unidad_venta := v_producto.unidad_mayor_nombre;
        ELSE
            v_cantidad_stock := v_cantidad_a_consumir;
            v_unidad_venta := v_producto.unidad_medida;
        END IF;

        v_precio_unitario_item := COALESCE(
            NULLIF(v_item.precio_unit_final, 0),
            NULLIF(v_item.precio_unit_est, 0),
            NULLIF(v_producto.precio_venta, 0),
            0
        );

        v_subtotal_item := CASE
            WHEN v_item_es_pesable THEN ROUND(COALESCE(v_item.peso_final, v_item.cantidad_solicitada) * v_precio_unitario_item, 2)
            ELSE COALESCE(
                NULLIF(v_item.subtotal_final, 0),
                NULLIF(v_item.subtotal_est, 0),
                ROUND(v_cantidad_stock * v_precio_unitario_item, 2),
                0
            )
        END;

        INSERT INTO detalles_pedido (
            pedido_id, entrega_id, producto_id, lote_id, cantidad,
            precio_unitario, subtotal, peso_final, precio_unit_final
        ) VALUES (
            v_pedido_id, v_entrega_id, v_item.producto_id, v_item.lote_reservado_id,
            v_cantidad_stock,
            v_precio_unitario_item,
            v_subtotal_item,
            CASE WHEN v_item_es_pesable THEN v_cantidad_stock ELSE NULL END,
            v_precio_unitario_item
        );

        IF v_item.lote_reservado_id IS NOT NULL THEN
            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_cantidad_stock
            WHERE id = v_item.lote_reservado_id;

            INSERT INTO movimientos_stock (
                lote_id, tipo_movimiento, cantidad, motivo, usuario_id, pedido_id
            ) VALUES (
                v_item.lote_reservado_id,
                'salida',
                v_cantidad_stock,
                'Conversion presupuesto a pedido ' || v_numero_pedido ||
                CASE WHEN v_cantidad_stock != v_cantidad_a_consumir
                     THEN ' (' || v_cantidad_a_consumir || ' ' || v_unidad_venta || ')'
                     ELSE '' END,
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

    UPDATE pedidos
    SET subtotal = subtotal + v_total_items,
        total = total + v_total_con_recargo,
        total_final = total_final + v_total_con_recargo,
        cantidad_entregas = cantidad_entregas + 1,
        updated_at = NOW()
    WHERE id = v_pedido_id;

    IF p_caja_id IS NULL THEN
        v_cuenta_id := fn_asegurar_cuenta_corriente(v_presupuesto.cliente_id);

        UPDATE cuentas_corrientes
        SET saldo = saldo + v_total_con_recargo, updated_at = NOW()
        WHERE id = v_cuenta_id;

        INSERT INTO cuentas_movimientos (
            cuenta_corriente_id, tipo, monto, descripcion, origen_tipo, origen_id
        ) VALUES (
            v_cuenta_id, 'cargo', v_total_con_recargo,
            'Entrega del pedido ' || v_numero_pedido || ' - Ref: ' || v_referencia_pago,
            'entrega', v_entrega_id
        );

        UPDATE clientes SET bloqueado_por_deuda = true WHERE id = v_presupuesto.cliente_id;
    END IF;

    IF p_caja_id IS NOT NULL THEN
        INSERT INTO tesoreria_movimientos (
            caja_id, tipo, monto, descripcion, origen_tipo, origen_id, user_id
        ) VALUES (
            p_caja_id, 'ingreso', v_total_con_recargo,
            'Cobro por entrega del pedido ' || v_numero_pedido, 'entrega', v_entrega_id, p_user_id
        ) RETURNING id INTO v_caja_movimiento_id;

        UPDATE tesoreria_cajas
        SET saldo_actual = saldo_actual + v_total_con_recargo, updated_at = NOW()
        WHERE id = p_caja_id;

        UPDATE entregas
        SET estado_pago = 'pagado', monto_cobrado = v_total_con_recargo
        WHERE id = v_entrega_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'entrega_id', v_entrega_id,
        'total', v_total_con_recargo,
        'mensaje', CASE WHEN v_es_pedido_nuevo THEN 'Pedido creado' ELSE 'Entrega agregada' END
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_crear_presupuesto_desde_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL,
    p_fecha_entrega_estimada DATE DEFAULT NULL,
    p_lista_precio_id UUID DEFAULT NULL
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
    v_lista_tipo_item VARCHAR(50);
    v_unidad_venta VARCHAR(50);
    v_cantidad_real DECIMAL(10,3);
    v_lista_precio_id_item UUID;
    v_es_mayorista BOOLEAN;
    v_es_pesable BOOLEAN;
BEGIN
    IF p_zona_id IS NULL THEN
        SELECT z.id INTO v_cliente_zona_id
        FROM clientes c
        LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(c.zona_entrega))
        WHERE c.id = p_cliente_id
        LIMIT 1;

        p_zona_id := v_cliente_zona_id;
    END IF;

    v_hora_actual := EXTRACT(HOUR FROM v_now_ba);

    IF p_fecha_entrega_estimada IS NULL THEN
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba);
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
            v_fecha_entrega := DATE(v_now_ba);
        ELSE
            v_turno := 'mañana';
            v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
        END IF;
    ELSE
        v_fecha_entrega := p_fecha_entrega_estimada;
        IF v_hora_actual < 5 THEN
            v_turno := 'mañana';
        ELSIF v_hora_actual >= 5 AND v_hora_actual < 15 THEN
            v_turno := 'tarde';
        ELSE
            IF p_fecha_entrega_estimada = DATE(v_now_ba) THEN
                v_turno := 'mañana';
                v_fecha_entrega := DATE(v_now_ba) + INTERVAL '1 day';
            ELSE
                v_turno := 'mañana';
            END IF;
        END IF;
    END IF;

    v_estado_inicial := 'en_almacen';
    v_numero_presupuesto := fn_obtener_siguiente_numero('presupuesto');

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

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF (v_item->>'lista_precio_id') IS NOT NULL AND (v_item->>'lista_precio_id') != 'null' AND (v_item->>'lista_precio_id') != '' THEN
            v_lista_precio_id_item := (v_item->>'lista_precio_id')::UUID;
        ELSE
            v_lista_precio_id_item := p_lista_precio_id;
        END IF;

        v_lista_tipo_item := NULL;
        v_es_mayorista := FALSE;
        IF v_lista_precio_id_item IS NOT NULL THEN
            SELECT tipo INTO v_lista_tipo_item
            FROM listas_precios
            WHERE id = v_lista_precio_id_item
              AND activa = true;

            v_es_mayorista := v_lista_tipo_item IN ('mayorista', 'distribuidor');
        END IF;

        SELECT
            id,
            nombre,
            precio_venta,
            unidad_medida,
            categoria,
            COALESCE(venta_mayor_habilitada, false) as venta_mayor_habilitada,
            COALESCE(unidad_mayor_nombre, 'caja') as unidad_mayor_nombre,
            COALESCE(kg_por_unidad_mayor, 20) as kg_por_unidad_mayor,
            COALESCE(requiere_pesaje, false) as requiere_pesaje
        INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Producto no encontrado: %s', v_item->>'producto_id')
            );
        END IF;

        IF (v_item->>'precio_unitario') IS NOT NULL AND (v_item->>'precio_unitario')::DECIMAL > 0 THEN
            v_precio_unit := (v_item->>'precio_unitario')::DECIMAL;
        ELSE
            IF v_lista_precio_id_item IS NOT NULL THEN
                SELECT fn_obtener_precio_producto(v_lista_precio_id_item, (v_item->>'producto_id')::UUID)
                INTO v_precio_unit;
            ELSE
                v_precio_unit := v_producto.precio_venta;
            END IF;

            IF v_precio_unit IS NULL OR v_precio_unit = 0 THEN
                v_precio_unit := 0;
            END IF;
        END IF;

        IF v_es_mayorista
           AND v_producto.venta_mayor_habilitada
           AND v_producto.unidad_medida = 'kg' THEN
            v_unidad_venta := v_producto.unidad_mayor_nombre;
            v_cantidad_real := (v_item->>'cantidad')::DECIMAL;
        ELSE
            v_unidad_venta := v_producto.unidad_medida;
            v_cantidad_real := (v_item->>'cantidad')::DECIMAL;
        END IF;

        v_subtotal := v_cantidad_real * v_precio_unit;

        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
          AND l.estado = 'disponible';

        v_es_pesable := fn_es_item_pesable_contexto(
            v_producto.nombre,
            v_producto.categoria,
            v_producto.requiere_pesaje,
            false,
            v_es_mayorista,
            v_producto.venta_mayor_habilitada
        );

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
            v_es_pesable,
            v_lista_precio_id_item,
            v_unidad_venta
        );

        v_total_estimado := v_total_estimado + v_subtotal;
    END LOOP;

    UPDATE presupuestos
    SET total_estimado = v_total_estimado
    WHERE id = v_presupuesto_id;

    SELECT fn_reservar_stock_por_presupuesto(v_presupuesto_id) INTO v_reserva_result;

    RETURN jsonb_build_object(
        'success', true,
        'presupuesto_id', v_presupuesto_id,
        'numero_presupuesto', v_numero_presupuesto,
        'total_estimado', v_total_estimado,
        'turno', v_turno,
        'fecha_entrega_estimada', v_fecha_entrega,
        'reserva_result', v_reserva_result
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
