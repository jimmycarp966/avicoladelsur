-- ===========================================
-- TEST: Verificar acceso RLS para usuario alberdi
-- Fecha: 2025-01-01
-- Descripción: Prueba directa de las consultas que hace el sistema
-- ===========================================

-- PASO 1: Verificar que el usuario existe y obtener su ID
-- ===========================================
SELECT 
    'Usuario en auth.users:' as tipo,
    id as user_id,
    email
FROM auth.users
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 2: Verificar que existe en tabla usuarios
-- ===========================================
SELECT 
    'Usuario en tabla usuarios:' as tipo,
    id,
    email,
    rol,
    activo
FROM usuarios
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 3: Verificar empleado y sucursal (SIN RLS - como admin)
-- ===========================================
SELECT 
    'Empleado (vista admin):' as tipo,
    e.id as empleado_id,
    e.usuario_id,
    e.sucursal_id,
    e.legajo,
    e.activo as empleado_activo,
    s.nombre as sucursal_nombre,
    s.active as sucursal_activa
FROM rrhh_empleados e
LEFT JOIN sucursales s ON e.sucursal_id = s.id
WHERE e.usuario_id IN (
    SELECT id FROM usuarios WHERE email = 'alberdi@avicoladelsur.com'
);

-- PASO 4: Verificar políticas RLS actuales
-- ===========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'rrhh_empleados'
ORDER BY policyname;

-- PASO 5: Probar consulta como si fuera el usuario (simulando RLS)
-- ===========================================
-- Esta consulta simula lo que haría getSucursalUsuario
-- Necesitamos el ID del usuario de auth.users
DO $$
DECLARE
    v_user_id UUID;
    v_sucursal_id UUID;
    v_sucursal_nombre TEXT;
BEGIN
    -- Obtener ID del usuario
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'alberdi@avicoladelsur.com';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Usuario no encontrado en auth.users';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usuario ID: %', v_user_id;
    
    -- Intentar obtener sucursal_id (esto debería funcionar con la política RLS)
    SELECT sucursal_id INTO v_sucursal_id
    FROM rrhh_empleados
    WHERE usuario_id = v_user_id
    AND activo = true
    LIMIT 1;
    
    IF v_sucursal_id IS NULL THEN
        RAISE NOTICE '❌ NO se pudo obtener sucursal_id - Posible problema de RLS';
        RAISE NOTICE 'Verifica que la política "empleados_read_own" esté activa';
    ELSE
        RAISE NOTICE '✅ Sucursal ID obtenida: %', v_sucursal_id;
        
        -- Verificar nombre de la sucursal (usando variable diferente)
        SELECT nombre INTO v_sucursal_nombre
        FROM sucursales
        WHERE id = v_sucursal_id;
        
        RAISE NOTICE '✅ Nombre de sucursal: %', v_sucursal_nombre;
    END IF;
END $$;

-- PASO 6: Verificar si la función get_user_sucursal_id() funciona
-- ===========================================
-- Esta función se usa en las políticas RLS de otras tablas
SELECT 
    'Función get_user_sucursal_id:' as tipo,
    get_user_sucursal_id() as sucursal_id;

-- PASO 7: Verificar políticas de sucursales
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
WHERE tablename = 'sucursales'
ORDER BY policyname;

-- PASO 8: Probar acceso a sucursal directamente
-- ===========================================
DO $$
DECLARE
    v_user_id UUID;
    v_sucursal_id UUID;
    v_sucursal_nombre TEXT;
BEGIN
    -- Obtener ID del usuario
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'alberdi@avicoladelsur.com';
    
    -- Obtener sucursal_id del empleado
    SELECT e.sucursal_id INTO v_sucursal_id
    FROM rrhh_empleados e
    WHERE e.usuario_id = v_user_id
    AND e.activo = true
    LIMIT 1;
    
    IF v_sucursal_id IS NOT NULL THEN
        -- Intentar leer la sucursal (esto debería funcionar con RLS)
        SELECT nombre INTO v_sucursal_nombre
        FROM sucursales
        WHERE id = v_sucursal_id;
        
        IF v_sucursal_nombre IS NOT NULL THEN
            RAISE NOTICE '✅ Acceso a sucursal OK: %', v_sucursal_nombre;
        ELSE
            RAISE NOTICE '❌ No se pudo leer la sucursal - Problema de RLS en tabla sucursales';
        END IF;
    ELSE
        RAISE NOTICE '❌ No se pudo obtener sucursal_id del empleado';
    END IF;
END $$;

