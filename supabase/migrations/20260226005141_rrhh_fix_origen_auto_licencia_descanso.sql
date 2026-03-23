BEGIN;

ALTER TABLE public.rrhh_liquidacion_jornadas
  ALTER COLUMN origen TYPE VARCHAR(40);

ALTER TABLE public.rrhh_liquidacion_jornadas
  DROP CONSTRAINT IF EXISTS rrhh_liquidacion_jornadas_origen_check;

ALTER TABLE public.rrhh_liquidacion_jornadas
  ADD CONSTRAINT rrhh_liquidacion_jornadas_origen_check
  CHECK (
    origen IN ('auto_hik', 'auto_asistencia', 'auto_licencia_descanso', 'manual')
  );

COMMIT;;
