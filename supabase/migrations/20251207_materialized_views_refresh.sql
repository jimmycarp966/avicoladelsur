-- ===========================================
-- MIGRACIÓN: CONFIGURACIÓN DE REFRESH AUTOMÁTICO
-- Fecha: 07/12/2025
-- Objetivo: Configurar pg_cron para refrescar materialized views
-- ===========================================

BEGIN;

-- ===========================================
-- HABILITAR EXTENSIÓN PG_CRON (si no está habilitada)
-- ===========================================
-- NOTA: En Supabase, pg_cron solo está disponible en planes Pro+
-- Si no está disponible, los refresh deberán hacerse manualmente

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ===========================================
-- CONFIGURAR JOBS DE PG_CRON
-- ===========================================

-- Limpiar jobs existentes de reportes (si existen)
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname LIKE 'refresh_mv_%';

-- Job 1: Refresh mv_kpis_ventas_diarias (cada hora)
SELECT cron.schedule(
    'refresh_mv_kpis_ventas_diarias',
    '0 * * * *',  -- Cada hora en punto
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_ventas_diarias$$
);

-- Job 2: Refresh mv_stock_critico (cada 15 minutos)
SELECT cron.schedule(
    'refresh_mv_stock_critico',
    '*/15 * * * *',  -- Cada 15 minutos
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_critico$$
);

-- Job 3: Refresh mv_rotacion_inventario (cada 24 horas a las 2 AM)
SELECT cron.schedule(
    'refresh_mv_rotacion_inventario',
    '0 2 * * *',  -- Diario a las 2 AM
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rotacion_inventario$$
);

-- Job 4: Refresh mv_eficiencia_reparto (cada hora)
SELECT cron.schedule(
    'refresh_mv_eficiencia_reparto',
    '0 * * * *',  -- Cada hora en punto
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_eficiencia_reparto$$
);

-- Job 5: Refresh mv_recaudacion_por_metodo (cada hora) - solo si existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_recaudacion_por_metodo') THEN
        PERFORM cron.schedule(
            'refresh_mv_recaudacion_por_metodo',
            '0 * * * *',  -- Cada hora en punto
            'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recaudacion_por_metodo'
        );
    END IF;
END $$;

-- ===========================================
-- FUNCIÓN ALTERNATIVA: Manual Refresh
-- ===========================================
-- Para usar en entornos sin pg_cron o para refresh manual

CREATE OR REPLACE FUNCTION fn_refresh_all_report_views()
RETURNS TEXT AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_duration INTERVAL;
    v_result TEXT := '';
BEGIN
    v_start_time := clock_timestamp();
    
    -- Refresh cada view y capturar errores
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_ventas_diarias;
        v_result := v_result || 'mv_kpis_ventas_diarias: OK' || chr(10);
    EXCEPTION WHEN OTHERS THEN
        v_result := v_result || 'mv_kpis_ventas_diarias: ERROR - ' || SQLERRM || chr(10);
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_critico;
        v_result := v_result || 'mv_stock_critico: OK' || chr(10);
    EXCEPTION WHEN OTHERS THEN
        v_result := v_result || 'mv_stock_critico: ERROR - ' || SQLERRM || chr(10);
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rotacion_inventario;
        v_result := v_result || 'mv_rotacion_inventario: OK' || chr(10);
    EXCEPTION WHEN OTHERS THEN
        v_result := v_result || 'mv_rotacion_inventario: ERROR - ' || SQLERRM || chr(10);
    END;
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_eficiencia_reparto;
        v_result := v_result || 'mv_eficiencia_reparto: OK' || chr(10);
    EXCEPTION WHEN OTHERS THEN
        v_result := v_result || 'mv_eficiencia_reparto: ERROR - ' || SQLERRM || chr(10);
    END;
    
    -- Solo si existe
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_recaudacion_por_metodo') THEN
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recaudacion_por_metodo;
            v_result := v_result || 'mv_recaudacion_por_metodo: OK' || chr(10);
        EXCEPTION WHEN OTHERS THEN
            v_result := v_result || 'mv_recaudacion_por_metodo: ERROR - ' || SQLERRM || chr(10);
        END;
    END IF;
    
    v_duration := clock_timestamp() - v_start_time;
    v_result := v_result || chr(10) || 'Duration: ' || v_duration::TEXT;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- INFORMACIÓN Y MONITOREO
-- ===========================================

COMMENT ON FUNCTION fn_refresh_all_report_views IS 'Refresca manualmente todas las materialized views de reportes. Útil para entornos sin pg_cron o refresh bajo demanda.';

-- Query para ver jobs activos:
-- SELECT * FROM cron.job WHERE jobname LIKE 'refresh_mv_%';

-- Query para ver ejecuciones pasadas:
-- SELECT * FROM cron.job_run_details WHERE jobname LIKE 'refresh_mv_%' ORDER BY start_time DESC LIMIT 20;

COMMIT;

-- ===========================================
-- NOTAS POST-MIGRACIÓN
-- ===========================================
-- 
-- 1. Si pg_cron no está disponible (plan Supabase gratuito):
--    - Ejecutar manualmente: SELECT fn_refresh_all_report_views();
--    - O configurar un webhook/cron externo que llame a una API route
--
-- 2. Monitorear jobs:
--    SELECT * FROM cron.job;
-- 
-- 3. Ver logs de ejecución:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
--
-- ===========================================
