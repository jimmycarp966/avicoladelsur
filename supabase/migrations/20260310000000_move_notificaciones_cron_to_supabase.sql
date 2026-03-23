-- ===========================================
-- MIGRACION: Mover cron de notificaciones a Supabase
-- Fecha: 2026-03-10
-- Objetivo:
--   1. Sacar el scheduler de Vercel para destrabar deploys.
--   2. Programar pg_cron en Supabase cada 5 minutos.
--   3. Llamar al endpoint de produccion con un secret guardado en Vault.
-- ===========================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE OR REPLACE FUNCTION public.fn_ensure_cron_secret(
  p_job_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_secret text;
BEGIN
  SELECT id
  INTO v_secret_id
  FROM vault.decrypted_secrets
  WHERE name = p_job_name
  LIMIT 1;

  IF v_secret_id IS NOT NULL THEN
    RETURN v_secret_id;
  END IF;

  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  SELECT vault.create_secret(
    v_secret,
    p_job_name,
    COALESCE(p_description, 'Secret para job cron ' || p_job_name),
    NULL
  )
  INTO v_secret_id;

  RETURN v_secret_id;
END;
$$;

COMMENT ON FUNCTION public.fn_ensure_cron_secret(text, text)
IS 'Crea un secret para jobs de cron en Vault si no existe';

CREATE OR REPLACE FUNCTION public.fn_validar_cron_secret(
  p_job_name text,
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN false;
  END IF;

  SELECT decrypted_secret
  INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_job_name
  LIMIT 1;

  RETURN v_secret IS NOT NULL AND v_secret = p_token;
END;
$$;

COMMENT ON FUNCTION public.fn_validar_cron_secret(text, text)
IS 'Valida el bearer token de un job cron contra Vault';

REVOKE ALL ON FUNCTION public.fn_validar_cron_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_validar_cron_secret(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_disparar_cron_notificaciones_http()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  PERFORM public.fn_ensure_cron_secret(
    'cron_notificaciones_proactivas',
    'Bearer token para el cron de notificaciones proactivas'
  );

  SELECT decrypted_secret
  INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_notificaciones_proactivas'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener el secret del cron de notificaciones';
  END IF;

  SELECT net.http_get(
    url := 'https://avicoladelsur.vercel.app/api/cron/notificaciones',
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 10000
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.fn_disparar_cron_notificaciones_http()
IS 'Invoca el endpoint productivo de notificaciones usando pg_net y Vault';

DO $do$
BEGIN
  PERFORM public.fn_ensure_cron_secret(
    'cron_notificaciones_proactivas',
    'Bearer token para el cron de notificaciones proactivas'
  );

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'cron'
      AND table_name = 'job'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'cron_notificaciones_proactivas'
    ) THEN
      PERFORM cron.unschedule(
        (SELECT jobid FROM cron.job WHERE jobname = 'cron_notificaciones_proactivas' LIMIT 1)
      );
    END IF;

    PERFORM cron.schedule(
      'cron_notificaciones_proactivas',
      '*/5 * * * *',
      $job$SELECT public.fn_disparar_cron_notificaciones_http();$job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo programar cron_notificaciones_proactivas: %', SQLERRM;
END;
$do$;

COMMIT;
