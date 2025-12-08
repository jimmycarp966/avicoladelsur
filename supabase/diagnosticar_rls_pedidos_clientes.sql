-- ===========================================
-- DIAGNÓSTICO: Verificar políticas RLS de pedidos y clientes
-- ===========================================

-- Verificar que las funciones helper existen y funcionan
SELECT 
    'Función get_user_role:' as tipo,
    proname as nombre_funcion,
    pg_get_functiondef(oid) as definicion
FROM pg_proc 
WHERE proname = 'get_user_role';

SELECT 
    'Función get_user_sucursal_id:' as tipo,
    proname as nombre_funcion,
    pg_get_functiondef(oid) as definicion
FROM pg_proc 
WHERE proname = 'get_user_sucursal_id';

-- Verificar políticas de pedidos
SELECT 
    'Políticas de pedidos:' as tipo,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'pedidos'
ORDER BY policyname;

-- Verificar políticas de clientes
SELECT 
    'Políticas de clientes:' as tipo,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'clientes'
ORDER BY policyname;

-- Verificar usuario alberdi
SELECT 
    'Usuario alberdi:' as tipo,
    u.id as usuario_id,
    u.email,
    u.rol,
    u.activo,
    e.sucursal_id,
    s.nombre as sucursal_nombre
FROM usuarios u
LEFT JOIN rrhh_empleados e ON e.usuario_id = u.id
LEFT JOIN sucursales s ON s.id = e.sucursal_id
WHERE u.email = 'alberdi@avicoladelsur.com';

-- Probar función get_user_sucursal_id con el usuario alberdi
-- (Esto requiere ejecutarse como el usuario alberdi, pero podemos verificar la estructura)
SELECT 
    'Estructura de rrhh_empleados para alberdi:' as tipo,
    e.usuario_id,
    e.sucursal_id,
    s.nombre as sucursal_nombre
FROM rrhh_empleados e
LEFT JOIN sucursales s ON s.id = e.sucursal_id
WHERE e.usuario_id = (SELECT id FROM usuarios WHERE email = 'alberdi@avicoladelsur.com');

-- Verificar si hay pedidos para la sucursal de alberdi
SELECT 
    'Pedidos de sucursal Alberdi:' as tipo,
    COUNT(*) as total_pedidos,
    COUNT(CASE WHEN estado IN ('completado', 'entregado', 'facturado') THEN 1 END) as pedidos_completados
FROM pedidos
WHERE sucursal_id = (SELECT e.sucursal_id FROM rrhh_empleados e JOIN usuarios u ON u.id = e.usuario_id WHERE u.email = 'alberdi@avicoladelsur.com');

-- Verificar si hay clientes activos
SELECT 
    'Clientes activos:' as tipo,
    COUNT(*) as total_clientes_activos
FROM clientes
WHERE activo = true;

