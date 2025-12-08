-- ===========================================
-- TEST: Verificar función get_user_sucursal_id()
-- Fecha: 2025-01-01
-- Descripción: Prueba si la función puede obtener la sucursal del usuario alberdi
-- ===========================================

-- PASO 1: Verificar que la función existe
-- ===========================================
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_user_sucursal_id';

-- PASO 2: Obtener el ID del usuario alberdi
-- ===========================================
SELECT 
    'ID del usuario alberdi:' as tipo,
    id as user_id,
    email
FROM auth.users
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 3: Verificar manualmente la consulta que hace la función
-- ===========================================
DO $$
DECLARE
    v_user_id UUID;
    v_sucursal_id UUID;
BEGIN
    -- Obtener ID del usuario
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'alberdi@avicoladelsur.com';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE '❌ Usuario no encontrado';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usuario ID: %', v_user_id;
    
    -- Hacer la misma consulta que hace get_user_sucursal_id()
    SELECT e.sucursal_id INTO v_sucursal_id
    FROM rrhh_empleados e 
    WHERE e.usuario_id = v_user_id
    LIMIT 1;
    
    IF v_sucursal_id IS NULL THEN
        RAISE NOTICE '❌ No se encontró sucursal_id para este usuario';
        RAISE NOTICE 'Verificando si existe el registro en rrhh_empleados...';
        
        -- Verificar si existe el registro
        IF EXISTS (
            SELECT 1 FROM rrhh_empleados WHERE usuario_id = v_user_id
        ) THEN
            RAISE NOTICE '⚠️ El registro existe pero sucursal_id es NULL';
        ELSE
            RAISE NOTICE '❌ No existe registro en rrhh_empleados para este usuario_id';
        END IF;
    ELSE
        RAISE NOTICE '✅ Sucursal ID encontrada: %', v_sucursal_id;
        
        -- Verificar nombre de la sucursal
        DECLARE
            v_sucursal_nombre TEXT;
        BEGIN
            SELECT nombre INTO v_sucursal_nombre
            FROM sucursales
            WHERE id = v_sucursal_id;
            
            IF v_sucursal_nombre IS NOT NULL THEN
                RAISE NOTICE '✅ Nombre de sucursal: %', v_sucursal_nombre;
            ELSE
                RAISE NOTICE '⚠️ Sucursal ID existe pero no se encontró el nombre';
            END IF;
        END;
    END IF;
END $$;

-- PASO 4: Probar la función directamente (esto requiere estar autenticado como el usuario)
-- ===========================================
-- NOTA: Esta parte solo funcionará si ejecutas esto como el usuario alberdi
-- Para probar desde el código, necesitas hacerlo desde la aplicación

-- PASO 5: Verificar el código de la función get_user_sucursal_id
-- ===========================================
SELECT 
    pg_get_functiondef(oid) as funcion_definicion
FROM pg_proc
WHERE proname = 'get_user_sucursal_id'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- PASO 6: Verificar si hay problemas con RLS en la función
-- ===========================================
-- La función usa SECURITY DEFINER, así que debería poder leer sin restricciones RLS
-- Pero verifiquemos que la función esté correctamente definida

