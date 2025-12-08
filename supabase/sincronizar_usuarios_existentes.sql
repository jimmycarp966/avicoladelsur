-- ===========================================
-- SINCRONIZAR USUARIOS EXISTENTES
-- Fecha: 2025-01-01
-- Descripción: Script para sincronizar usuarios existentes entre auth.users y tabla usuarios
-- ===========================================

-- PASO 1: Verificar usuarios en auth.users que NO están en tabla usuarios
-- ===========================================
SELECT 
    'Usuarios en auth.users sin registro en tabla usuarios:' as tipo,
    au.id,
    au.email,
    au.created_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM usuarios u WHERE u.id = au.id
)
ORDER BY au.created_at;

-- PASO 2: Insertar usuarios de auth.users que faltan en tabla usuarios
-- ===========================================
INSERT INTO usuarios (
    id,
    email,
    nombre,
    apellido,
    rol,
    activo,
    created_at,
    updated_at
)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'nombre',
        split_part(au.email, '@', 1)
    ) as nombre,
    au.raw_user_meta_data->>'apellido' as apellido,
    COALESCE(
        au.raw_user_meta_data->>'rol',
        'vendedor'
    ) as rol,
    COALESCE(
        (au.raw_user_meta_data->>'activo')::boolean,
        true
    ) as activo,
    au.created_at,
    au.updated_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM usuarios u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- PASO 3: Actualizar emails de usuarios existentes si cambiaron en auth.users
-- ===========================================
UPDATE usuarios u
SET 
    email = au.email,
    updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id
  AND u.email IS DISTINCT FROM au.email;

-- PASO 4: Verificar usuarios en tabla usuarios que NO están en auth.users
-- ===========================================
SELECT 
    'Usuarios en tabla usuarios sin cuenta de autenticación:' as tipo,
    u.id,
    u.email,
    u.nombre,
    u.rol,
    u.activo,
    u.created_at
FROM usuarios u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = u.id
)
ORDER BY u.created_at;

-- PASO 5: Verificar sincronización completa
-- ===========================================
SELECT 
    'Resumen de sincronización:' as tipo,
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM usuarios) as total_usuarios,
    (SELECT COUNT(*) FROM usuarios u 
     INNER JOIN auth.users au ON u.id = au.id) as usuarios_sincronizados,
    (SELECT COUNT(*) FROM auth.users au 
     WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = au.id)) as auth_sin_usuario,
    (SELECT COUNT(*) FROM usuarios u 
     WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id)) as usuarios_sin_auth;

-- NOTA: Si hay usuarios en tabla usuarios sin cuenta de auth.users,
-- necesitarás crear las cuentas de autenticación manualmente desde:
-- - Supabase Dashboard > Authentication > Users > Add User
-- - O usando la función registerUser() desde el sistema

