-- ===========================================
-- SCRIPT PARA LIMPIAR RUTAS Y PEDIDOS
-- ===========================================
-- Este script elimina todas las rutas históricas y todos los pedidos
-- de la base de datos para permitir pruebas desde cero.
-- 
-- ⚠️ ADVERTENCIA: Este script es DESTRUCTIVO y eliminará TODOS los datos
-- de rutas y pedidos. Úsalo solo en desarrollo/testing.
-- ===========================================

BEGIN;

-- ===========================================
-- 1. ELIMINAR DATOS RELACIONADOS CON RUTAS
-- ===========================================

-- Eliminar ubicaciones de repartidores (pueden tener ruta_activa_id)
DELETE FROM ubicaciones_repartidores;

-- Eliminar alertas de reparto (pueden referenciar rutas)
DELETE FROM alertas_reparto;

-- Eliminar detalles de ruta (referencia rutas_reparto y pedidos)
-- Esto también eliminará las relaciones entre rutas y pedidos
DELETE FROM detalles_ruta;

-- Eliminar rutas planificadas (tiene ON DELETE CASCADE con rutas_reparto)
-- Pero lo hacemos explícitamente por si acaso
DELETE FROM rutas_planificadas;

-- Eliminar optimizaciones de rutas si existen
-- La columna correcta es ruta_reparto_id, no ruta_id
DELETE FROM optimizaciones_rutas WHERE EXISTS (
    SELECT 1 FROM rutas_reparto WHERE id = optimizaciones_rutas.ruta_reparto_id
);

-- Eliminar métricas de rutas (no tiene relación directa con rutas_reparto, pero las limpiamos)
-- Las métricas son agregadas por fecha, así que las eliminamos todas
DELETE FROM metricas_rutas;

-- Limpiar referencias de rutas en vehiculos_estado (tiene ruta_activa_id)
UPDATE vehiculos_estado SET ruta_activa_id = NULL WHERE ruta_activa_id IS NOT NULL;

-- Limpiar referencias de planes semanales en rutas_reparto (plan_ruta_id)
-- Esto permite mantener los planes semanales como configuración
UPDATE rutas_reparto SET plan_ruta_id = NULL WHERE plan_ruta_id IS NOT NULL;

-- Eliminar todas las rutas de reparto
-- NOTA: Los planes semanales se mantienen porque son configuración, no datos históricos
DELETE FROM rutas_reparto;

-- ===========================================
-- 2. ELIMINAR DATOS RELACIONADOS CON PEDIDOS
-- ===========================================

-- Limpiar referencias de entregas en detalles_pedido (tiene entrega_id)
UPDATE detalles_pedido SET entrega_id = NULL WHERE entrega_id IS NOT NULL;

-- Eliminar entregas (referencia pedidos con ON DELETE CASCADE, pero lo hacemos explícitamente)
DELETE FROM entregas;

-- Actualizar presupuestos que fueron convertidos a pedidos (limpiar referencia)
-- Esto permite que los presupuestos vuelvan a estar disponibles para convertir
UPDATE presupuestos 
SET pedido_convertido_id = NULL 
WHERE pedido_convertido_id IS NOT NULL;

-- Eliminar detalles de pedido (referencia pedidos, probablemente con ON DELETE CASCADE)
DELETE FROM detalles_pedido;

-- Eliminar reclamos relacionados con pedidos
DELETE FROM reclamos WHERE pedido_id IS NOT NULL;

-- Eliminar movimientos de tesorería relacionados con pedidos
-- (si el origen es un pedido)
DELETE FROM tesoreria_movimientos 
WHERE origen_tipo = 'pedido' AND origen_id IN (SELECT id FROM pedidos);

-- Eliminar facturas relacionadas con pedidos (si existe la relación)
-- Nota: Ajusta según tu esquema de facturas
-- DELETE FROM facturas WHERE pedido_id IS NOT NULL;

-- Eliminar todos los pedidos
DELETE FROM pedidos;

-- ===========================================
-- 3. RESETEAR SECUENCIAS (OPCIONAL)
-- ===========================================
-- Si tienes secuencias para números de pedidos o rutas, puedes resetearlas aquí
-- Ejemplo:
-- ALTER SEQUENCE IF EXISTS pedidos_numero_pedido_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS rutas_reparto_numero_ruta_seq RESTART WITH 1;

COMMIT;

-- ===========================================
-- VERIFICACIÓN
-- ===========================================
-- Ejecuta estas consultas para verificar que todo se eliminó correctamente:

-- SELECT COUNT(*) as total_rutas FROM rutas_reparto;
-- SELECT COUNT(*) as total_pedidos FROM pedidos;
-- SELECT COUNT(*) as total_detalles_ruta FROM detalles_ruta;
-- SELECT COUNT(*) as total_entregas FROM entregas;
-- SELECT COUNT(*) as total_rutas_planificadas FROM rutas_planificadas;

