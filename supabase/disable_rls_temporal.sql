-- ===========================================
-- DESACTIVAR RLS TEMPORALMENTE (SOLO PRUEBAS)
-- ===========================================
-- ⚠️ ADVERTENCIA: Este script desactiva RLS de TODAS las tablas
-- ⚠️ SOLO USAR EN AMBIENTE DE DESARROLLO/PRUEBAS
-- ⚠️ NUNCA EJECUTAR EN PRODUCCIÓN
-- ===========================================

-- Opción 1: Desactivar RLS solo de la tabla vehiculos
-- ===========================================
ALTER TABLE vehiculos DISABLE ROW LEVEL SECURITY;

-- Opción 2: Desactivar RLS de TODAS las tablas (descomentar si necesitas)
-- ===========================================
-- ALTER TABLE productos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vehiculos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE lotes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE movimientos_stock DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE checklists_calidad DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE detalles_pedido DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE cotizaciones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE detalles_cotizacion DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE reclamos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE checklists_vehiculos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE rutas_reparto DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE detalles_ruta DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tesoreria_cajas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tesoreria_movimientos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE gastos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE gastos_categorias DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE cuentas_corrientes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE cuentas_movimientos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE reportes_export DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE ubicaciones_repartidores DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE rutas_planificadas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE alertas_reparto DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vehiculos_estado DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE plan_rutas_semanal DISABLE ROW LEVEL SECURITY;

-- ===========================================
-- PARA REACTIVAR RLS DESPUÉS DE PRUEBAS:
-- ===========================================
-- Ejecutar: supabase/migrations/20251127_fix_rls_vehiculos.sql
-- O reactivar manualmente:
-- ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;

