-- ===========================================
-- TEST DIRECTO: Verificar RLS para usuario alberdi
-- ===========================================

-- 1. Verificar usuario y rol
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

-- 2. Probar función get_user_role() como el usuario alberdi
-- (Esto requiere ejecutarse como el usuario, pero podemos simular)
SELECT 
    'Función get_user_role simulada:' as tipo,
    (SELECT rol FROM usuarios WHERE email = 'alberdi@avicoladelsur.com') as rol_obtenido;

-- 3. Probar función get_user_sucursal_id() como el usuario alberdi
SELECT 
    'Función get_user_sucursal_id simulada:' as tipo,
    (SELECT e.sucursal_id 
     FROM rrhh_empleados e 
     JOIN usuarios u ON u.id = e.usuario_id
     WHERE u.email = 'alberdi@avicoladelsur.com'
     LIMIT 1) as sucursal_id_obtenido;

-- 4. Verificar políticas actuales de pedidos
SELECT 
    'Políticas de pedidos:' as tipo,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'pedidos'
ORDER BY policyname;

-- 5. Verificar políticas actuales de clientes
SELECT 
    'Políticas de clientes:' as tipo,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'clientes'
ORDER BY policyname;

-- 6. Probar consulta directa de pedidos (simulando condiciones)
SELECT 
    'Pedidos disponibles para alberdi (simulado):' as tipo,
    COUNT(*) as total_pedidos,
    COUNT(CASE WHEN estado IN ('completado', 'entregado', 'facturado') THEN 1 END) as pedidos_completados
FROM pedidos
WHERE 
    -- Condición 1: Es admin? (NO para alberdi)
    FALSE OR
    -- Condición 2: Es vendedor? (SÍ para alberdi)
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE email = 'alberdi@avicoladelsur.com'
        AND rol = 'vendedor' 
        AND activo = true
    ) OR
    -- Condición 3: Tiene sucursal y coincide?
    (
        sucursal_id IS NOT NULL AND 
        sucursal_id = (
            SELECT e.sucursal_id 
            FROM rrhh_empleados e 
            JOIN usuarios u ON u.id = e.usuario_id
            WHERE u.email = 'alberdi@avicoladelsur.com'
            LIMIT 1
        )
    );

-- 7. Probar consulta directa de clientes (simulando condiciones)
SELECT 
    'Clientes disponibles para alberdi (simulado):' as tipo,
    COUNT(*) as total_clientes
FROM clientes
WHERE 
    -- Condición 1: Es admin? (NO para alberdi)
    FALSE OR
    -- Condición 2: Es vendedor? (SÍ para alberdi)
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE email = 'alberdi@avicoladelsur.com'
        AND rol = 'vendedor' 
        AND activo = true
    );

-- 8. Verificar si RLS está habilitado
SELECT 
    'RLS habilitado:' as tipo,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename IN ('pedidos', 'clientes')
AND schemaname = 'public';

