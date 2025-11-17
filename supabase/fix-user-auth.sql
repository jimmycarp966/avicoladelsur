-- =====================================================
-- VINCULAR USUARIO DE AUTENTICACIÓN CON TABLA USUARIOS
-- =====================================================

-- Este script vincula el usuario de Supabase Auth con la tabla usuarios
-- Ejecuta este script en el SQL Editor de Supabase

-- PASO 1: Insertar usuario admin con el ID del usuario de autenticación
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

-- Verificar que se creó correctamente
SELECT id, email, nombre, apellido, rol, activo 
FROM usuarios 
WHERE email = 'admin@avicoladelsur.com';

-- NOTA: Si el script anterior no funciona por limitaciones de permisos,
-- usa esta alternativa manual:

-- 1. Primero, obtén el ID del usuario de autenticación ejecutando:
-- SELECT id FROM auth.users WHERE email = 'admin@avicoladelsur.com';

-- 2. Copia el UUID que te devuelve (ejemplo: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')

-- 3. Ejecuta este INSERT reemplazando 'TU-UUID-AQUI' con el UUID copiado:
-- INSERT INTO usuarios (id, email, nombre, apellido, rol, activo)
-- VALUES (
--     'TU-UUID-AQUI',
--     'admin@avicoladelsur.com',
--     'Administrador',
--     'Sistema',
--     'admin',
--     true
-- )
-- ON CONFLICT (email) DO UPDATE 
-- SET id = EXCLUDED.id, activo = true;

