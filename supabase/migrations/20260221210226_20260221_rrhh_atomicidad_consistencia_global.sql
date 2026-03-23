-- RRHH atomicidad: consistencia entre asistencia, jornadas y liquidaciones
-- 1) Normaliza turnos legacy.
-- 2) Fuerza que en sucursales las horas adicionales sean informativas (sin monto).
-- 3) Backfill de datos existentes para alinear detalle vs cabecera.

-- Normalizar valores legacy en asistencia.
UPDATE public.rrhh_asistencia
SET turno = CASE
  WHEN lower(coalesce(turno, '')) IN ('manana', 'mañana') THEN 'medio_turno_manana'
  WHEN lower(coalesce(turno, '')) = 'tarde' THEN 'medio_turno_tarde'
  ELSE turno
END
WHERE lower(coalesce(turno, '')) IN ('manana', 'mañana', 'tarde');

-- Normalizar valores legacy en jornadas.
UPDATE public.rrhh_liquidacion_jornadas
SET turno = CASE
  WHEN lower(coalesce(turno, '')) IN ('manana', 'mañana') THEN 'medio_turno_manana'
  WHEN lower(coalesce(turno, '')) = 'tarde' THEN 'medio_turno_tarde'
  ELSE turno
END
WHERE lower(coalesce(turno, '')) IN ('manana', 'mañana', 'tarde');

CREATE OR REPLACE FUNCTION public.fn_rrhh_enforce_jornada_atomicidad()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_group text;
BEGIN
  -- Normalizar turnos legacy en escritura.
  IF lower(coalesce(NEW.turno, '')) IN ('manana', 'mañana') THEN
    NEW.turno := 'medio_turno_manana';
  ELSIF lower(coalesce(NEW.turno, '')) = 'tarde' THEN
    NEW.turno := 'medio_turno_tarde';
  END IF;

  -- En sucursales, hs adicionales son informativas: tarifa extra = 0.
  IF NEW.liquidacion_id IS NOT NULL THEN
    SELECT regla.grupo_base_dias
    INTO v_group
    FROM public.rrhh_liquidaciones l
    LEFT JOIN LATERAL public.fn_rrhh_resolver_regla_puesto(
      l.empleado_id,
      l.periodo_mes,
      l.periodo_anio,
      l.puesto_override
    ) regla ON true
    WHERE l.id = NEW.liquidacion_id;

    IF coalesce(v_group, 'galpon') = 'sucursales' THEN
      NEW.tarifa_hora_extra := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_rrhh_enforce_jornada_atomicidad ON public.rrhh_liquidacion_jornadas;
CREATE TRIGGER trg_rrhh_enforce_jornada_atomicidad
BEFORE INSERT OR UPDATE ON public.rrhh_liquidacion_jornadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_rrhh_enforce_jornada_atomicidad();

-- Backfill monetario: sucursales con hs adicionales no deben computar monto extra.
UPDATE public.rrhh_liquidacion_jornadas j
SET tarifa_hora_extra = 0,
    updated_at = now()
FROM public.rrhh_liquidaciones l
LEFT JOIN LATERAL public.fn_rrhh_resolver_regla_puesto(
  l.empleado_id,
  l.periodo_mes,
  l.periodo_anio,
  l.puesto_override
) regla ON true
WHERE j.liquidacion_id = l.id
  AND coalesce(regla.grupo_base_dias, 'galpon') = 'sucursales'
  AND coalesce(j.tarifa_hora_extra, 0) <> 0;;
