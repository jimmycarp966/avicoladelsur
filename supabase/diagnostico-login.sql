-- ===========================================
-- DIAGNÓSTICO: Problemas de Login
-- ===========================================
-- Ejecuta este script en el SQL Editor de Supabase para diagnosticar
-- problemas de autenticación

-- PASO 1: Ver todos los usuarios en auth.users
-- ===========================================
SELECT 
    id,
    email,
    created_at,
    confirmed_at,
    email_confirmed_at,
    last_sign_in_at,
    CASE 
        WHEN confirmed_at IS NULL AND email_confirmed_at IS NULL THEN '❌ NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as estado_confirmacion
FROM auth.users
ORDER BY created_at DESC;

-- PASO 2: Ver todos los usuarios en la tabla usuarios
-- ===========================================
SELECT 
    id,
    email,
    nombre,
    rol,
    activo,
    CASE 
        WHEN activo = true THEN '✅ ACTIVO'
        ELSE '❌ INACTIVO'
    END as estado_activo
FROM usuarios
ORDER BY created_at DESC;

-- PASO 3: Verificar usuarios que existen en auth pero NO en tabla usuarios
-- ===========================================
SELECT 
    au.id,
    au.email,
    'Existe en auth.users pero NO en tabla usuarios' as problema
FROM auth.users au
LEFT JOIN usuarios u ON au.id = u.id
WHERE u.id IS NULL;

-- PASO 4: Verificar usuarios que existen en tabla usuarios pero NO en auth
-- ===========================================
SELECT 
    u.id,
    u.email,
    u.nombre,
    'Existe en tabla usuarios pero NO en auth.users' as problema
FROM usuarios u
LEFT JOIN auth.users au ON u.id = au.id
WHERE au.id IS NULL;

-- PASO 5: Verificar RLS en tabla usuarios
-- ===========================================
SELECT 
    tablename,
    rowsecurity as rls_activado
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'usuarios';

-- PASO 6: Ver políticas RLS de usuarios
-- ===========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'usuarios'
ORDER BY policyname;

-- PASO 7: Crear usuario de prueba (si no existe)
-- ===========================================
-- DESCOMENTA Y AJUSTA si necesitas crear un usuario de prueba
/*
-- Primero crear en auth.users (esto lo haces desde el dashboard de Supabase Auth)
-- Luego ejecutar esto para crear en tabla usuarios:

INSERT INTO usuarios (id, email, nombre, apellido, rol, activo, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    'Usuario',
    'Prueba',
    'admin',
    true,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'tu-email@ejemplo.com'
ON CONFLICT (id) DO NOTHING;
*/

