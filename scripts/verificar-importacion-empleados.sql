-- ===========================================
-- SCRIPT DE VERIFICACIÓN DE IMPORTACIÓN
-- Fecha: 2025-11-26
-- ===========================================
-- Verifica el estado de las categorías, sucursales y empleados

-- 1. Verificar categorías
SELECT 'CATEGORÍAS' as tipo, COUNT(*) as total
FROM rrhh_categorias
UNION ALL
SELECT 'CATEGORÍAS ACTIVAS', COUNT(*)
FROM rrhh_categorias
WHERE activo = true;

-- 2. Listar todas las categorías
SELECT id, nombre, sueldo_basico, activo
FROM rrhh_categorias
ORDER BY nombre;

-- 3. Verificar sucursales
SELECT 'SUCURSALES' as tipo, COUNT(*) as total
FROM sucursales
UNION ALL
SELECT 'SUCURSALES ACTIVAS', COUNT(*)
FROM sucursales
WHERE activo = true;

-- 4. Listar sucursales
SELECT id, nombre, activo
FROM sucursales
ORDER BY nombre;

    -- 5. Verificar empleados (TOTALES)
SELECT 'EMPLEADOS TOTALES' as tipo, COUNT(*) as total
FROM rrhh_empleados
UNION ALL
SELECT 'EMPLEADOS ACTIVOS', COUNT(*)
FROM rrhh_empleados
WHERE activo = true
UNION ALL
SELECT 'EMPLEADOS INACTIVOS', COUNT(*)
FROM rrhh_empleados
WHERE activo = false;

-- 6. Listar TODOS los empleados (activos e inactivos) con sus categorías y sucursales
SELECT 
    e.id,
    e.legajo,
    e.nombre,
    e.apellido,
    c.nombre as categoria,
    s.nombre as sucursal,
    e.sueldo_actual,
    e.valor_jornal_presentismo,
    e.valor_hora,
    e.activo,
    e.usuario_id,
    e.created_at
FROM rrhh_empleados e
LEFT JOIN rrhh_categorias c ON e.categoria_id = c.id
LEFT JOIN sucursales s ON e.sucursal_id = s.id
ORDER BY e.created_at DESC;

-- 7. Listar SOLO empleados activos (como los busca la aplicación)
SELECT 
    e.id,
    e.legajo,
    e.nombre,
    e.apellido,
    c.nombre as categoria,
    s.nombre as sucursal,
    e.sueldo_actual,
    e.valor_jornal_presentismo,
    e.valor_hora,
    e.activo,
    e.usuario_id,
    e.created_at
FROM rrhh_empleados e
LEFT JOIN rrhh_categorias c ON e.categoria_id = c.id
LEFT JOIN sucursales s ON e.sucursal_id = s.id
WHERE e.activo = true
ORDER BY e.created_at DESC;

-- 8. Verificar empleados sin categoría
SELECT 
    e.legajo,
    e.nombre,
    e.apellido,
    e.categoria_id,
    'SIN CATEGORÍA' as error
FROM rrhh_empleados e
WHERE e.categoria_id IS NULL;

-- 9. Verificar empleados sin sucursal
SELECT 
    e.legajo,
    e.nombre,
    e.apellido,
    e.sucursal_id,
    'SIN SUCURSAL' as error
FROM rrhh_empleados e
WHERE e.sucursal_id IS NULL;

-- 10. Verificar empleados sin nombre o apellido
SELECT 
    e.legajo,
    e.nombre,
    e.apellido,
    e.usuario_id,
    'SIN NOMBRE/APELLIDO' as error
FROM rrhh_empleados e
WHERE (e.nombre IS NULL OR e.nombre = '') 
   AND (e.apellido IS NULL OR e.apellido = '')
   AND e.usuario_id IS NULL;

-- 11. Verificar RLS (Row Level Security) - Ver si hay políticas que bloqueen
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'rrhh_empleados';

