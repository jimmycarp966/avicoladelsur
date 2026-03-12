-- ===========================================
-- SINCRONIZAR USUARIO ADMIN EN LA TABLA usuarios
-- ===========================================
-- Este script no crea contraseñas ni escribe secretos.
--
-- Paso previo obligatorio:
--   1. Crear el usuario manualmente en Supabase Auth.
--   2. Usar una contraseña fuerte definida fuera de este repositorio.
--
-- Luego ejecuta este script para reflejar el admin en la tabla `usuarios`.
-- ===========================================

BEGIN;

ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'admin@avicoladelsur.com';

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No se encontro el usuario admin@avicoladelsur.com en auth.users. Crealo primero desde Supabase Authentication con una contraseña fuerte.';
    END IF;

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

    RAISE NOTICE 'Usuario admin sincronizado correctamente en la tabla usuarios.';
    RAISE NOTICE 'Email: admin@avicoladelsur.com';
END $$;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

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
