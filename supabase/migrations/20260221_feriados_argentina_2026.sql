BEGIN;

-- Feriados nacionales oficiales de Argentina para 2026
-- Fuente:
-- - Calendario oficial de días inhábiles 2026 (TRIBUNAL FISCAL DE LA NACIÓN)
-- - Resolución 164/2025 (días no laborables con fines turísticos, NO incluidos aquí)
-- Se cargan únicamente feriados nacionales.

WITH feriados_2026(fecha, descripcion) AS (
  VALUES
    ('2026-01-01'::date, 'Año Nuevo'),
    ('2026-02-16'::date, 'Carnaval'),
    ('2026-02-17'::date, 'Carnaval'),
    ('2026-03-24'::date, 'Día Nacional de la Memoria por la Verdad y la Justicia'),
    ('2026-04-02'::date, 'Día del Veterano y de los Caídos en la Guerra de Malvinas'),
    ('2026-04-03'::date, 'Viernes Santo'),
    ('2026-05-01'::date, 'Día del Trabajador'),
    ('2026-05-25'::date, 'Día de la Revolución de Mayo'),
    ('2026-06-15'::date, 'Paso a la Inmortalidad del General Martín Miguel de Güemes (trasladado del 17/06)'),
    ('2026-06-20'::date, 'Paso a la Inmortalidad del General Manuel Belgrano'),
    ('2026-07-09'::date, 'Día de la Independencia'),
    ('2026-08-17'::date, 'Paso a la Inmortalidad del General José de San Martín'),
    ('2026-10-12'::date, 'Día del Respeto a la Diversidad Cultural'),
    ('2026-11-23'::date, 'Día de la Soberanía Nacional (trasladado del 20/11)'),
    ('2026-12-08'::date, 'Inmaculada Concepción de María'),
    ('2026-12-25'::date, 'Navidad')
)
INSERT INTO rrhh_feriados (fecha, descripcion, ambito, activo, updated_at)
SELECT fecha, descripcion, 'nacional', true, NOW()
FROM feriados_2026
ON CONFLICT (fecha) DO UPDATE
SET
  descripcion = EXCLUDED.descripcion,
  ambito = EXCLUDED.ambito,
  activo = true,
  updated_at = NOW();

COMMIT;
