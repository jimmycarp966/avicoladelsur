-- ============================================
-- AUDITORÍA AUTOMÁTICA DE COBROS CON pg_cron
-- ============================================
-- Este script configura una auditoría automática que:
-- 1. Analiza cobros de las últimas 4 horas
-- 2. Detecta anomalías (montos inusuales, horarios, frecuencia)
-- 3. Crea notificaciones para administradores
-- 
-- EJECUTAR EN: Supabase SQL Editor
-- ============================================

-- Paso 1: Habilitar la extensión pg_cron (si no está habilitada)
-- Ve a Database > Extensions > Busca "pg_cron" > Enable
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Paso 2: Crear la función de auditoría
CREATE OR REPLACE FUNCTION fn_auditar_cobros_automatico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cobro RECORD;
    promedio_usuario NUMERIC;
    max_usuario NUMERIC;
    cobros_hora INT;
    horas_atras INTERVAL := '4 hours';
BEGIN
    FOR cobro IN 
        SELECT 
            tm.id, tm.monto, tm.created_at, tm.user_id, tm.sucursal_id,
            u.nombre || ' ' || COALESCE(u.apellido, '') AS usuario_nombre,
            COALESCE(s.nombre, 'Central') AS sucursal_nombre
        FROM tesoreria_movimientos tm
        LEFT JOIN usuarios u ON u.id = tm.user_id
        LEFT JOIN sucursales s ON s.id = tm.sucursal_id
        WHERE tm.tipo = 'ingreso' AND tm.created_at >= NOW() - horas_atras
    LOOP
        SELECT COALESCE(AVG(monto), 0), COALESCE(MAX(monto), 0)
        INTO promedio_usuario, max_usuario
        FROM tesoreria_movimientos
        WHERE user_id = cobro.user_id AND tipo = 'ingreso' AND created_at >= NOW() - INTERVAL '30 days';
        
        -- REGLA 1: Monto 3x mayor al promedio y > $50,000
        IF cobro.monto > promedio_usuario * 3 AND cobro.monto > 50000 THEN
            INSERT INTO notificaciones (tipo, titulo, mensaje, metadata, leida)
            VALUES ('warning', '⚠️ Monto inusual', 
                format('Cobro $%s por %s en %s', to_char(cobro.monto, 'FM999,999,999'), cobro.usuario_nombre, cobro.sucursal_nombre),
                jsonb_build_object('cobroId', cobro.id, 'tipoAnomalia', 'monto_inusual', 'monto', cobro.monto), false);
        END IF;
        
        -- REGLA 2: Horario inusual (antes 6am o después 10pm)
        IF EXTRACT(HOUR FROM cobro.created_at) < 6 OR EXTRACT(HOUR FROM cobro.created_at) >= 22 THEN
            INSERT INTO notificaciones (tipo, titulo, mensaje, metadata, leida)
            VALUES ('warning', '🌙 Horario inusual', 
                format('Cobro $%s a las %s', to_char(cobro.monto, 'FM999,999,999'), to_char(cobro.created_at, 'HH24:MI')),
                jsonb_build_object('cobroId', cobro.id, 'tipoAnomalia', 'horario_inusual'), false);
        END IF;
        
        -- REGLA 3: Frecuencia alta (>20 cobros en última hora por usuario)
        SELECT COUNT(*) INTO cobros_hora FROM tesoreria_movimientos 
        WHERE user_id = cobro.user_id AND tipo = 'ingreso' AND created_at >= NOW() - INTERVAL '1 hour';
        
        IF cobros_hora > 20 THEN
            INSERT INTO notificaciones (tipo, titulo, mensaje, metadata, leida)
            VALUES ('warning', '📈 Frecuencia alta', 
                format('%s cobros en 1 hora por %s', cobros_hora, cobro.usuario_nombre),
                jsonb_build_object('tipoAnomalia', 'frecuencia_alta', 'cantidad', cobros_hora), false);
        END IF;
    END LOOP;
END;
$$;

-- Paso 3: Programar el cron job (cada 4 horas) - NOTA: pg_cron usa UTC
SELECT cron.schedule(
    'auditar-cobros-automatico',
    '0 */4 * * *',
    'SELECT fn_auditar_cobros_automatico();'
);

-- ============================================
-- COMANDOS ÚTILES
-- ============================================
-- Ver jobs programados:
-- SELECT * FROM cron.job;

-- Ver historial de ejecuciones:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Ejecutar manualmente:
-- SELECT fn_auditar_cobros_automatico();

-- Eliminar job:
-- SELECT cron.unschedule('auditar-cobros-automatico');
