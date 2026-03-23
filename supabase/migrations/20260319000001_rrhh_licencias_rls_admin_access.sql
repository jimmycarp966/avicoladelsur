BEGIN;

ALTER TABLE public.rrhh_licencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on rrhh_licencias" ON public.rrhh_licencias;

CREATE POLICY "Admin full access on rrhh_licencias"
ON public.rrhh_licencias
FOR ALL
USING (auth.jwt() ->> 'rol' = 'admin')
WITH CHECK (auth.jwt() ->> 'rol' = 'admin');

COMMIT;
