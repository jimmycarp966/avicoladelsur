BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'rrhh-licencias',
  'rrhh-licencias',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = now();

INSERT INTO public.rrhh_liquidacion_reglas_periodo (
  periodo_mes,
  periodo_anio,
  dias_base_galpon,
  dias_base_sucursales,
  dias_base_rrhh,
  activo
)
VALUES (
  3,
  2026,
  27,
  31,
  22,
  true
)
ON CONFLICT (periodo_mes, periodo_anio) DO UPDATE
SET
  dias_base_galpon = EXCLUDED.dias_base_galpon,
  dias_base_sucursales = EXCLUDED.dias_base_sucursales,
  dias_base_rrhh = EXCLUDED.dias_base_rrhh,
  activo = EXCLUDED.activo,
  updated_at = now();

COMMIT;
