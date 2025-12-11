-- ===========================================
-- SOLUCIÓN: Resetear contraseña del usuario alberdi@avicoladelsur.com
-- ===========================================
-- Si el problema persiste, ejecuta esto para resetear la contraseña

-- NOTA: No puedes cambiar la contraseña directamente desde SQL
-- Debes hacerlo desde el Dashboard de Supabase:
-- 1. Ve a Authentication > Users
-- 2. Busca alberdi@avicoladelsur.com
-- 3. Click en "..." > "Send password reset email"
-- O manualmente cambia la contraseña desde el dashboard

-- Verificar que el usuario tiene password configurado
SELECT 
    id,
    email,
    encrypted_password IS NOT NULL as tiene_password,
    confirmed_at IS NOT NULL as esta_confirmado
FROM auth.users
WHERE email = 'alberdi@avicoladelsur.com';

-- Si necesitas crear un nuevo usuario de prueba, ejecuta esto:
-- (Pero primero créalo desde el Dashboard de Supabase Auth)
/*
INSERT INTO usuarios (id, email, nombre, apellido, rol, activo, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    'Alberdi',
    'Usuario',
    'admin',
    true,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'alberdi@avicoladelsur.com'
ON CONFLICT (id) DO UPDATE 
SET activo = true, updated_at = NOW();
*/

