-- =====================================================
-- SOLUCIÓN: Eliminar Dependencia Circular en RLS
-- =====================================================

-- El problema: Las políticas actuales tienen referencias circulares
-- que causan errores 500 cuando un usuario intenta leer sus datos.

-- PASO 1: Eliminar TODAS las políticas existentes
-- =====================================================
DROP POLICY IF EXISTS "users_read_own_data" ON usuarios;
DROP POLICY IF EXISTS "admins_read_all_users" ON usuarios;
DROP POLICY IF EXISTS "admins_update_users" ON usuarios;
DROP POLICY IF EXISTS "admins_insert_users" ON usuarios;
DROP POLICY IF EXISTS "admins_delete_users" ON usuarios;

-- PASO 2: Crear política simple para SELECT (sin dependencia circular)
-- =====================================================
-- Permitir que CUALQUIER usuario autenticado lea de la tabla usuarios
CREATE POLICY "authenticated_users_read" ON usuarios 
FOR SELECT 
TO authenticated
USING (true);

-- PASO 3: Política para que los usuarios lean sus propios datos (backup)
-- =====================================================
CREATE POLICY "users_read_own_data" ON usuarios 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- PASO 4: Permitir que usuarios autenticados actualicen sus propios datos
-- =====================================================
CREATE POLICY "users_update_own_data" ON usuarios 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- PASO 5: Permitir operaciones de admin (verificando rol directamente)
-- =====================================================
-- Para INSERT (crear usuarios)
CREATE POLICY "admins_insert_users" ON usuarios 
FOR INSERT 
TO authenticated
WITH CHECK (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin'
);

-- Para UPDATE (actualizar usuarios)
CREATE POLICY "admins_update_users" ON usuarios 
FOR UPDATE 
TO authenticated
USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin'
);

-- Para DELETE (eliminar usuarios)
CREATE POLICY "admins_delete_users" ON usuarios 
FOR DELETE 
TO authenticated
USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin'
);

-- PASO 6: Asegurar que RLS está habilitado
-- =====================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- PASO 7: Verificar políticas creadas
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'usuarios'
ORDER BY policyname;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- Deberías ver 6 políticas:
-- 1. admins_delete_users
-- 2. admins_insert_users  
-- 3. admins_update_users
-- 4. authenticated_users_read (NUEVA - sin circular dependency)
-- 5. users_read_own_data
-- 6. users_update_own_data

