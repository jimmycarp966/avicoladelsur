-- ===========================================
-- MIGRACIÓN: Materialized Views para Reportes
-- Fecha: 16/12/2025
-- Objetivo: Crear vistas materializadas para KPIs pre-calculados
-- ===========================================

BEGIN;

-- ===========================================
-- MATERIALIZED VIEW: KPIs Ventas Diarias
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpis_ventas_diarias AS
SELECT 
    DATE(p.fecha_pedido) as fecha,
    COUNT(DISTINCT p.id) as total_pedidos,
    COUNT(DISTINCT p.id) FILTER (WHERE p.estado = 'entregado') as pedidos_entregados,
    COUNT(DISTINCT p.id) FILTER (WHERE p.estado = 'cancelado') as pedidos_cancelados,
    SUM(p.total) FILTER (WHERE p.estado = 'entregado') as total_ventas,
    AVG(p.total) FILTER (WHERE p.estado = 'entregado') as promedio_pedido,
    COUNT(DISTINCT p.cliente_id) FILTER (WHERE p.estado = 'entregado') as clientes_unicos,
    COALESCE(SUM(tm.monto) FILTER (WHERE p.estado = 'entregado' AND tm.metodo_pago = 'efectivo'), 0) as ventas_efectivo,
    COALESCE(SUM(tm.monto) FILTER (WHERE p.estado = 'entregado' AND tm.metodo_pago = 'transferencia'), 0) as ventas_transferencia,
    COALESCE(SUM(tm.monto) FILTER (WHERE p.estado = 'entregado' AND tm.metodo_pago = 'cuenta_corriente'), 0) as ventas_cuenta_corriente
FROM pedidos p
LEFT JOIN tesoreria_movimientos tm ON tm.origen_tipo = 'pedido' AND tm.origen_id = p.id AND tm.tipo = 'ingreso'
WHERE p.fecha_pedido >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(p.fecha_pedido)
ORDER BY fecha DESC;

-- Índice único para la vista materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpis_ventas_diarias_fecha 
  ON mv_kpis_ventas_diarias(fecha);

-- ===========================================
-- MATERIALIZED VIEW: KPIs Ventas Mensuales
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpis_ventas_mensuales AS
SELECT 
    DATE_TRUNC('month', fecha_pedido)::DATE as mes,
    COUNT(*) as total_pedidos,
    COUNT(*) FILTER (WHERE estado = 'entregado') as pedidos_entregados,
    SUM(total) FILTER (WHERE estado = 'entregado') as total_ventas,
    AVG(total) FILTER (WHERE estado = 'entregado') as promedio_pedido,
    COUNT(DISTINCT cliente_id) FILTER (WHERE estado = 'entregado') as clientes_unicos,
    COUNT(DISTINCT zona_id) FILTER (WHERE estado = 'entregado') as zonas_activas
FROM pedidos
WHERE fecha_pedido >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY DATE_TRUNC('month', fecha_pedido)
ORDER BY mes DESC;

-- Índice único para la vista materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpis_ventas_mensuales_mes 
  ON mv_kpis_ventas_mensuales(mes);

-- ===========================================
-- FUNCIÓN: Refrescar Materialized Views
-- ===========================================

-- Eliminar función existente con todas las firmas posibles
-- La función anterior puede retornar void, necesitamos eliminarla primero
DO $$
DECLARE
    v_func_signature TEXT;
BEGIN
    -- Buscar y eliminar todas las versiones de la función
    FOR v_func_signature IN 
        SELECT pg_get_function_identity_arguments(oid) 
        FROM pg_proc 
        WHERE proname = 'fn_refresh_materialized_views_reportes'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS fn_refresh_materialized_views_reportes(%s) CASCADE', v_func_signature);
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Si no existe, continuar
        NULL;
END $$;

CREATE OR REPLACE FUNCTION fn_refresh_materialized_views_reportes()
RETURNS JSONB AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_ventas_diarias;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_ventas_mensuales;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Materialized views refreshed successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Para activar refresh automático con pg_cron (si está disponible):
-- SELECT cron.schedule('refresh-kpis-ventas', '0 * * * *', 'SELECT fn_refresh_materialized_views_reportes()');

COMMIT;

