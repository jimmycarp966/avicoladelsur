-- RRHH/HikConnect: mapa persistente de codigos Hik -> rrhh_empleados

CREATE TABLE IF NOT EXISTS public.rrhh_hik_person_map (
  hik_code text PRIMARY KEY,
  empleado_id uuid NOT NULL REFERENCES public.rrhh_empleados(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_hik_person_map_empleado
  ON public.rrhh_hik_person_map(empleado_id);

ALTER TABLE public.rrhh_hik_person_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_hik_person_map" ON public.rrhh_hik_person_map;
CREATE POLICY "Admin full access on rrhh_hik_person_map"
ON public.rrhh_hik_person_map
FOR ALL
USING (auth.jwt() ->> 'rol' = 'admin')
WITH CHECK (auth.jwt() ->> 'rol' = 'admin');

DO $$
DECLARE
  v_categoria_produccion uuid;
  v_sucursal_central uuid;
  v_zoe_id uuid;
  v_legajo_num integer;
  v_legajo text;
BEGIN
  SELECT c.id
  INTO v_categoria_produccion
  FROM public.rrhh_categorias c
  WHERE lower(c.nombre) LIKE 'produ%ci%n'
  ORDER BY CASE WHEN lower(c.nombre) = 'produccion' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT s.id
  INTO v_sucursal_central
  FROM public.sucursales s
  WHERE lower(s.nombre) = 'casa central'
  LIMIT 1;

  UPDATE public.rrhh_empleados e
  SET
    categoria_id = COALESCE(e.categoria_id, v_categoria_produccion),
    sucursal_id = COALESCE(e.sucursal_id, v_sucursal_central),
    activo = true,
    updated_at = now()
  WHERE e.legajo = 'EMP022';

  SELECT e.id
  INTO v_zoe_id
  FROM public.rrhh_empleados e
  WHERE upper(trim(COALESCE(e.nombre, ''))) = 'ZOE'
    AND upper(trim(COALESCE(e.apellido, ''))) = 'TULA'
  ORDER BY e.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_zoe_id IS NULL THEN
    SELECT COALESCE(MAX(
      CASE
        WHEN upper(COALESCE(e.legajo, '')) ~ '^EMP[0-9]+$'
        THEN substring(upper(e.legajo) FROM 4)::integer
        ELSE NULL
      END
    ), 0) + 1
    INTO v_legajo_num
    FROM public.rrhh_empleados e;

    v_legajo := 'EMP' || lpad(v_legajo_num::text, 3, '0');

    INSERT INTO public.rrhh_empleados (
      legajo,
      nombre,
      apellido,
      fecha_ingreso,
      categoria_id,
      sucursal_id,
      activo
    )
    VALUES (
      v_legajo,
      'Zoe',
      'Tula',
      CURRENT_DATE,
      v_categoria_produccion,
      v_sucursal_central,
      true
    )
    RETURNING id INTO v_zoe_id;
  ELSE
    UPDATE public.rrhh_empleados e
    SET
      categoria_id = COALESCE(e.categoria_id, v_categoria_produccion),
      sucursal_id = COALESCE(e.sucursal_id, v_sucursal_central),
      activo = true,
      updated_at = now()
    WHERE e.id = v_zoe_id;
  END IF;

  INSERT INTO public.rrhh_hik_person_map (hik_code, empleado_id, source, notes, updated_at)
  SELECT '6012991911', e.id, 'seed', 'Adriana Herrera (DNI 42122567)', now()
  FROM public.rrhh_empleados e
  WHERE e.dni = '42122567'
  LIMIT 1
  ON CONFLICT (hik_code)
  DO UPDATE SET empleado_id = EXCLUDED.empleado_id, source = EXCLUDED.source, notes = EXCLUDED.notes, updated_at = now();

  INSERT INTO public.rrhh_hik_person_map (hik_code, empleado_id, source, notes, updated_at)
  SELECT '1325880743', e.id, 'seed', 'Mapeado a EMP010', now()
  FROM public.rrhh_empleados e
  WHERE e.legajo = 'EMP010'
  LIMIT 1
  ON CONFLICT (hik_code)
  DO UPDATE SET empleado_id = EXCLUDED.empleado_id, source = EXCLUDED.source, notes = EXCLUDED.notes, updated_at = now();

  INSERT INTO public.rrhh_hik_person_map (hik_code, empleado_id, source, notes, updated_at)
  SELECT '6850259015', e.id, 'seed', 'Alias historico de EMP022', now()
  FROM public.rrhh_empleados e
  WHERE e.legajo = 'EMP022'
  LIMIT 1
  ON CONFLICT (hik_code)
  DO UPDATE SET empleado_id = EXCLUDED.empleado_id, source = EXCLUDED.source, notes = EXCLUDED.notes, updated_at = now();

  INSERT INTO public.rrhh_hik_person_map (hik_code, empleado_id, source, notes, updated_at)
  SELECT '4949679371', e.id, 'seed', 'Alias actual de EMP022 (Valentin Costilla/Cotilla)', now()
  FROM public.rrhh_empleados e
  WHERE e.legajo = 'EMP022'
  LIMIT 1
  ON CONFLICT (hik_code)
  DO UPDATE SET empleado_id = EXCLUDED.empleado_id, source = EXCLUDED.source, notes = EXCLUDED.notes, updated_at = now();

  IF v_zoe_id IS NOT NULL THEN
    INSERT INTO public.rrhh_hik_person_map (hik_code, empleado_id, source, notes, updated_at)
    VALUES ('6338238328', v_zoe_id, 'seed', 'Alta automatica Zoe Tula', now())
    ON CONFLICT (hik_code)
    DO UPDATE SET empleado_id = EXCLUDED.empleado_id, source = EXCLUDED.source, notes = EXCLUDED.notes, updated_at = now();
  END IF;
END $$;
