-- ===========================================
-- MIGRACIÓN: MATERIALIZED VIEWS PARA REPORTES
-- Fecha: 05/12/2025
-- Objetivo: Crear materialized views para optimizar consultas de reportes
-- ===========================================

BEGIN;

-- ===========================================
-- MATERIALIZED VIEW: KPIs de Ventas Diarias
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpis_ventas_diarias AS
SELECT 
    DATE(p.fecha_pedido) as fecha,
    COUNT(DISTINCT p.id) as transacciones,
    COUNT(DISTINCT p.cliente_id) as clientes_unicos,
    SUM(p.total) as ventas_totales,
    AVG(p.total) as ticket_promedio,
    SUM(CASE WHEN p.estado = 'entregado' THEN p.total ELSE 0 END) as ventas_entregadas,
    COUNT(CASE WHEN p.estado = 'entregado' THEN 1 END) as pedidos_entregados
FROM pedidos p
WHERE p.estado IN ('entregado', 'cancelado')
GROUP BY DATE(p.fecha_pedido);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpis_ventas_diarias_fecha ON mv_kpis_ventas_diarias(fecha);

-- ===========================================
-- MATERIALIZED VIEW: Stock Crítico
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stock_critico AS
SELECT 
    pr.id as producto_id,
    pr.nombre as producto_nombre,
    pr.categoria,
    pr.stock_minimo,
    COALESCE(SUM(l.cantidad_disponible), 0) as stock_actual,
    CASE 
        WHEN COALESCE(SUM(l.cantidad_disponible), 0) < pr.stock_minimo THEN true
        ELSE false
    END as es_critico,
    pr.stock_minimo - COALESCE(SUM(l.cantidad_disponible), 0) as diferencia
FROM productos pr
LEFT JOIN lotes l ON pr.id = l.producto_id AND l.estado = 'disponible'
WHERE pr.activo = true
GROUP BY pr.id, pr.nombre, pr.categoria, pr.stock_minimo
HAVING COALESCE(SUM(l.cantidad_disponible), 0) < pr.stock_minimo;

CREATE INDEX IF NOT EXISTS idx_mv_stock_critico_producto ON mv_stock_critico(producto_id);
CREATE INDEX IF NOT EXISTS idx_mv_stock_critico_categoria ON mv_stock_critico(categoria);

-- ===========================================
-- MATERIALIZED VIEW: Rotación de Inventario
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rotacion_inventario AS
SELECT 
    pr.categoria,
    COUNT(DISTINCT l.producto_id) as productos_activos,
    SUM(CASE WHEN ms.tipo_movimiento = 'salida' THEN ms.cantidad ELSE 0 END) as total_salidas,
    SUM(CASE WHEN ms.tipo_movimiento = 'ingreso' THEN ms.cantidad ELSE 0 END) as total_ingresos,
    AVG(CASE WHEN ms.tipo_movimiento = 'salida' THEN ms.cantidad ELSE NULL END) as promedio_salida
FROM movimientos_stock ms
JOIN lotes l ON ms.lote_id = l.id
JOIN productos pr ON l.producto_id = pr.id
WHERE ms.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY pr.categoria;

CREATE INDEX IF NOT EXISTS idx_mv_rotacion_categoria ON mv_rotacion_inventario(categoria);

-- ===========================================
-- MATERIALIZED VIEW: Eficiencia de Reparto
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_eficiencia_reparto AS
SELECT 
    DATE(rr.fecha_ruta) as fecha,
    rr.repartidor_id,
    COUNT(DISTINCT rr.id) as rutas_completadas,
    COUNT(dr.id) as total_entregas,
    COUNT(CASE WHEN dr.estado_entrega = 'entregado' THEN 1 END) as entregas_exitosas,
    SUM(rr.distancia_real_km) as km_totales,
    SUM(rr.tiempo_real_min) as tiempo_total_min,
    CASE 
        WHEN COUNT(dr.id) > 0 
        THEN (COUNT(CASE WHEN dr.estado_entrega = 'entregado' THEN 1 END)::float / COUNT(dr.id)) * 100
        ELSE 0
    END as tasa_exito,
    CASE 
        WHEN COUNT(dr.id) > 0 
        THEN SUM(rr.distancia_real_km) / COUNT(dr.id)
        ELSE 0
    END as km_por_entrega
FROM rutas_reparto rr
LEFT JOIN detalles_ruta dr ON rr.id = dr.ruta_id
WHERE rr.estado = 'completada'
  AND rr.fecha_ruta >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(rr.fecha_ruta), rr.repartidor_id;

CREATE INDEX IF NOT EXISTS idx_mv_eficiencia_fecha ON mv_eficiencia_reparto(fecha);
CREATE INDEX IF NOT EXISTS idx_mv_eficiencia_repartidor ON mv_eficiencia_reparto(repartidor_id);

-- ===========================================
-- MATERIALIZED VIEW: Recaudación por Método
-- ===========================================

-- Solo crear si existe la tabla tesoreria_movimientos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_movimientos') THEN
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_recaudacion_por_metodo AS
        SELECT 
            DATE(tm.created_at) as fecha,
            tm.metodo_pago,
            COUNT(*) as transacciones,
            SUM(tm.monto) as monto_total
        FROM tesoreria_movimientos tm
        WHERE tm.tipo = 'ingreso'
          AND tm.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(tm.created_at), tm.metodo_pago;

        CREATE INDEX IF NOT EXISTS idx_mv_recaudacion_fecha ON mv_recaudacion_por_metodo(fecha);
        CREATE INDEX IF NOT EXISTS idx_mv_recaudacion_metodo ON mv_recaudacion_por_metodo(metodo_pago);
    END IF;
END $$;

-- ===========================================
-- FUNCIÓN: Refrescar Materialized Views
-- ===========================================

CREATE OR REPLACE FUNCTION fn_refresh_materialized_views_reportes()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_ventas_diarias;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_critico;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rotacion_inventario;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_eficiencia_reparto;
    
    -- Solo refrescar si existe la materialized view
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_recaudacion_por_metodo') THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recaudacion_por_metodo;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON MATERIALIZED VIEW mv_kpis_ventas_diarias IS 'KPIs de ventas agrupados por día (refresh cada hora)';
COMMENT ON MATERIALIZED VIEW mv_stock_critico IS 'Productos con stock crítico (refresh cada 15 min)';
COMMENT ON MATERIALIZED VIEW mv_rotacion_inventario IS 'Rotación de inventario por categoría (refresh diario)';
COMMENT ON MATERIALIZED VIEW mv_eficiencia_reparto IS 'Eficiencia de reparto por fecha y repartidor (refresh cada hora)';
COMMENT ON MATERIALIZED VIEW mv_recaudacion_por_metodo IS 'Recaudación por método de pago (refresh cada hora)';
COMMENT ON FUNCTION fn_refresh_materialized_views_reportes IS 'Refresca todas las materialized views de reportes';

COMMIT;

