-- ===========================================
-- FIX: Hacer funciones RLS NULL-safe
-- Fecha: 2025-01-01
-- Problema: Funciones retornan NULL y políticas fallan silenciosamente
-- Solución: Hacer funciones NULL-safe y políticas más robustas
-- ===========================================

-- Recrear función get_user_role() con manejo NULL-safe
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $func_role$
BEGIN
  RETURN COALESCE(
    (SELECT rol FROM usuarios WHERE id = auth.uid() AND activo = true),
    'none'::TEXT
  );
END;
$func_role$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recrear función get_user_sucursal_id() con manejo NULL-safe
CREATE OR REPLACE FUNCTION get_user_sucursal_id()
RETURNS UUID AS $func_sucursal$
BEGIN
  RETURN (
    SELECT e.sucursal_id 
    FROM rrhh_empleados e 
    WHERE e.usuario_id = auth.uid()
    AND e.activo = true
    LIMIT 1
  );
END;
$func_sucursal$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===========================================
-- PEDIDOS: Políticas más robustas que no dependen de funciones que pueden retornar NULL
-- ===========================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "pedidos_select_all" ON pedidos;
DROP POLICY IF EXISTS "pedidos_insert_all" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update_all" ON pedidos;

-- Crear política que verifica directamente en la tabla usuarios (más confiable)
CREATE POLICY "pedidos_select_all" ON pedidos
  FOR SELECT
  USING (
    -- Admin tiene acceso completo
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin' 
      AND activo = true
    ) OR
    -- Vendedores tienen acceso completo
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'vendedor' 
      AND activo = true
    ) OR
    -- Usuarios con sucursal pueden ver pedidos de su sucursal
    (
      sucursal_id IS NOT NULL AND 
      EXISTS (
        SELECT 1 FROM rrhh_empleados e
        WHERE e.usuario_id = auth.uid()
        AND e.sucursal_id = pedidos.sucursal_id
        AND e.activo = true
      )
    )
  );

CREATE POLICY "pedidos_insert_all" ON pedidos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'vendedor') 
      AND activo = true
    )
  );

CREATE POLICY "pedidos_update_all" ON pedidos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'vendedor') 
      AND activo = true
    )
  );

-- ===========================================
-- CLIENTES: Políticas más robustas
-- ===========================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "clientes_select_all" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_all" ON clientes;
DROP POLICY IF EXISTS "clientes_update_all" ON clientes;

-- Crear política que verifica directamente en la tabla usuarios
CREATE POLICY "clientes_select_all" ON clientes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'vendedor') 
      AND activo = true
    )
  );

CREATE POLICY "clientes_insert_all" ON clientes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'vendedor') 
      AND activo = true
    )
  );

CREATE POLICY "clientes_update_all" ON clientes
  FOR UPDATE
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

-- Verificar funciones
SELECT 
    'Funciones después del fix:' as tipo,
    proname,
    pg_get_functiondef(oid) as definicion
FROM pg_proc 
WHERE proname IN ('get_user_role', 'get_user_sucursal_id')
ORDER BY proname;

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

-- Comentarios
COMMENT ON FUNCTION get_user_role() IS 'Retorna el rol del usuario autenticado, o "none" si no existe o no está activo';
COMMENT ON FUNCTION get_user_sucursal_id() IS 'Retorna la sucursal_id del usuario autenticado desde rrhh_empleados';
COMMENT ON POLICY "pedidos_select_all" ON pedidos IS 'Permite acceso a pedidos verificando directamente en tabla usuarios (más confiable)';
COMMENT ON POLICY "clientes_select_all" ON clientes IS 'Permite acceso a clientes verificando directamente en tabla usuarios (más confiable)';

