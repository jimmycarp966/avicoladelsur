-- =====================================================
-- SOLUCIÓN DEFINITIVA: Insertar Admin y Configurar RLS
-- =====================================================

-- PASO 1: Desactivar RLS temporalmente para poder insertar
-- =====================================================
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- PASO 2: Limpiar cualquier registro previo del admin (por si acaso)
-- =====================================================
DELETE FROM usuarios WHERE email = 'admin@avicoladelsur.com';

-- PASO 3: Insertar el usuario admin con el ID de auth.users
-- =====================================================
-- Esta query toma el ID del usuario de auth y lo usa para crear el registro
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Obtener el ID del usuario de autenticación
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'admin@avicoladelsur.com';
    
    -- Si el usuario existe en auth, insertarlo en la tabla usuarios
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
        );
        
        RAISE NOTICE 'Usuario admin creado exitosamente con ID: %', v_user_id;
    ELSE
        RAISE EXCEPTION 'No se encontró el usuario admin@avicoladelsur.com en auth.users. Créalo primero en Authentication > Users';
    END IF;
END $$;

-- PASO 4: Verificar que el usuario se creó correctamente
-- =====================================================
SELECT id, email, nombre, apellido, rol, activo 
FROM usuarios 
WHERE email = 'admin@avicoladelsur.com';

-- PASO 5: Reactivar RLS
-- =====================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- PASO 6: Verificación final - el usuario debería verse ahora
-- =====================================================
SELECT 
    'Usuario en auth.users' as tabla,
    id,
    email
FROM auth.users
WHERE email = 'admin@avicoladelsur.com'

UNION ALL

SELECT 
    'Usuario en usuarios' as tabla,
    id,
    email
FROM usuarios
WHERE email = 'admin@avicoladelsur.com';

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- Deberías ver DOS filas con el MISMO ID (UUID):
-- 1. Usuario en auth.users
-- 2. Usuario en usuarios
-- 
-- Si los IDs coinciden, el login funcionará correctamente.

