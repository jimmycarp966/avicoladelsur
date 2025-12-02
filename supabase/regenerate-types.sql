-- Script to help regenerate database types after fixing tesoreria_cajas
-- Run this in Supabase SQL Editor to verify all tables exist

-- Check all main tables
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'usuarios',
    'clientes',
    'productos',
    'lotes',
    'pedidos',
    'detalles_pedido',
    'presupuestos',
    'detalles_presupuesto',
    'vehiculos',
    'rutas_reparto',
    'detalles_ruta',
    'ubicaciones_repartidores',
    'tesoreria_cajas',
    'tesoreria_movimientos',
    'alertas_reparto',
    'zonas',
    'cuentas_corrientes'
)
ORDER BY tablename;

-- Check if RLS is enabled on tesoreria_cajas
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'tesoreria_cajas';

-- Check policies on tesoreria_cajas
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'tesoreria_cajas';




























