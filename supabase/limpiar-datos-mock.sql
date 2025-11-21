-- ===========================================
-- LIMPIEZA DE DATOS MOCK Y CREACIÓN DE ZONAS
-- ===========================================
-- Este script elimina todos los datos de prueba del sistema
-- MANTIENE: productos, clientes, vehículos, lotes, tesorería (cajas y movimientos)
-- BORRA: presupuestos, pedidos, cotizaciones, rutas, usuarios mock, etc.
-- CREA: Zonas Monteros, Famaillá y Tafi del valle
-- ===========================================

BEGIN;

-- ===========================================
-- 0. DESACTIVAR RLS TEMPORALMENTE
-- ===========================================
-- Necesitamos desactivar RLS para poder borrar todos los datos sin restricciones
DO $$
BEGIN
    -- Desactivar RLS en todas las tablas que vamos a limpiar
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'devoluciones') THEN
        ALTER TABLE devoluciones DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_ruta') THEN
        ALTER TABLE detalles_ruta DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rutas_reparto') THEN
        ALTER TABLE rutas_reparto DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_pedido') THEN
        ALTER TABLE detalles_pedido DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_cotizacion') THEN
        ALTER TABLE detalles_cotizacion DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
        ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cotizaciones') THEN
        ALTER TABLE cotizaciones DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuesto_items') THEN
        ALTER TABLE presupuesto_items DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
        ALTER TABLE presupuestos DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_reservations') THEN
        ALTER TABLE stock_reservations DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'movimientos_stock') THEN
        ALTER TABLE movimientos_stock DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recepcion_almacen') THEN
        ALTER TABLE recepcion_almacen DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zonas_dias') THEN
        ALTER TABLE zonas_dias DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notificaciones') THEN
        ALTER TABLE notificaciones DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reclamos') THEN
        ALTER TABLE reclamos DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reportes_export') THEN
        ALTER TABLE reportes_export DISABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ===========================================
-- 1. BORRAR DATOS OPERATIVOS (orden de dependencias)
-- ===========================================
-- Ahora podemos borrar directamente sin restricciones RLS

-- Devoluciones (referencia pedidos, detalles_ruta, productos, usuarios)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'devoluciones') THEN
        EXECUTE 'DELETE FROM devoluciones';
        RAISE NOTICE 'Devoluciones borradas';
    END IF;
END $$;

-- Detalles de ruta (referencia rutas_reparto, pedidos)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_ruta') THEN
        EXECUTE 'DELETE FROM detalles_ruta';
        RAISE NOTICE 'Detalles de ruta borrados';
    END IF;
END $$;

-- Rutas de reparto (referencia vehiculos, usuarios)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rutas_reparto') THEN
        EXECUTE 'DELETE FROM rutas_reparto';
        RAISE NOTICE 'Rutas de reparto borradas';
    END IF;
END $$;

-- Detalles de pedido (referencia pedidos, productos, lotes)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_pedido') THEN
        EXECUTE 'DELETE FROM detalles_pedido';
        RAISE NOTICE 'Detalles de pedido borrados';
    END IF;
END $$;

-- Detalles de cotización (referencia cotizaciones, productos)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_cotizacion') THEN
        EXECUTE 'DELETE FROM detalles_cotizacion';
        RAISE NOTICE 'Detalles de cotización borrados';
    END IF;
END $$;

-- Pedidos (referencia clientes, usuarios, tesoreria_movimientos)
-- NOTA: Solo borramos pedidos, los movimientos de tesorería se mantienen
DO $$ 
DECLARE
    v_count INTEGER;
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
        EXECUTE 'DELETE FROM pedidos';
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Pedidos borrados: %', v_count;
    END IF;
END $$;

-- Cotizaciones (referencia clientes, usuarios)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cotizaciones') THEN
        EXECUTE 'DELETE FROM cotizaciones';
        RAISE NOTICE 'Cotizaciones borradas';
    END IF;
END $$;

-- Presupuesto items (referencia presupuestos, productos, lotes)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuesto_items') THEN
        EXECUTE 'DELETE FROM presupuesto_items';
        RAISE NOTICE 'Presupuesto items borrados';
    END IF;
END $$;

-- Presupuestos (referencia clientes, zonas, usuarios, pedidos)
DO $$ 
DECLARE
    v_count INTEGER;
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
        EXECUTE 'DELETE FROM presupuestos';
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Presupuestos borrados: %', v_count;
    END IF;
END $$;

-- Stock reservations (referencia presupuestos, lotes)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_reservations') THEN
        EXECUTE 'DELETE FROM stock_reservations';
        RAISE NOTICE 'Stock reservations borradas';
    END IF;
END $$;

-- Movimientos de stock relacionados con pedidos/presupuestos
-- Solo borramos los que tienen pedido_id (los de ingreso se mantienen)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'movimientos_stock') THEN
        EXECUTE 'DELETE FROM movimientos_stock WHERE pedido_id IS NOT NULL';
        RAISE NOTICE 'Movimientos de stock (pedidos) borrados';
    END IF;
END $$;

-- Recepción de almacén (referencia productos, lotes, usuarios)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recepcion_almacen') THEN
        EXECUTE 'DELETE FROM recepcion_almacen';
        RAISE NOTICE 'Recepción de almacén borrada';
    END IF;
