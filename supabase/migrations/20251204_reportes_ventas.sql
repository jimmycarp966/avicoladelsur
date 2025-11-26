-- ===========================================
-- MIGRACIÓN: FUNCIONES RPC PARA REPORTES DE VENTAS
-- Fecha: 04/12/2025
-- Objetivo: Crear funciones RPC optimizadas para cálculos de reportes de ventas
-- ===========================================

BEGIN;

-- ===========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===========================================

-- Índices para consultas de reportes de ventas
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_estado ON pedidos(fecha_pedido, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_fecha ON pedidos(cliente_id, fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_fecha ON pedidos(usuario_vendedor, fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_detalles_pedido_producto_fecha ON detalles_pedido(producto_id);

-- Índice para tesoreria_movimientos (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_movimientos') THEN
        CREATE INDEX IF NOT EXISTS idx_tesoreria_movimientos_fecha_metodo ON tesoreria_movimientos(created_at, metodo_pago, tipo);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha_estado ON presupuestos(fecha_entrega_estimada, estado);

-- ===========================================
-- FUNCIÓN: fn_kpis_ventas
-- Calcula KPIs principales de ventas
-- ===========================================

CREATE OR REPLACE FUNCTION fn_kpis_ventas(
    fecha_inicio DATE,
    fecha_fin DATE,
    zona_id UUID DEFAULT NULL,
    vendedor_id UUID DEFAULT NULL,
    metodo_pago VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_ventas_totales DECIMAL(10,2) := 0;
    v_transacciones INTEGER := 0;
    v_ticket_promedio DECIMAL(10,2) := 0;
    v_ticket_por_zona JSONB := '{}'::jsonb;
    v_ticket_por_cliente DECIMAL(10,2) := 0;
    v_recaudacion_por_metodo JSONB := '{}'::jsonb;
    v_margen_por_categoria JSONB := '{}'::jsonb;
    v_rec RECORD;
BEGIN
    -- Calcular ventas totales y transacciones
    SELECT 
        COALESCE(SUM(p.total), 0),
        COUNT(*)
    INTO v_ventas_totales, v_transacciones
    FROM pedidos p
    JOIN clientes c ON p.cliente_id = c.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
      AND (zona_id IS NULL OR EXISTS (SELECT 1 FROM zonas z WHERE z.id = zona_id AND z.nombre = c.zona_entrega))
      AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id);

    -- Calcular ticket promedio
    IF v_transacciones > 0 THEN
        v_ticket_promedio := v_ventas_totales / v_transacciones;
    END IF;

    -- Calcular ticket promedio por zona
    FOR v_rec IN
        SELECT 
            COALESCE(z.nombre, c.zona_entrega, 'Sin zona') as zona,
            COALESCE(SUM(p.total), 0) as ventas,
            COUNT(*) as transacciones
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        LEFT JOIN zonas z ON z.nombre = c.zona_entrega
        WHERE p.fecha_pedido >= fecha_inicio::timestamp
          AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
          AND p.estado = 'entregado'
          AND (zona_id IS NULL OR z.id = zona_id)
          AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id)
        GROUP BY zona
    LOOP
        IF v_rec.transacciones > 0 THEN
            v_ticket_por_zona := v_ticket_por_zona || jsonb_build_object(
                v_rec.zona,
                v_rec.ventas / v_rec.transacciones
            );
        END IF;
    END LOOP;

    -- Calcular ticket promedio por cliente
    SELECT 
        CASE 
            WHEN COUNT(DISTINCT p.cliente_id) > 0 
            THEN v_ventas_totales / COUNT(DISTINCT p.cliente_id)
            ELSE 0
        END
    INTO v_ticket_por_cliente
    FROM pedidos p
    JOIN clientes c ON p.cliente_id = c.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
      AND (zona_id IS NULL OR EXISTS (SELECT 1 FROM zonas z WHERE z.id = zona_id AND z.nombre = c.zona_entrega))
      AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id);

    -- Calcular recaudación por método de pago (solo si existe la tabla tesoreria_movimientos)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_movimientos') THEN
        FOR v_rec IN
            SELECT 
                COALESCE(tm.metodo_pago, 'efectivo') as metodo,
                SUM(tm.monto) as monto
            FROM tesoreria_movimientos tm
            JOIN pedidos p ON tm.origen_id = p.id
            JOIN clientes c ON p.cliente_id = c.id
            WHERE tm.created_at >= fecha_inicio::timestamp
              AND tm.created_at <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
              AND tm.tipo = 'ingreso'
              AND tm.origen_tipo = 'pedido'
              AND p.estado = 'entregado'
              AND (zona_id IS NULL OR EXISTS (SELECT 1 FROM zonas z WHERE z.id = zona_id AND z.nombre = c.zona_entrega))
              AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id)
              AND (metodo_pago IS NULL OR tm.metodo_pago = metodo_pago)
            GROUP BY tm.metodo_pago
        LOOP
            v_recaudacion_por_metodo := v_recaudacion_por_metodo || jsonb_build_object(
                v_rec.metodo,
                v_rec.monto
            );
        END LOOP;
    END IF;

    -- Calcular margen por categoría (simplificado - usando precio_venta - precio_costo)
    FOR v_rec IN
        SELECT 
            pr.categoria,
            SUM(dp.subtotal) as ventas,
            SUM(dp.cantidad * COALESCE(pr.precio_costo, 0)) as costos
        FROM pedidos p
        JOIN detalles_pedido dp ON p.id = dp.pedido_id
        JOIN productos pr ON dp.producto_id = pr.id
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.fecha_pedido >= fecha_inicio::timestamp
          AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
          AND p.estado = 'entregado'
          AND (zona_id IS NULL OR EXISTS (SELECT 1 FROM zonas z WHERE z.id = zona_id AND z.nombre = c.zona_entrega))
          AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id)
        GROUP BY pr.categoria
    LOOP
        IF v_rec.ventas > 0 THEN
            v_margen_por_categoria := v_margen_por_categoria || jsonb_build_object(
                v_rec.categoria,
                ((v_rec.ventas - v_rec.costos) / v_rec.ventas) * 100
            );
        END IF;
    END LOOP;

    -- Construir resultado
    v_result := jsonb_build_object(
        'ventas_totales', v_ventas_totales,
        'transacciones', v_transacciones,
        'ticket_promedio', v_ticket_promedio,
        'ticket_promedio_por_zona', v_ticket_por_zona,
        'ticket_promedio_por_cliente', v_ticket_por_cliente,
        'recaudacion_por_metodo', v_recaudacion_por_metodo,
        'margen_por_categoria', v_margen_por_categoria
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'ventas_totales', 0,
            'transacciones', 0,
            'ticket_promedio', 0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_ventas_por_periodo
-- Agrupa ventas por día, semana, mes o trimestre
-- ===========================================

CREATE OR REPLACE FUNCTION fn_ventas_por_periodo(
    fecha_inicio DATE,
    fecha_fin DATE,
    agrupacion VARCHAR DEFAULT 'dia',
    zona_id UUID DEFAULT NULL,
    vendedor_id UUID DEFAULT NULL,
    metodo_pago VARCHAR DEFAULT NULL
) RETURNS TABLE (
    periodo VARCHAR,
    ventas DECIMAL(10,2),
    transacciones BIGINT,
    ticket_promedio DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH pedidos_filtrados AS (
        SELECT 
            p.id,
            p.total,
            p.fecha_pedido,
            c.zona_entrega,
            p.usuario_vendedor
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.fecha_pedido >= fecha_inicio::timestamp
          AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
          AND p.estado = 'entregado'
          AND (zona_id IS NULL OR EXISTS (SELECT 1 FROM zonas z WHERE z.id = zona_id AND z.nombre = c.zona_entrega))
          AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id)
    ),
    periodos AS (
        SELECT 
            CASE 
                WHEN agrupacion = 'dia' THEN TO_CHAR(pf.fecha_pedido, 'YYYY-MM-DD')
                WHEN agrupacion = 'semana' THEN TO_CHAR(DATE_TRUNC('week', pf.fecha_pedido), 'YYYY-MM-DD')
                WHEN agrupacion = 'mes' THEN TO_CHAR(DATE_TRUNC('month', pf.fecha_pedido), 'YYYY-MM')
                WHEN agrupacion = 'trimestre' THEN TO_CHAR(DATE_TRUNC('quarter', pf.fecha_pedido), 'YYYY-Q')
                ELSE TO_CHAR(pf.fecha_pedido, 'YYYY-MM-DD')
            END as periodo,
            SUM(pf.total) as ventas,
            COUNT(*) as transacciones
        FROM pedidos_filtrados pf
        GROUP BY periodo
    )
    SELECT 
        p.periodo::VARCHAR,
        COALESCE(p.ventas, 0)::DECIMAL(10,2),
        p.transacciones::BIGINT,
        CASE 
            WHEN p.transacciones > 0 
            THEN (p.ventas / p.transacciones)::DECIMAL(10,2)
            ELSE 0::DECIMAL(10,2)
        END as ticket_promedio
    FROM periodos p
    ORDER BY p.periodo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_top_productos
-- Obtiene ranking de productos más vendidos
-- ===========================================

CREATE OR REPLACE FUNCTION fn_top_productos(
    fecha_inicio DATE,
    fecha_fin DATE,
    limite INTEGER DEFAULT 10,
    zona_id UUID DEFAULT NULL,
    categoria_filtro VARCHAR DEFAULT NULL
) RETURNS TABLE (
    producto_id UUID,
    producto_nombre VARCHAR,
    categoria VARCHAR,
    unidades_vendidas DECIMAL(10,3),
    kg_vendidos DECIMAL(10,3),
    ventas DECIMAL(10,2),
    transacciones BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id as producto_id,
        pr.nombre as producto_nombre,
        pr.categoria,
        SUM(dp.cantidad) as unidades_vendidas,
        SUM(CASE WHEN pr.unidad_medida = 'kg' THEN dp.cantidad ELSE 0 END) as kg_vendidos,
        SUM(dp.subtotal) as ventas,
        COUNT(DISTINCT p.id) as transacciones
    FROM pedidos p
    JOIN detalles_pedido dp ON p.id = dp.pedido_id
    JOIN productos pr ON dp.producto_id = pr.id
    JOIN clientes c ON p.cliente_id = c.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
      AND (zona_id IS NULL OR EXISTS (SELECT 1 FROM zonas z WHERE z.id = zona_id AND z.nombre = c.zona_entrega))
      AND (categoria_filtro IS NULL OR pr.categoria = categoria_filtro)
    GROUP BY pr.id, pr.nombre, pr.categoria
    ORDER BY ventas DESC
    LIMIT limite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_heatmap_ventas
-- Genera heatmap de ventas por día de semana y hora
-- ===========================================

CREATE OR REPLACE FUNCTION fn_heatmap_ventas(
    fecha_inicio DATE,
    fecha_fin DATE
) RETURNS TABLE (
    dia_semana INTEGER,
    hora INTEGER,
    ventas DECIMAL(10,2),
    transacciones BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(DOW FROM p.fecha_pedido)::INTEGER as dia_semana,
        EXTRACT(HOUR FROM p.fecha_pedido)::INTEGER as hora,
        SUM(p.total) as ventas,
        COUNT(*) as transacciones
    FROM pedidos p
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
    GROUP BY dia_semana, hora
    ORDER BY dia_semana, hora;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_kpis_ventas IS 'Calcula KPIs principales de ventas para un período dado';
COMMENT ON FUNCTION fn_ventas_por_periodo IS 'Agrupa ventas por día, semana, mes o trimestre';
COMMENT ON FUNCTION fn_top_productos IS 'Obtiene ranking de productos más vendidos';
COMMENT ON FUNCTION fn_heatmap_ventas IS 'Genera heatmap de ventas por día de semana y hora';

COMMIT;

