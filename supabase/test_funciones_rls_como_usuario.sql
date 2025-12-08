-- ===========================================
-- TEST: Verificar funciones RLS como usuario alberdi
-- IMPORTANTE: Este script debe ejecutarse DESPUÉS de autenticarse como alberdi@avicoladelsur.com
-- ===========================================

-- 1. Verificar que estamos autenticados
SELECT 
    'Usuario autenticado:' as tipo,
    auth.uid() as user_id,
    auth.email() as email;

-- 2. Probar función get_user_role()
SELECT 
    'get_user_role() resultado:' as tipo,
    get_user_role() as rol_obtenido;

-- 3. Probar función get_user_sucursal_id()
SELECT 
    'get_user_sucursal_id() resultado:' as tipo,
    get_user_sucursal_id() as sucursal_id_obtenido;

-- 4. Verificar usuario en tabla usuarios
SELECT 
    'Usuario en tabla usuarios:' as tipo,
    id,
    email,
    rol,
    activo
FROM usuarios
WHERE id = auth.uid();

-- 5. Verificar empleado en rrhh_empleados
SELECT 
    'Empleado en rrhh_empleados:' as tipo,
    usuario_id,
    sucursal_id
FROM rrhh_empleados
WHERE usuario_id = auth.uid();

-- 6. Probar consulta directa de pedidos (debe funcionar si las políticas están bien)
SELECT 
    'Test pedidos (debe retornar datos):' as tipo,
    COUNT(*) as total_pedidos
FROM pedidos
LIMIT 1;

-- 7. Probar consulta directa de clientes (debe funcionar si las políticas están bien)
SELECT 
    'Test clientes (debe retornar datos):' as tipo,
    COUNT(*) as total_clientes
FROM clientes
LIMIT 1;

