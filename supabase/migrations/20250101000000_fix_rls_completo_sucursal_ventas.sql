-- ===========================================
-- FIX COMPLETO: Corregir políticas RLS para sucursal/ventas
-- Fecha: 2025-01-01
-- Problema: Usuarios con sucursal asignada no pueden leer pedidos, clientes y cajas
-- Solución: Asegurar que las políticas permitan acceso basado en rol y sucursal
-- ===========================================

-- Verificar que las funciones helper existen
-- Usamos CREATE OR REPLACE directamente (no falla si ya existen)

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $func_role$
BEGIN
  RETURN (
    SELECT rol FROM usuarios WHERE id = auth.uid()
  );
END;
$func_role$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_sucursal_id()
RETURNS UUID AS $func_sucursal$
BEGIN
  RETURN (
    SELECT e.sucursal_id 
    FROM rrhh_empleados e 
    WHERE e.usuario_id = auth.uid()
    LIMIT 1
  );
END;
$func_sucursal$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- PEDIDOS: Corregir políticas para permitir acceso a vendedores
-- ===========================================

-- Eliminar políticas conflictivas
DROP POLICY IF EXISTS "sucursal_access_pedidos" ON pedidos;

-- Crear política que permite acceso si:
-- 1. El usuario es admin
-- 2. El usuario es vendedor (sin restricción de sucursal)
-- 3. El pedido tiene sucursal_id y coincide con la sucursal del usuario
CREATE POLICY "sucursal_access_pedidos" ON pedidos
  FOR SELECT
  USING (
    get_user_role() = 'admin' OR
    (
      EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND rol = 'vendedor' 
        AND activo = true
      )
    ) OR
    (
      sucursal_id IS NOT NULL AND 
      sucursal_id = get_user_sucursal_id()
    )
  );

-- Asegurar que la política de vendedor también existe y funciona
DROP POLICY IF EXISTS "vendedor_pedidos_select" ON pedidos;
CREATE POLICY "vendedor_pedidos_select" ON pedidos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'vendedor') 
      AND activo = true
    )
  );

-- ===========================================
-- CLIENTES: Asegurar que vendedores pueden leer
-- ===========================================

-- La política vendedor_clientes_select ya debería existir, pero la verificamos
DROP POLICY IF EXISTS "vendedor_clientes_select" ON clientes;
CREATE POLICY "vendedor_clientes_select" ON clientes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'vendedor') 
      AND activo = true
    )
  );

-- ===========================================
-- TESORERIA_CAJAS: Agregar política para vendedores
-- ===========================================

-- Eliminar política antigua que solo permite acceso por sucursal
DROP POLICY IF EXISTS "sucursal_access_cajas" ON tesoreria_cajas;

-- Crear política que permite acceso si:
-- 1. El usuario es admin
-- 2. El usuario es vendedor (sin restricción de sucursal)
-- 3. La caja tiene sucursal_id y coincide con la sucursal del usuario
CREATE POLICY "sucursal_access_cajas" ON tesoreria_cajas
  FOR SELECT
  USING (
    get_user_role() = 'admin' OR
    (
      EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND rol = 'vendedor' 
        AND activo = true
      )
    ) OR
    (
      sucursal_id IS NOT NULL AND 
      sucursal_id = get_user_sucursal_id()
    )
  );

-- Crear política específica para vendedores (más permisiva)
DROP POLICY IF EXISTS "vendedor_tesoreria_cajas_select" ON tesoreria_cajas;
CREATE POLICY "vendedor_tesoreria_cajas_select" ON tesoreria_cajas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'vendedor') 
      AND activo = true
    )
  );

-- ===========================================
-- VERIFICACIÓN FINAL
-- ===========================================

-- Verificar políticas de pedidos
SELECT 
    'Políticas de pedidos:' as tipo,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'pedidos'
ORDER BY policyname;

-- Verificar políticas de clientes
SELECT 
    'Políticas de clientes:' as tipo,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'clientes'
ORDER BY policyname;

-- Verificar políticas de tesoreria_cajas
SELECT 
    'Políticas de tesoreria_cajas:' as tipo,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'tesoreria_cajas'
ORDER BY policyname;

-- Comentarios
COMMENT ON POLICY "sucursal_access_pedidos" ON pedidos IS 'Permite acceso a pedidos si el usuario es admin, vendedor, o tiene la misma sucursal asignada';
COMMENT ON POLICY "vendedor_pedidos_select" ON pedidos IS 'Permite acceso completo a pedidos para usuarios con rol admin o vendedor';
COMMENT ON POLICY "vendedor_clientes_select" ON clientes IS 'Permite acceso a clientes para usuarios con rol admin o vendedor';
COMMENT ON POLICY "sucursal_access_cajas" ON tesoreria_cajas IS 'Permite acceso a cajas si el usuario es admin, vendedor, o tiene la misma sucursal asignada';
COMMENT ON POLICY "vendedor_tesoreria_cajas_select" ON tesoreria_cajas IS 'Permite acceso completo a cajas para usuarios con rol admin o vendedor';

