BEGIN;

ALTER TABLE public.rrhh_adelantos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_adelantos" ON public.rrhh_adelantos;

CREATE POLICY "Admin full access on rrhh_adelantos"
ON public.rrhh_adelantos
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol = 'admin'
      AND u.activo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol = 'admin'
      AND u.activo = true
  )
);

COMMIT;
