-- ===========================================
-- MIGRACIÓN: FIX REPORTES - NUEVAS FUNCIONES RPC
-- Fecha: 07/12/2025
-- Objetivo: Crear funciones RPC para reemplazar consultas directas
--           y evitar problemas con RLS
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_ventas_por_zona
-- Agrupa ventas por zona de entrega
-- ===========================================

CREATE OR REPLACE FUNCTION fn_ventas_por_zona(
    fecha_inicio DATE,
    fecha_fin DATE,
    vendedor_id UUID DEFAULT NULL
) RETURNS TABLE (
    zona VARCHAR,
    ventas DECIMAL(10,2),
    transacciones BIGINT,
    ticket_promedio DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(c.zona_entrega, 'Sin zona') as zona,
        SUM(p.total)::DECIMAL(10,2) as ventas,
        COUNT(*)::BIGINT as transacciones,
        CASE 
            WHEN COUNT(*) > 0 THEN (SUM(p.total) / COUNT(*))::DECIMAL(10,2)
            ELSE 0::DECIMAL(10,2)
        END as ticket_promedio
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
      AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id)
    GROUP BY c.zona_entrega
    ORDER BY ventas DESC;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error en fn_ventas_por_zona: %', SQLERRM;
        RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_top_vendedores
-- Obtiene ranking de vendedores por ventas
-- ===========================================

