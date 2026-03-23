-- ===========================================
-- MIGRACIÓN: Activar Expiración Automática de Reservas
-- Fecha: 16/12/2025
-- Objetivo: Activar job de pg_cron para expirar reservas automáticamente
-- ===========================================

BEGIN;

-- Verificar si pg_cron está disponible
DO $$
BEGIN
    -- Intentar crear el job de pg_cron
    -- Si pg_cron no está disponible, esto fallará silenciosamente
    BEGIN
        -- Eliminar job existente si existe
        PERFORM cron.unschedule('expirar-reservas-stock');
        
        -- Crear nuevo job que se ejecuta cada 15 minutos
        PERFORM cron.schedule(
            'expirar-reservas-stock',
            '*/15 * * * *', -- Cada 15 minutos
            'SELECT fn_expirar_reservas()'
        );
        
        RAISE NOTICE 'Job de expiración de reservas configurado exitosamente';
    EXCEPTION
        WHEN OTHERS THEN
            -- Si pg_cron no está disponible, registrar en log
            RAISE NOTICE 'pg_cron no está disponible. Crear endpoint API para ejecutar fn_expirar_reservas() periódicamente.';
    END;
END $$;

-- Nota: Si pg_cron no está disponible en Supabase, se debe crear un endpoint API
-- que se ejecute periódicamente (por ejemplo, usando un servicio externo como cron-job.org)
-- o usando Vercel Cron Jobs si la aplicación está desplegada en Vercel

COMMIT;

