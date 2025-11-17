-- =====================================================
-- INSERTAR USUARIO ADMIN MANUALMENTE
-- =====================================================
-- Este script inserta el usuario admin de forma manual
-- Ejecuta PRIMERO el diagnose-user.sql para obtener el ID

-- PASO 1: Desactivar RLS temporalmente
-- =====================================================
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- PASO 2: Obtener el ID del usuario de auth.users
-- =====================================================
-- Ejecuta esta query y copia el ID (UUID) que te devuelve:
SELECT id, email FROM auth.users WHERE email = 'admin@avicoladelsur.com';

-- RESULTADO EJEMPLO: 
-- id: 12345678-1234-1234-1234-123456789abc
-- email: admin@avicoladelsur.com

-- PASO 3: REEMPLAZA 'TU-UUID-AQUI' con el ID que obtuviste arriba
-- =====================================================
-- ⚠️ IMPORTANTE: Descomenta las líneas de abajo y reemplaza TU-UUID-AQUI

-- DELETE FROM usuarios WHERE email = 'admin@avicoladelsur.com';

-- INSERT INTO usuarios (id, email, nombre, apellido, telefono, rol, activo, created_at, updated_at)
-- VALUES (
--     'TU-UUID-AQUI',  -- ⚠️ REEMPLAZA ESTO
--     'admin@avicoladelsur.com',
--     'Administrador',
--     'Sistema',
--     NULL,
--     'admin',
--     true,
--     NOW(),
--     NOW()
-- );

-- PASO 4: Verificar que se insertó correctamente
-- =====================================================
-- SELECT id, email, nombre, apellido, rol, activo FROM usuarios WHERE email = 'admin@avicoladelsur.com';

-- PASO 5: Reactivar RLS
-- =====================================================
-- ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