END $$;

-- Zonas días (referencia zonas) - solo si hay datos mock
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zonas_dias') THEN
        EXECUTE 'DELETE FROM zonas_dias';
        RAISE NOTICE 'Zonas días borradas';
    END IF;
END $$;

-- Notificaciones (referencia usuarios)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notificaciones') THEN
        EXECUTE 'DELETE FROM notificaciones';
        RAISE NOTICE 'Notificaciones borradas';
    END IF;
END $$;

-- Reclamos (referencia clientes, pedidos, usuarios)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reclamos') THEN
        EXECUTE 'DELETE FROM reclamos';
        RAISE NOTICE 'Reclamos borrados';
    END IF;
END $$;

-- Reportes export (referencia usuarios)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reportes_export') THEN
        EXECUTE 'DELETE FROM reportes_export';
        RAISE NOTICE 'Reportes export borrados';
    END IF;
END $$;

-- ===========================================
-- 2. BORRAR USUARIOS MOCK (EXCEPTO ADMIN)
-- ===========================================
-- Solo borramos los usuarios de ejemplo, NO el admin
-- El admin se mantiene para poder hacer login
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM usuarios 
    WHERE email IN (
        'vendedor@avicoladelsur.com',
        'repartidor@avicoladelsur.com',
        'almacenista@avicoladelsur.com'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Usuarios mock borrados (excepto admin): %', v_count;
    RAISE NOTICE 'Usuario admin MANTENIDO: admin@avicoladelsur.com';
END $$;

-- ===========================================
-- 3. CREAR ZONAS
-- ===========================================
-- Crear las zonas solicitadas si no existen
INSERT INTO zonas (nombre, descripcion, activo)
VALUES 
    ('Monteros', 'Zona de entrega Monteros', true),
    ('Famaillá', 'Zona de entrega Famaillá', true),
    ('Tafi del valle', 'Zona de entrega Tafi del valle', true)
ON CONFLICT (nombre) DO NOTHING;

-- ===========================================
-- 4. VERIFICACIONES (opcional - comentar si no se necesita)
-- ===========================================

-- Verificar que se borraron los datos
DO $$
DECLARE
    v_pedidos_count INTEGER := 0;
    v_presupuestos_count INTEGER := 0;
    v_rutas_count INTEGER := 0;
    v_zonas_count INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
        SELECT COUNT(*) INTO v_pedidos_count FROM pedidos;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
        SELECT COUNT(*) INTO v_presupuestos_count FROM presupuestos;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rutas_reparto') THEN
        SELECT COUNT(*) INTO v_rutas_count FROM rutas_reparto;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zonas') THEN
        SELECT COUNT(*) INTO v_zonas_count FROM zonas WHERE nombre IN ('Monteros', 'Famaillá', 'Tafi del valle');
    END IF;
    
    RAISE NOTICE 'Pedidos restantes: %', v_pedidos_count;
    RAISE NOTICE 'Presupuestos restantes: %', v_presupuestos_count;
    RAISE NOTICE 'Rutas restantes: %', v_rutas_count;
    RAISE NOTICE 'Zonas creadas: %', v_zonas_count;
END $$;

-- ===========================================
-- 5. REACTIVAR RLS
-- ===========================================
DO $$
BEGIN
    -- Reactivar RLS en todas las tablas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'devoluciones') THEN
        ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_ruta') THEN
        ALTER TABLE detalles_ruta ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rutas_reparto') THEN
        ALTER TABLE rutas_reparto ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_pedido') THEN
        ALTER TABLE detalles_pedido ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'detalles_cotizacion') THEN
        ALTER TABLE detalles_cotizacion ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
        ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cotizaciones') THEN
        ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuesto_items') THEN
        ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
        ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_reservations') THEN
        ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'movimientos_stock') THEN
        ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recepcion_almacen') THEN
        ALTER TABLE recepcion_almacen ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zonas_dias') THEN
        ALTER TABLE zonas_dias ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notificaciones') THEN
        ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reclamos') THEN
        ALTER TABLE reclamos ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reportes_export') THEN
        ALTER TABLE reportes_export ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
    END IF;
    RAISE NOTICE 'RLS reactivado en todas las tablas';
END $$;

COMMIT;

-- ===========================================
-- RESUMEN
-- ===========================================
-- Datos MANTENIDOS:
--   - productos
--   - clientes
--   - vehiculos
--   - lotes
--   - tesoreria_cajas
--   - tesoreria_movimientos
--   - gastos
--   - cuentas_corrientes
--   - cuentas_movimientos
--
-- Datos BORRADOS:
--   - presupuestos y presupuesto_items
--   - pedidos y detalles_pedido
--   - cotizaciones y detalles_cotizacion
--   - rutas_reparto y detalles_ruta
--   - devoluciones
--   - stock_reservations
--   - movimientos_stock (solo los de pedidos)
--   - recepcion_almacen
--   - notificaciones
--   - reclamos
--   - reportes_export
--   - usuarios mock (vendedor, repartidor, almacenista)
--   - NOTA: El usuario admin se MANTIENE para poder hacer login
--
-- Zonas CREADAS:
--   - Monteros
--   - Famaillá
--   - Tafi del valle
-- ===========================================

