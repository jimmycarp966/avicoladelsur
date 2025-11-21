-- ===========================================
-- CREAR USUARIO ADMIN
-- ===========================================
-- Este script crea el usuario admin: admin@avicoladelsur.com
-- Email: admin@avicoladelsur.com
-- Contraseña: 123456
-- ===========================================

BEGIN;

-- ===========================================
-- PASO 1: Desactivar RLS temporalmente
-- ===========================================
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- ===========================================
-- PASO 2: Intentar crear usuario en auth.users
-- ===========================================
-- NOTA: En Supabase, crear usuarios en auth.users desde SQL requiere permisos especiales
-- Si este paso falla, crea el usuario manualmente desde el Dashboard:
-- Authentication > Users > Add User > Email: admin@avicoladelsur.com, Password: 123456

DO $$
DECLARE
    v_user_id uuid;
    v_user_exists boolean;
BEGIN
    -- Verificar si el usuario ya existe en auth.users
    SELECT EXISTS(
        SELECT 1 FROM auth.users WHERE email = 'admin@avicoladelsur.com'
    ) INTO v_user_exists;
    
    IF NOT v_user_exists THEN
        -- Intentar crear el usuario usando la función de Supabase
        -- Esto puede fallar si no tienes permisos, en ese caso créalo manualmente
        BEGIN
            -- Crear usuario en auth.users
            INSERT INTO auth.users (
                instance_id,
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                recovery_sent_at,
                last_sign_in_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token,
                email_change,
                email_change_token_new,
                recovery_token
            )
            VALUES (
                '00000000-0000-0000-0000-000000000000',
                gen_random_uuid(),
                'authenticated',
                'authenticated',
                'admin@avicoladelsur.com',
                crypt('123456', gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                '{"provider":"email","providers":["email"]}',
                '{}',
                NOW(),
                NOW(),
                '',
                '',
                '',
                ''
            )
            RETURNING id INTO v_user_id;
            
            RAISE NOTICE 'Usuario creado en auth.users con ID: %', v_user_id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'No se pudo crear el usuario en auth.users automáticamente.';
                RAISE NOTICE 'Por favor, crea el usuario manualmente desde el Dashboard:';
                RAISE NOTICE '1. Ve a Authentication > Users';
                RAISE NOTICE '2. Click en "Add User"';
                RAISE NOTICE '3. Email: admin@avicoladelsur.com';
                RAISE NOTICE '4. Password: 123456';
                RAISE NOTICE '5. Luego ejecuta este script nuevamente.';
        END;
    ELSE
        RAISE NOTICE 'El usuario admin@avicoladelsur.com ya existe en auth.users';
    END IF;
END $$;

-- ===========================================
-- PASO 3: Obtener el ID del usuario de auth.users e insertar en tabla usuarios
-- ===========================================
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Obtener el ID del usuario de autenticación
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'admin@avicoladelsur.com';
    
    -- Si el usuario existe en auth, insertarlo/actualizarlo en la tabla usuarios
    IF v_user_id IS NOT NULL THEN
        INSERT INTO usuarios (id, email, nombre, apellido, telefono, rol, activo, created_at, updated_at)
        VALUES (
            v_user_id,
            'admin@avicoladelsur.com',
            'Administrador',
            'Sistema',
            NULL,
            'admin',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO UPDATE 
        SET 
            id = EXCLUDED.id,
            nombre = EXCLUDED.nombre,
            apellido = EXCLUDED.apellido,
            rol = EXCLUDED.rol,
            activo = EXCLUDED.activo,
            updated_at = NOW();
        
        RAISE NOTICE 'Usuario admin creado/actualizado exitosamente en la tabla usuarios con ID: %', v_user_id;
    ELSE
        RAISE EXCEPTION 'No se encontró el usuario admin@avicoladelsur.com en auth.users. Por favor, créalo primero desde el Dashboard: Authentication > Users > Add User';
    END IF;
END $$;

-- ===========================================
-- PASO 4: Reactivar RLS
-- ===========================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- PASO 5: Verificar que el usuario se creó correctamente
-- ===========================================
DO $$
DECLARE
    v_auth_count integer;
    v_usuarios_count integer;
BEGIN
    SELECT COUNT(*) INTO v_auth_count
    FROM auth.users
    WHERE email = 'admin@avicoladelsur.com';
    
    SELECT COUNT(*) INTO v_usuarios_count
    FROM usuarios
    WHERE email = 'admin@avicoladelsur.com';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN:';
    RAISE NOTICE 'Usuario en auth.users: %', v_auth_count;
    RAISE NOTICE 'Usuario en tabla usuarios: %', v_usuarios_count;
    RAISE NOTICE '========================================';
    
    IF v_auth_count > 0 AND v_usuarios_count > 0 THEN
        RAISE NOTICE '✅ Usuario admin creado exitosamente!';
        RAISE NOTICE 'Puedes hacer login con:';
        RAISE NOTICE 'Email: admin@avicoladelsur.com';
        RAISE NOTICE 'Password: 123456';
    ELSIF v_auth_count = 0 THEN
        RAISE WARNING '⚠️ El usuario NO existe en auth.users. Créalo manualmente desde el Dashboard.';
    ELSIF v_usuarios_count = 0 THEN
        RAISE WARNING '⚠️ El usuario NO existe en la tabla usuarios. Revisa los permisos.';
    END IF;
END $$;

-- Mostrar los datos del usuario creado
SELECT 
    'Usuario en auth.users' as tabla,
    id::text as id,
    email,
    created_at
FROM auth.users
WHERE email = 'admin@avicoladelsur.com'

UNION ALL

SELECT 
    'Usuario en usuarios' as tabla,
    id::text as id,
    email,
    created_at
FROM usuarios
WHERE email = 'admin@avicoladelsur.com';

COMMIT;

-- ===========================================
-- INSTRUCCIONES ALTERNATIVAS (si el script falla)
-- ===========================================
-- Si el script no puede crear el usuario en auth.users automáticamente,
-- sigue estos pasos:
--
-- 1. Ve al Dashboard de Supabase
-- 2. Navega a: Authentication > Users
-- 3. Click en "Add User" o "Invite User"
-- 4. Completa:
--    - Email: admin@avicoladelsur.com
--    - Password: 123456
--    - Auto Confirm User: ✅ (marcar)
-- 5. Click en "Create User"
-- 6. Luego ejecuta este script nuevamente (solo creará el registro en la tabla usuarios)
--
-- ===========================================

