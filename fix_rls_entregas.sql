-- Habilitar RLS en la tabla entregas si no está habilitado
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;

-- Crear política para permitir lectura a usuarios autenticados
-- Esto es necesario para que los repartidores puedan ver las entregas de sus rutas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver entregas" ON entregas;

CREATE POLICY "Usuarios autenticados pueden ver entregas"
ON entregas FOR SELECT
TO authenticated
USING (true);

-- También asegurarnos que puedan actualizar estados de sus entregas (checkin, checkout, pagos)
DROP POLICY IF EXISTS "Repartidores pueden actualizar entregas" ON entregas;

CREATE POLICY "Repartidores pueden actualizar entregas"
ON entregas FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
