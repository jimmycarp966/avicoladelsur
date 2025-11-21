-- ===========================================
-- FIX: Stock disponible real considerando reservas preventivas
-- ===========================================
-- Esta migración corrige el cálculo de stock disponible para que reste
-- las reservas preventivas activas de la tabla stock_reservations

-- Función para calcular stock disponible de un producto (usada en vista)
CREATE OR REPLACE FUNCTION calcular_stock_disponible(p_producto_id UUID)
RETURNS DECIMAL(10,3) AS $$
DECLARE
    v_stock_total DECIMAL(10,3) := 0;
    v_stock_reservado DECIMAL(10,3) := 0;
BEGIN
    -- Stock total de lotes disponibles
    SELECT COALESCE(SUM(l.cantidad_disponible), 0)
    INTO v_stock_total
    FROM lotes l
    WHERE l.producto_id = p_producto_id
        AND l.estado = 'disponible'
        AND l.cantidad_disponible > 0
        AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE);
    
    -- Stock reservado en reservas preventivas activas
    SELECT COALESCE(SUM(sr.cantidad), 0)
    INTO v_stock_reservado
    FROM stock_reservations sr
    INNER JOIN lotes l ON sr.lote_id = l.id
    WHERE sr.producto_id = p_producto_id
        AND sr.estado = 'activa'
        AND sr.expires_at > NOW()
        AND l.estado = 'disponible';
    
    RETURN GREATEST(v_stock_total - v_stock_reservado, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Vista que devuelve productos con stock disponible calculado
CREATE OR REPLACE VIEW productos_con_stock AS
SELECT 
    p.*,
    calcular_stock_disponible(p.id) AS stock_disponible
FROM productos p
WHERE p.activo = true;

-- Permisos para la vista
GRANT SELECT ON productos_con_stock TO authenticated;
GRANT SELECT ON productos_con_stock TO anon;

-- Función para obtener stock disponible real de un producto (mantiene compatibilidad)
CREATE OR REPLACE FUNCTION fn_obtener_stock_disponible_real(
    p_producto_id UUID DEFAULT NULL
) RETURNS TABLE (
    producto_id UUID,
    producto_codigo VARCHAR,
    producto_nombre VARCHAR,
    stock_total_lotes DECIMAL(10,3),
    stock_reservado DECIMAL(10,3),
    stock_disponible_real DECIMAL(10,3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS producto_id,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        COALESCE(SUM(l.cantidad_disponible), 0) AS stock_total_lotes,
        COALESCE(SUM(
            CASE 
                WHEN sr.estado = 'activa' 
                AND sr.expires_at > NOW() 
                THEN sr.cantidad 
                ELSE 0 
            END
        ), 0) AS stock_reservado,
        calcular_stock_disponible(p.id) AS stock_disponible_real
    FROM productos p
    LEFT JOIN lotes l ON l.producto_id = p.id
        AND l.estado = 'disponible'
        AND l.cantidad_disponible > 0
        AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_DATE)
    LEFT JOIN stock_reservations sr ON sr.lote_id = l.id
        AND sr.producto_id = p.id
    WHERE (p_producto_id IS NULL OR p.id = p_producto_id)
        AND p.activo = true
    GROUP BY p.id, p.codigo, p.nombre
    HAVING calcular_stock_disponible(p.id) > 0
    ORDER BY p.codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para las funciones
GRANT EXECUTE ON FUNCTION calcular_stock_disponible(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_stock_disponible(UUID) TO anon;
GRANT EXECUTE ON FUNCTION fn_obtener_stock_disponible_real(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_stock_disponible_real(UUID) TO anon;

-- Comentarios explicativos
COMMENT ON FUNCTION calcular_stock_disponible(UUID) IS 
'Calcula el stock disponible real de un producto restando las reservas preventivas activas.';

COMMENT ON VIEW productos_con_stock IS 
'Vista que devuelve productos activos con su stock disponible calculado en tiempo real desde lotes.';

COMMENT ON FUNCTION fn_obtener_stock_disponible_real(UUID) IS 
'Calcula el stock disponible real de productos restando las reservas preventivas activas. 
Si p_producto_id es NULL, retorna todos los productos con stock disponible > 0.';

