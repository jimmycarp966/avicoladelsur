-- ===========================================
-- VERIFICAR POLÍTICAS ACTIVAS Y FUNCIONES
-- ===========================================

-- 1. Verificar funciones
SELECT 
    'Funciones helper:' as tipo,
    proname as nombre,
    CASE 
        WHEN proname = 'get_user_role' THEN 'Retorna rol del usuario'
        WHEN proname = 'get_user_sucursal_id' THEN 'Retorna sucursal_id del usuario'
    END as descripcion
FROM pg_proc 
WHERE proname IN ('get_user_role', 'get_user_sucursal_id')
ORDER BY proname;

-- 2. Verificar políticas de pedidos
SELECT 
    'Políticas de pedidos:' as tipo,
    policyname,
    cmd as operacion,
    CASE 
        WHEN qual LIKE '%get_user_role%' THEN 'Usa función get_user_role()'
        WHEN qual LIKE '%usuarios%' THEN 'Consulta tabla usuarios directamente'
        ELSE 'Otra condición'
    END as tipo_verificacion,
    qual as condicion
FROM pg_policies
WHERE tablename = 'pedidos'
ORDER BY policyname;

-- 3. Verificar políticas de clientes
SELECT 
    'Políticas de clientes:' as tipo,
    policyname,
    cmd as operacion,
    CASE 
        WHEN qual LIKE '%get_user_role%' THEN 'Usa función get_user_role()'
        WHEN qual LIKE '%usuarios%' THEN 'Consulta tabla usuarios directamente'
        ELSE 'Otra condición'
    END as tipo_verificacion,
    qual as condicion
FROM pg_policies
WHERE tablename = 'clientes'
ORDER BY policyname;

-- 4. Verificar RLS habilitado
SELECT 
    'Estado RLS:' as tipo,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename IN ('pedidos', 'clientes')
AND schemaname = 'public';

-- 5. Contar políticas por tabla
SELECT 
    'Resumen de políticas:' as tipo,
    tablename,
    COUNT(*) as total_politicas,
    STRING_AGG(policyname, ', ') as nombres_politicas
FROM pg_policies
WHERE tablename IN ('pedidos', 'clientes')
GROUP BY tablename;

