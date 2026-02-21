-- RRHH LIQUIDACIONES - NORMALIZAR "PUESTO DEL DIA" EN JORNADAS AUTO

CREATE OR REPLACE FUNCTION public.fn_rrhh_resolver_tarea_default_jornada(
  p_liquidacion_id UUID,
  p_empleado_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_tarea TEXT;
BEGIN
  SELECT
    COALESCE(
      NULLIF(BTRIM(l.puesto_override), ''),
      NULLIF(BTRIM(c.nombre), ''),
      NULLIF(BTRIM(c2.nombre), ''),
      'General'
    )
  INTO v_tarea
  FROM rrhh_liquidaciones l
  LEFT JOIN rrhh_empleados e ON e.id = l.empleado_id
  LEFT JOIN rrhh_categorias c ON c.id = e.categoria_id
  LEFT JOIN rrhh_empleados e2 ON e2.id = p_empleado_id
  LEFT JOIN rrhh_categorias c2 ON c2.id = e2.categoria_id
  WHERE l.id = p_liquidacion_id;

  RETURN COALESCE(v_tarea, 'General');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_rrhh_normalizar_tarea_jornada_auto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tarea_norm TEXT;
BEGIN
  IF NEW.origen IN ('auto_hik', 'auto_asistencia') THEN
    v_tarea_norm := LOWER(BTRIM(COALESCE(NEW.tarea, '')));

    IF v_tarea_norm = ''
       OR v_tarea_norm = 'asistencia diaria'
       OR v_tarea_norm = 'sincronizado'
       OR v_tarea_norm = 'sincronizado desde hikconnect'
       OR v_tarea_norm LIKE 'sincronizado%' THEN
      NEW.tarea := public.fn_rrhh_resolver_tarea_default_jornada(NEW.liquidacion_id, NEW.empleado_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rrhh_normalizar_tarea_jornada_auto
ON rrhh_liquidacion_jornadas;

CREATE TRIGGER trg_rrhh_normalizar_tarea_jornada_auto
BEFORE INSERT OR UPDATE ON rrhh_liquidacion_jornadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_rrhh_normalizar_tarea_jornada_auto();

-- Backfill de jornadas existentes con texto genérico de sincronización.
UPDATE rrhh_liquidacion_jornadas j
SET tarea = public.fn_rrhh_resolver_tarea_default_jornada(j.liquidacion_id, j.empleado_id)
WHERE j.origen IN ('auto_hik', 'auto_asistencia')
  AND (
    BTRIM(COALESCE(j.tarea, '')) = ''
    OR LOWER(BTRIM(j.tarea)) = 'asistencia diaria'
    OR LOWER(BTRIM(j.tarea)) = 'sincronizado'
    OR LOWER(BTRIM(j.tarea)) = 'sincronizado desde hikconnect'
    OR LOWER(BTRIM(j.tarea)) LIKE 'sincronizado%'
  );

COMMENT ON FUNCTION public.fn_rrhh_normalizar_tarea_jornada_auto()
IS 'Normaliza tareas automáticas RRHH para mostrar puesto del día en lugar de textos de sincronización.';