CREATE OR REPLACE FUNCTION fn_top_vendedores(
    fecha_inicio DATE,
    fecha_fin DATE,
    limite INTEGER DEFAULT 10,
    zona_nombre VARCHAR DEFAULT NULL
) RETURNS TABLE (
    vendedor_id UUID,
    vendedor_nombre VARCHAR,
    ventas DECIMAL(10,2),
    transacciones BIGINT,
    ticket_promedio DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.usuario_vendedor as vendedor_id,
        (u.nombre || ' ' || u.apellido)::VARCHAR as vendedor_nombre,
        SUM(p.total)::DECIMAL(10,2) as ventas,
        COUNT(*)::BIGINT as transacciones,
        CASE 
            WHEN COUNT(*) > 0 THEN (SUM(p.total) / COUNT(*))::DECIMAL(10,2)
            ELSE 0::DECIMAL(10,2)
        END as ticket_promedio
    FROM pedidos p
    INNER JOIN usuarios u ON p.usuario_vendedor = u.id
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
      AND p.usuario_vendedor IS NOT NULL
      AND (zona_nombre IS NULL OR c.zona_entrega = zona_nombre)
    GROUP BY p.usuario_vendedor, u.nombre, u.apellido
    ORDER BY ventas DESC
    LIMIT limite;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error en fn_top_vendedores: %', SQLERRM;
        RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_ventas_por_metodo_pago
-- Agrupa ventas por método de pago
-- ===========================================

CREATE OR REPLACE FUNCTION fn_ventas_por_metodo_pago(
    fecha_inicio DATE,
    fecha_fin DATE
) RETURNS TABLE (
    metodo_pago VARCHAR,
    monto DECIMAL(10,2),
    transacciones BIGINT,
    porcentaje DECIMAL(5,2)
) AS $$
DECLARE
    v_total DECIMAL(10,2);
BEGIN
    -- Calcular total general
    SELECT COALESCE(SUM(tm.monto), 0)
    INTO v_total
    FROM tesoreria_movimientos tm
    WHERE tm.created_at >= fecha_inicio::timestamp
      AND tm.created_at <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND tm.tipo = 'ingreso'
      AND tm.origen_tipo = 'pedido';
    
    RETURN QUERY
    SELECT 
        COALESCE(tm.metodo_pago, 'efectivo')::VARCHAR as metodo_pago,
        SUM(tm.monto)::DECIMAL(10,2) as monto,
        COUNT(*)::BIGINT as transacciones,
        CASE 
            WHEN v_total > 0 THEN ((SUM(tm.monto) / v_total) * 100)::DECIMAL(5,2)
            ELSE 0::DECIMAL(5,2)
        END as porcentaje
    FROM tesoreria_movimientos tm
    WHERE tm.created_at >= fecha_inicio::timestamp
      AND tm.created_at <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND tm.tipo = 'ingreso'
      AND tm.origen_tipo = 'pedido'
    GROUP BY tm.metodo_pago
    ORDER BY monto DESC;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error en fn_ventas_por_metodo_pago: %', SQLERRM;
        RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_clientes_nuevos_vs_recurrentes
-- Clasifica clientes del período
-- ===========================================

CREATE OR REPLACE FUNCTION fn_clientes_nuevos_vs_recurrentes(
    fecha_inicio DATE,
    fecha_fin DATE
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_nuevos INTEGER := 0;
    v_recurrentes INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- Usar CTE para obtener clientes del período y anteriores
    WITH clientes_periodo AS (
        SELECT DISTINCT p.cliente_id
        FROM pedidos p
        WHERE p.fecha_pedido >= fecha_inicio::timestamp
          AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
          AND p.estado = 'entregado'
    ),
    clientes_anteriores AS (
        SELECT DISTINCT p.cliente_id
        FROM pedidos p
        WHERE p.fecha_pedido < fecha_inicio::timestamp
          AND p.estado = 'entregado'
    )
    SELECT 
        COUNT(CASE WHEN ca.cliente_id IS NULL THEN 1 END)::INTEGER,
        COUNT(CASE WHEN ca.cliente_id IS NOT NULL THEN 1 END)::INTEGER,
        COUNT(*)::INTEGER
    INTO v_nuevos, v_recurrentes, v_total
    FROM clientes_periodo cp
    LEFT JOIN clientes_anteriores ca ON cp.cliente_id = ca.cliente_id;
    
    -- Construir resultado JSON
    v_result := jsonb_build_object(
        'nuevos', v_nuevos,
        'recurrentes', v_recurrentes,
        'total', v_total,
        'porcentajeNuevos', CASE WHEN v_total > 0 THEN (v_nuevos::float / v_total * 100) ELSE 0 END,
        'porcentajeRecurrentes', CASE WHEN v_total > 0 THEN (v_recurrentes::float / v_total * 100) ELSE 0 END
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'nuevos', 0,
            'recurrentes', 0,
            'total', 0,
            'porcentajeNuevos', 0,
            'porcentajeRecurrentes', 0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_detalle_ventas_paginated
-- Obtiene detalle de ventas con paginación
-- ===========================================

CREATE OR REPLACE FUNCTION fn_detalle_ventas_paginated(
    fecha_inicio DATE,
    fecha_fin DATE,
    p_zona_nombre VARCHAR DEFAULT NULL,
    p_vendedor_id UUID DEFAULT NULL,
    p_estado VARCHAR DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    id UUID,
    numero_pedido VARCHAR,
    fecha_pedido TIMESTAMP,
    total DECIMAL(10,2),
    estado VARCHAR,
    pago_estado VARCHAR,
    cliente_id UUID,
    cliente_nombre VARCHAR,
    cliente_zona VARCHAR,
    vendedor_id UUID,
    vendedor_nombre VARCHAR,
    productos_count INTEGER,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INTEGER;
    v_total_count BIGINT;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    
    -- Primero obtener el count total
    SELECT COUNT(*)
    INTO v_total_count
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    LEFT JOIN usuarios u ON p.usuario_vendedor = u.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND (p_zona_nombre IS NULL OR c.zona_entrega = p_zona_nombre)
      AND (p_vendedor_id IS NULL OR p.usuario_vendedor = p_vendedor_id)
      AND (p_estado IS NULL OR p.estado = p_estado)
      AND (p_cliente_id IS NULL OR p.cliente_id = p_cliente_id);
    
    -- Retornar datos paginados
    RETURN QUERY
    SELECT 
        p.id,
        p.numero_pedido::VARCHAR,
        p.fecha_pedido,
        p.total::DECIMAL(10,2),
        p.estado::VARCHAR,
        p.pago_estado::VARCHAR,
        c.id as cliente_id,
        c.nombre::VARCHAR as cliente_nombre,
        c.zona_entrega::VARCHAR as cliente_zona,
        u.id as vendedor_id,
        (u.nombre || ' ' || u.apellido)::VARCHAR as vendedor_nombre,
        (SELECT COUNT(*)::INTEGER FROM detalles_pedido dp WHERE dp.pedido_id = p.id) as productos_count,
        v_total_count as total_count
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    LEFT JOIN usuarios u ON p.usuario_vendedor = u.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND (p_zona_nombre IS NULL OR c.zona_entrega = p_zona_nombre)
      AND (p_vendedor_id IS NULL OR p.usuario_vendedor = p_vendedor_id)
      AND (p_estado IS NULL OR p.estado = p_estado)
      AND (p_cliente_id IS NULL OR p.cliente_id = p_cliente_id)
    ORDER BY p.fecha_pedido DESC
    LIMIT p_limit
    OFFSET v_offset;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error en fn_detalle_ventas_paginated: %', SQLERRM;
        RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- COMENTARIOS Y PERMISOS
-- ===========================================

COMMENT ON FUNCTION fn_ventas_por_zona IS 'Agrupa ventas por zona de entrega con filtros';
COMMENT ON FUNCTION fn_top_vendedores IS 'Ranking de vendedores por ventas totales';
COMMENT ON FUNCTION fn_ventas_por_metodo_pago IS 'Distribución de recaudación por método de pago';
COMMENT ON FUNCTION fn_clientes_nuevos_vs_recurrentes IS 'Clasifica clientes como nuevos o recurrentes en un período';
COMMENT ON FUNCTION fn_detalle_ventas_paginated IS 'Detalle de ventas con paginación y filtros múltiples';

COMMIT;
