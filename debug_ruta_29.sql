DO $$
DECLARE
    v_ruta_id UUID;
    v_detalle RECORD;
    v_pedido RECORD;
    v_entrega RECORD;
BEGIN
    SELECT id INTO v_ruta_id FROM rutas_reparto WHERE numero_ruta = 'RUT-000000029';
    RAISE NOTICE 'Ruta ID: %', v_ruta_id;

    FOR v_detalle IN SELECT * FROM detalles_ruta WHERE ruta_id = v_ruta_id LOOP
        RAISE NOTICE '------------------------------------------------';
        RAISE NOTICE 'Detalle Ruta ID: %, Pedido ID: %, Orden: %', v_detalle.id, v_detalle.pedido_id, v_detalle.orden_entrega;
        
        SELECT * INTO v_pedido FROM pedidos WHERE id = v_detalle.pedido_id;
        RAISE NOTICE 'Pedido: ID=%, Numero=%, ClienteID=%, Total=%', v_pedido.id, v_pedido.numero_pedido, v_pedido.cliente_id, v_pedido.total;

        FOR v_entrega IN SELECT * FROM entregas WHERE pedido_id = v_detalle.pedido_id LOOP
             RAISE NOTICE '  -> Entrega: ID=%, ClienteID=%, Total=%, Direccion=%', v_entrega.id, v_entrega.cliente_id, v_entrega.total, v_entrega.direccion;
        END LOOP;
        
        -- Verificar si hay cliente
        IF v_pedido.cliente_id IS NOT NULL THEN
             RAISE NOTICE '  -> El pedido TIENE cliente_id directo: %', v_pedido.cliente_id;
        END IF;

    END LOOP;
END $$;
