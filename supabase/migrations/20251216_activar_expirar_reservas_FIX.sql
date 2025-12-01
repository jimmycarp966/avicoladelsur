-- ===========================================
-- MIGRACIÓN: Activar Expiración Automática de Reservas (FIX)
-- Fecha: 16/12/2025
-- Objetivo: Crear job de pg_cron para expirar reservas automáticamente
-- ===========================================

-- Crear job de pg_cron para expirar reservas automáticamente
-- Solo crea el job si no existe

DO $$
BEGIN
    -- Verificar si el job ya existe
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'expirar-reservas-stock'
    ) THEN
        -- Crear nuevo job que se ejecuta cada 15 minutos
        PERFORM cron.schedule(
            'expirar-reservas-stock',
            '*/15 * * * *', -- Cada 15 minutos
            'SELECT fn_expirar_reservas()'
        );
        RAISE NOTICE 'Job expirar-reservas-stock creado exitosamente';
    ELSE
        RAISE NOTICE 'Job expirar-reservas-stock ya existe';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error al crear job: %', SQLERRM;
END $$;

-- Verificar que se creó correctamente
SELECT 
    jobid,
    schedule,
    command,
    jobname,
    active
FROM cron.job 
WHERE jobname = 'expirar-reservas-stock';

