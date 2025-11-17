-- =====================================================
-- CONFIGURACIÓN COMPLETA DE AUTENTICACIÓN Y RLS
-- =====================================================
-- Ejecuta este script completo en el SQL Editor de Supabase

-- PASO 1: Temporalmente desactivar RLS para configurar
-- =====================================================
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- PASO 2: Obtener el ID del usuario de autenticación e insertar en tabla usuarios
-- =====================================================
-- Esta query inserta o actualiza el usuario vinculándolo con auth.users
INSERT INTO usuarios (id, email, nombre, apellido, telefono, rol, activo, created_at, updated_at)
SELECT 
    au.id,
    'admin@avicoladelsur.com' as email,
    'Administrador' as nombre,
    'Sistema' as apellido,
    NULL as telefono,
    'admin' as rol,
    true as activo,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'admin@avicoladelsur.com'
ON CONFLICT (email) DO UPDATE 
SET 
    id = EXCLUDED.id,
    nombre = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    rol = EXCLUDED.rol,
    activo = EXCLUDED.activo,
    updated_at = NOW();

-- PASO 3: Verificar que el usuario se creó correctamente
-- =====================================================
SELECT id, email, nombre, apellido, rol, activo 
FROM usuarios 
WHERE email = 'admin@avicoladelsur.com';

-- PASO 4: Eliminar políticas existentes si las hay
-- =====================================================
DROP POLICY IF EXISTS "users_read_own_data" ON usuarios;
DROP POLICY IF EXISTS "admins_read_all_users" ON usuarios;
DROP POLICY IF EXISTS "admins_update_users" ON usuarios;
DROP POLICY IF EXISTS "admins_insert_users" ON usuarios;
DROP POLICY IF EXISTS "admins_delete_users" ON usuarios;

-- PASO 5: Crear políticas RLS apropiadas
-- =====================================================

-- Permitir que los usuarios autenticados lean sus propios datos
CREATE POLICY "users_read_own_data" ON usuarios 
FOR SELECT 
USING (auth.uid() = id);

-- Permitir que los usuarios con rol admin lean todos los usuarios
CREATE POLICY "admins_read_all_users" ON usuarios 
FOR SELECT 
USING (
    auth.uid() IN (
        SELECT id FROM usuarios WHERE rol = 'admin' AND activo = true
    )
);

-- Permitir que los admins actualicen usuarios
CREATE POLICY "admins_update_users" ON usuarios 
FOR UPDATE 
USING (
    auth.uid() IN (
        SELECT id FROM usuarios WHERE rol = 'admin' AND activo = true
    )
);

-- Permitir que los admins inserten usuarios
CREATE POLICY "admins_insert_users" ON usuarios 
FOR INSERT 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM usuarios WHERE rol = 'admin' AND activo = true
    )
);

-- Permitir que los admins eliminen usuarios (desactivar, no borrar)
CREATE POLICY "admins_delete_users" ON usuarios 
FOR DELETE 
USING (
    auth.uid() IN (
        SELECT id FROM usuarios WHERE rol = 'admin' AND activo = true
    )
);

-- PASO 6: Reactivar RLS
-- =====================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- PASO 7: Verificar configuración final
-- =====================================================
-- Verificar usuario
SELECT id, email, nombre, apellido, rol, activo 
FROM usuarios 
WHERE email = 'admin@avicoladelsur.com';

-- Verificar políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'usuarios'
ORDER BY policyname;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- Deberías ver:
-- 1. Un usuario con email admin@avicoladelsur.com
-- 2. 5 políticas creadas para la tabla usuarios
-- 
-- Ahora puedes hacer login con:
-- Email: admin@avicoladelsur.com
-- Password: (la que configuraste en Supabase Auth)

