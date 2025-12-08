-- ===========================================
-- VERIFICAR COINCIDENCIA DE IDs
-- Fecha: 2025-01-01
-- Descripción: Verifica si el ID de auth.users coincide con usuario_id en rrhh_empleados
-- ===========================================

-- PASO 1: Obtener ID del usuario en auth.users
-- ===========================================
SELECT 
    'ID en auth.users:' as tipo,
    id as auth_user_id,
    email
FROM auth.users
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 2: Obtener ID del usuario en tabla usuarios
-- ===========================================
SELECT 
    'ID en tabla usuarios:' as tipo,
    id as usuario_id,
    email
FROM usuarios
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 3: Verificar si coinciden
-- ===========================================
SELECT 
    'Verificación de coincidencia:' as tipo,
    au.id as auth_id,
    u.id as usuario_id,
    CASE 
        WHEN au.id = u.id THEN '✅ COINCIDEN'
        ELSE '❌ NO COINCIDEN - Este es el problema!'
    END as estado,
    e.usuario_id as empleado_usuario_id,
    e.sucursal_id,
    s.nombre as sucursal_nombre
FROM auth.users au
LEFT JOIN usuarios u ON au.id = u.id
LEFT JOIN rrhh_empleados e ON u.id = e.usuario_id
LEFT JOIN sucursales s ON e.sucursal_id = s.id
WHERE au.email = 'alberdi@avicoladelsur.com';

-- PASO 4: Si no coinciden, mostrar cómo corregirlo
-- ===========================================
DO $$
DECLARE
    v_auth_id UUID;
    v_usuario_id UUID;
    v_coinciden BOOLEAN;
BEGIN
    -- Obtener IDs
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE email = 'alberdi@avicoladelsur.com';
    
    SELECT id INTO v_usuario_id
    FROM usuarios
    WHERE email = 'alberdi@avicoladelsur.com';
    
    v_coinciden := (v_auth_id = v_usuario_id);
    
    IF NOT v_coinciden THEN
        RAISE NOTICE '❌ PROBLEMA ENCONTRADO: Los IDs no coinciden';
        RAISE NOTICE 'auth.users.id: %', v_auth_id;
        RAISE NOTICE 'usuarios.id: %', v_usuario_id;
        RAISE NOTICE '';
        RAISE NOTICE 'SOLUCIÓN: Actualizar el ID en tabla usuarios para que coincida con auth.users';
        RAISE NOTICE 'Ejecuta: UPDATE usuarios SET id = ''%'' WHERE email = ''alberdi@avicoladelsur.com'';', v_auth_id;
    ELSE
        RAISE NOTICE '✅ Los IDs coinciden correctamente';
    END IF;
END $$;

