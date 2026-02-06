-- ===========================================
-- FIX RLS - Permitir que almacenistas vean presupuestos
-- Fecha: 2025-02-05
-- ===========================================

-- Los almacenistas necesitan ver presupuestos para poder trabajar en
-- "Presupuestos del Día" y "En Preparación"

-- Reemplazar política de SELECT de presupuestos para incluir almacenista
DROP POLICY IF EXISTS "vendedor_presupuestos_zona" ON presupuestos;

CREATE POLICY "almacenista_presupuestos_select"
ON presupuestos
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol IN ('admin', 'almacenista', 'vendedor')
    AND usuarios.activo = true
  )
);

-- Reemplazar política de SELECT de presupuesto_items para incluir almacenista
DROP POLICY IF EXISTS "vendedor_presupuesto_items" ON presupuesto_items;

CREATE POLICY "almacenista_presupuesto_items_select"
ON presupuesto_items
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN presupuestos p ON p.id = presupuesto_items.presupuesto_id
    WHERE u.id = auth.uid()
    AND u.rol IN ('admin', 'almacenista', 'vendedor')
    AND u.activo = true
  )
);
