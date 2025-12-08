-- ===========================================
-- FIX DEFINITIVO: Políticas RLS para pedidos y clientes
-- Fecha: 2025-01-01
-- Problema: Múltiples políticas conflictivas bloquean acceso
-- Solución: Eliminar todas y crear políticas simples y claras
-- ===========================================

-- Verificar que las funciones helper existen
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
-- PEDIDOS: Eliminar TODAS las políticas y crear una simple
-- ===========================================

-- Eliminar TODAS las políticas existentes de pedidos
DROP POLICY IF EXISTS "admin_full_access_pedidos" ON pedidos;
DROP POLICY IF EXISTS "sucursal_access_pedidos" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_select" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_insert" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_update" ON pedidos;
DROP POLICY IF EXISTS "sucursal_pedidos" ON pedidos;
DROP POLICY IF EXISTS "repartidor_pedidos_asignados" ON pedidos;

-- Crear política simple y permisiva para SELECT
-- Permite acceso si:
-- 1. Es admin
-- 2. Es vendedor (cualquier vendedor puede ver todos los pedidos)
-- 3. Tiene sucursal asignada y el pedido es de esa sucursal
CREATE POLICY "pedidos_select_all" ON pedidos
  FOR SELECT
  USING (
    -- Admin tiene acceso completo
    get_user_role() = 'admin' OR
    -- Vendedores tienen acceso completo
    (
      EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = auth.uid() 
        AND rol = 'vendedor' 
        AND activo = true
      )
    ) OR
    -- Usuarios con sucursal pueden ver pedidos de su sucursal
    (
      sucursal_id IS NOT NULL AND 
      sucursal_id = get_user_sucursal_id()
    )
  );

-- Política para INSERT (vendedores y admins)
CREATE POLICY "pedidos_insert_all" ON pedidos
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'vendedor' 
      AND activo = true
    )
  );

-- Política para UPDATE (vendedores y admins)
CREATE POLICY "pedidos_update_all" ON pedidos
  FOR UPDATE
  USING (
    get_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'vendedor' 
      AND activo = true
    )
  );

-- ===========================================
-- CLIENTES: Eliminar TODAS las políticas y crear una simple
-- ===========================================

-- Eliminar TODAS las políticas existentes de clientes
DROP POLICY IF EXISTS "vendedor_clientes_select" ON clientes;
DROP POLICY IF EXISTS "vendedor_clientes_insert" ON clientes;
DROP POLICY IF EXISTS "vendedor_clientes_update" ON clientes;
DROP POLICY IF EXISTS "sucursal_ventas" ON clientes;

-- Crear política simple y permisiva para SELECT
-- Permite acceso a vendedores y admins sin restricciones
CREATE POLICY "clientes_select_all" ON clientes
  FOR SELECT
  USING (
    get_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'vendedor' 
      AND activo = true
    )
  );

-- Política para INSERT
CREATE POLICY "clientes_insert_all" ON clientes
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'vendedor' 
      AND activo = true
    )
  );

-- Política para UPDATE
CREATE POLICY "clientes_update_all" ON clientes
  FOR UPDATE
  USING (
    get_user_role() = 'admin' OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'vendedor' 
      AND activo = true
    )
  );

-- ===========================================
-- VERIFICACIÓN FINAL
-- ===========================================

-- Verificar políticas de pedidos
SELECT 
    'Políticas de pedidos después del fix:' as tipo,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'pedidos'
ORDER BY policyname;

-- Verificar políticas de clientes
SELECT 
    'Políticas de clientes después del fix:' as tipo,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'clientes'
ORDER BY policyname;

-- Comentarios
COMMENT ON POLICY "pedidos_select_all" ON pedidos IS 'Permite acceso completo a pedidos para admins y vendedores, y acceso por sucursal para otros usuarios';
COMMENT ON POLICY "clientes_select_all" ON clientes IS 'Permite acceso completo a clientes para admins y vendedores';

