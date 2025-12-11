-- ===========================================
-- VERIFICACIÓN ESPECÍFICA: Usuario alberdi@avicoladelsur.com
-- ===========================================

-- PASO 1: Verificar si existe en auth.users
-- ===========================================
SELECT 
    id,
    email,
    created_at,
    confirmed_at,
    email_confirmed_at,
    last_sign_in_at,
    CASE 
        WHEN confirmed_at IS NULL AND email_confirmed_at IS NULL THEN '❌ NO CONFIRMADO - No puede hacer login'
        ELSE '✅ CONFIRMADO - Puede hacer login'
    END as estado_confirmacion,
    encrypted_password IS NOT NULL as tiene_password
FROM auth.users
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 2: Verificar si existe en tabla usuarios
-- ===========================================
SELECT 
    id,
    email,
    nombre,
    apellido,
    rol,
    activo,
    CASE 
        WHEN activo = true THEN '✅ ACTIVO'
        ELSE '❌ INACTIVO - No puede hacer login'
    END as estado_activo,
    created_at,
    updated_at
FROM usuarios
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 3: Verificar si los IDs coinciden
-- ===========================================
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    au.confirmed_at IS NOT NULL as auth_confirmado,
    u.id as usuarios_id,
    u.email as usuarios_email,
    u.activo as usuarios_activo,
    CASE 
        WHEN au.id IS NULL THEN '❌ No existe en auth.users'
        WHEN u.id IS NULL THEN '❌ No existe en tabla usuarios'
        WHEN au.id != u.id THEN '❌ IDs NO COINCIDEN'
        WHEN au.confirmed_at IS NULL THEN '❌ Email no confirmado en auth'
        WHEN u.activo = false THEN '❌ Usuario inactivo en tabla usuarios'
        ELSE '✅ Todo correcto'
    END as diagnostico
FROM auth.users au
FULL OUTER JOIN usuarios u ON au.id = u.id
WHERE au.email = 'alberdi@avicoladelsur.com' OR u.email = 'alberdi@avicoladelsur.com';

-- PASO 4: Verificar triggers que podrían afectar el login
-- ===========================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'usuarios'
ORDER BY trigger_name;

-- PASO 5: SOLUCIÓN TEMPORAL - Si el usuario existe pero no está confirmado
-- ===========================================
-- DESCOMENTA Y EJECUTA SOLO SI EL USUARIO EXISTE PERO NO ESTÁ CONFIRMADO:
/*
UPDATE auth.users
SET 
    confirmed_at = NOW(),
    email_confirmed_at = NOW()
WHERE email = 'alberdi@avicoladelsur.com'
AND confirmed_at IS NULL;
*/

-- PASO 6: SOLUCIÓN - Si el usuario existe en auth pero NO en tabla usuarios
-- ===========================================
-- DESCOMENTA Y AJUSTA si necesitas crear el usuario en la tabla usuarios:
/*
INSERT INTO usuarios (id, email, nombre, apellido, rol, activo, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    'Alberdi',  -- Ajusta según corresponda
    'Usuario',  -- Ajusta según corresponda
    'admin',    -- Ajusta el rol según corresponda
    true,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'alberdi@avicoladelsur.com'
AND NOT EXISTS (
    SELECT 1 FROM usuarios u WHERE u.id = au.id
)
RETURNING *;
*/

-- PASO 7: SOLUCIÓN - Si el usuario está inactivo
-- ===========================================
-- DESCOMENTA si necesitas activar el usuario:
/*
UPDATE usuarios
SET activo = true,
    updated_at = NOW()
WHERE email = 'alberdi@avicoladelsur.com'
AND activo = false;
*/

