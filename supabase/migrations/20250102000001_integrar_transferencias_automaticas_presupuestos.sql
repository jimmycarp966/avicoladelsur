-- ===========================================
-- MIGRACIÓN: Integración Completa de Transferencias Automáticas con Flujo de Presupuestos
-- Fecha: 2025-01-02
-- Descripción: Asegura que las transferencias automáticas sigan el mismo flujo que presupuestos
-- ===========================================

BEGIN;

-- ===========================================
-- ACTUALIZAR CONSTRAINT DE ESTADOS
-- ===========================================

-- Asegurar que 'solicitud_automatica' esté incluido en el constraint
ALTER TABLE transferencias_stock DROP CONSTRAINT IF EXISTS transferencias_stock_estado_check;
ALTER TABLE transferencias_stock ADD CONSTRAINT transferencias_stock_estado_check 
CHECK (estado IN (
    'solicitud', 'en_almacen', 'preparado', 'en_ruta', 'entregado', 'recibido', 'cancelada', 
    'pendiente', 'en_transito', 'recibida', -- compatibilidad con flujo antiguo
    'solicitud_automatica' -- estado para solicitudes automáticas pendientes de aprobación
));

-- ===========================================
-- ACTUALIZAR FUNCIÓN DE APROBACIÓN PARA RESERVAR STOCK
-- ===========================================

-- La función fn_reservar_stock_solicitud_automatica ya está creada en 20250102_transferencias_automaticas.sql
-- Solo necesitamos asegurar que se use correctamente

COMMIT;

-- Comentarios
COMMENT ON CONSTRAINT transferencias_stock_estado_check ON transferencias_stock IS 
'Estados válidos: solicitud_automatica (pendiente aprobación) → en_almacen (aparece en Presupuestos del Día) → preparado → en_ruta → entregado → recibido';

