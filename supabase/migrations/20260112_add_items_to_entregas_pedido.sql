DROP FUNCTION IF EXISTS fn_obtener_entregas_pedido(UUID);

CREATE OR REPLACE FUNCTION fn_obtener_entregas_pedido(p_pedido_id UUID)
RETURNS TABLE (
    entrega_id UUID,
    cliente_id UUID,
    cliente_nombre VARCHAR,
    cliente_telefono VARCHAR,
    presupuesto_id UUID,
    numero_presupuesto VARCHAR,
    subtotal DECIMAL,
    recargo DECIMAL,
    total DECIMAL,
    direccion TEXT,
    orden_entrega INTEGER,
    estado_entrega VARCHAR,
    estado_pago VARCHAR,
    metodo_pago VARCHAR,
    monto_cobrado DECIMAL,
    referencia_pago VARCHAR,
    observaciones TEXT,
    items JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as entrega_id,
        e.cliente_id,
        c.nombre as cliente_nombre,
        c.telefono as cliente_telefono,
        e.presupuesto_id,
        p.numero_presupuesto,
        e.subtotal,
        e.recargo,
        e.total,
        e.direccion,
        e.orden_entrega,
        e.estado_entrega,
        e.estado_pago,
        e.metodo_pago,
        e.monto_cobrado,
        e.referencia_pago,
        e.observaciones,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'producto_nombre', pr.nombre,
                        'cantidad', dp.cantidad,
                        'peso', dp.peso_final,
                        'precio_unitario', dp.precio_unitario,
                        'subtotal', dp.subtotal,
                        'codigo', pr.codigo
                    )
                )
                FROM detalles_pedido dp
                JOIN productos pr ON dp.producto_id = pr.id
                WHERE dp.entrega_id = e.id
            ),
            '[]'::jsonb
        ) as items
    FROM entregas e
    INNER JOIN clientes c ON e.cliente_id = c.id
    LEFT JOIN presupuestos p ON e.presupuesto_id = p.id
    WHERE e.pedido_id = p_pedido_id
    ORDER BY e.orden_entrega;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
