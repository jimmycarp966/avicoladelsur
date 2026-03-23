-- ===========================================
-- HABILITAR RLS EN CLIENTES Y CORREGIR POLÍTICAS
-- Fecha: 2025-01-01
-- Problema: RLS deshabilitado en clientes causa errores
-- Solución: Habilitar RLS y crear políticas correctas
-- ===========================================

-- Verificar estado actual de RLS
SELECT 
    'Estado RLS antes del fix:' as tipo,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename IN ('pedidos', 'clientes')
AND schemaname = 'public';

-- ===========================================
-- CLIENTES: Habilitar RLS y crear políticas
-- ===========================================

-- Habilitar RLS en clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas existentes de clientes
DROP POLICY IF EXISTS "vendedor_clientes_select" ON clientes;
DROP POLICY IF EXISTS "vendedor_clientes_insert" ON clientes;
DROP POLICY IF EXISTS "vendedor_clientes_update" ON clientes;
DROP POLICY IF EXISTS "clientes_select_all" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_all" ON clientes;
DROP POLICY IF EXISTS "clientes_update_all" ON clientes;
DROP POLICY IF EXISTS "sucursal_ventas" ON clientes;

-- Crear políticas simples y claras para clientes
CREATE POLICY "clientes_select_all" ON clientes
  FOR SELECT
  USING (
    -- Admin tiene acceso completo
    get_user_role() = 'admin' OR
    -- Vendedores tienen acceso completo
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'vendedor' 
      AND activo = true
    )
  );

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
-- PEDIDOS: Verificar y corregir políticas
-- ===========================================

-- Asegurar que RLS está habilitado
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas existentes de pedidos
DROP POLICY IF EXISTS "admin_full_access_pedidos" ON pedidos;
DROP POLICY IF EXISTS "sucursal_access_pedidos" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_select" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_insert" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_update" ON pedidos;
DROP POLICY IF EXISTS "sucursal_pedidos" ON pedidos;
DROP POLICY IF EXISTS "repartidor_pedidos_asignados" ON pedidos;
DROP POLICY IF EXISTS "pedidos_select_all" ON pedidos;
DROP POLICY IF EXISTS "pedidos_insert_all" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update_all" ON pedidos;

-- Crear políticas simples y claras para pedidos
CREATE POLICY "pedidos_select_all" ON pedidos
  FOR SELECT
  USING (
    -- Admin tiene acceso completo
    get_user_role() = 'admin' OR
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
      sucursal_id = get_user_sucursal_id()
    )
  );

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
-- VERIFICACIÓN FINAL
-- ===========================================

-- Verificar estado RLS después del fix
SELECT 
    'Estado RLS después del fix:' as tipo,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename IN ('pedidos', 'clientes')
AND schemaname = 'public';

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
COMMENT ON POLICY "clientes_select_all" ON clientes IS 'Permite acceso completo a clientes para admins y vendedores';
COMMENT ON POLICY "pedidos_select_all" ON pedidos IS 'Permite acceso completo a pedidos para admins y vendedores, y acceso por sucursal para otros usuarios';

