-- =====================================================
-- DIAGNÓSTICO: Verificar estado del usuario y autenticación
-- =====================================================

-- PASO 1: Ver todos los usuarios en auth.users
-- =====================================================
SELECT id, email, created_at, confirmed_at
FROM auth.users
WHERE email = 'admin@avicoladelsur.com';

-- PASO 2: Ver todos los usuarios en la tabla usuarios
-- =====================================================
SELECT id, email, nombre, apellido, rol, activo
FROM usuarios
WHERE email = 'admin@avicoladelsur.com';

-- PASO 3: Ver TODOS los usuarios en la tabla usuarios (sin filtro)
-- =====================================================
SELECT id, email, nombre, apellido, rol, activo
FROM usuarios;

-- PASO 4: Verificar que RLS está activo
-- =====================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'usuarios';

-- PASO 5: Ver todas las políticas
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'usuarios';

