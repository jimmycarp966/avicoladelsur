-- ===========================================
-- VERIFICAR POLÍTICAS RLS DE RRHH_EMPLEADOS
-- Fecha: 2025-01-01
-- Descripción: Verifica si existe la política que permite a usuarios leer su propio registro
-- ===========================================

-- Ver todas las políticas de rrhh_empleados
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

-- Verificar si la política "empleados_read_own" existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'rrhh_empleados' 
            AND policyname = 'empleados_read_own'
        ) THEN '✅ Política empleados_read_own EXISTE'
        ELSE '❌ Política empleados_read_own NO EXISTE - Necesitas ejecutar la migración'
    END as estado_politica;

