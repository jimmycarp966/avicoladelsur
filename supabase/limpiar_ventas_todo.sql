-- ==============================================================================
-- SCRIPT DE LIMPIEZA DE VENTAS (RESET TOTAL DE OPERACIONES) - VERSION FINAL CORREGIDA
-- ==============================================================================

BEGIN;

-- 1. DESACTIVAR RLS (Solo si la tabla existe)
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'devoluciones', 'reclamos', 'detalles_ruta', 'rutas_reparto', 
        'checklists_vehiculos', 'ubicaciones_repartidores', 'alertas_reparto',
        'factura_items', 'facturas', 'detalles_pedido', 'pedidos',
        'detalles_cotizacion', 'cotizaciones', 'presupuesto_items', 'presupuestos',
        'stock_reservations', 'cuentas_movimientos', 'tesoreria_movimientos',
        'movimientos_stock', 'notificaciones', 'reportes_export',
        'cuentas_corrientes', 'tesoreria_cajas'
    ];
BEGIN
    -- RAISE NOTICE 'Desactivando RLS...';
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
        END IF;
    END LOOP;
END $$;

-- 2. ROMPER DEPENDENCIAS CIRCULARES
DO $$
BEGIN
    -- Presupuestos -> Pedidos (pedido_convertido_id)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'presupuestos' AND column_name = 'pedido_convertido_id') THEN
        EXECUTE 'UPDATE presupuestos SET pedido_convertido_id = NULL';
    END IF;
    
    -- Vehiculos -> Rutas (ruta_activa_id)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'vehiculos_estado' AND column_name = 'ruta_activa_id') THEN
        EXECUTE 'UPDATE vehiculos_estado SET ruta_activa_id = NULL';
    END IF;
END $$;

-- 3. BORRAR DATOS (Orden corregido para integridad referencial)
DO $$
BEGIN
    -- Soporte / Post-Venta
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'devoluciones') THEN DELETE FROM devoluciones; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reclamos') THEN DELETE FROM reclamos; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notificaciones') THEN DELETE FROM notificaciones; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reportes_export') THEN DELETE FROM reportes_export; END IF;

    -- Reparto / Logística (Orden: Detalles -> Rutas -> Checklists)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'alertas_reparto') THEN DELETE FROM alertas_reparto; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ubicaciones_repartidores') THEN DELETE FROM ubicaciones_repartidores; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'detalles_ruta') THEN DELETE FROM detalles_ruta; END IF;
    
    -- Rutas antes que Checklists (si ruta references checklist)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rutas_reparto') THEN DELETE FROM rutas_reparto; END IF;
    
    -- Checklists (liberados de rutas)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklists_vehiculos') THEN DELETE FROM checklists_vehiculos; END IF;


    -- Facturación
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'factura_items') THEN DELETE FROM factura_items; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'facturas') THEN DELETE FROM facturas; END IF;

    -- Movimientos Financieros
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cuentas_movimientos') THEN 
        DELETE FROM cuentas_movimientos WHERE origen_tipo IN ('pedido', 'entrega', 'venta', 'factura', 'presupuesto');
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tesoreria_movimientos') THEN 
        DELETE FROM tesoreria_movimientos WHERE origen_tipo IN ('pedido', 'entrega', 'venta', 'factura', 'cobro_cliente');
    END IF;

    -- Resetear saldos (si existen las tablas)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cuentas_corrientes') THEN UPDATE cuentas_corrientes SET saldo = 0; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tesoreria_cajas') THEN UPDATE tesoreria_cajas SET saldo_actual = saldo_inicial; END IF;

    -- Pedidos y Ventas
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'detalles_pedido') THEN DELETE FROM detalles_pedido; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'movimientos_stock') THEN DELETE FROM movimientos_stock WHERE pedido_id IS NOT NULL; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pedidos') THEN DELETE FROM pedidos; END IF;

    -- Cotizaciones y Presupuestos
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'detalles_cotizacion') THEN DELETE FROM detalles_cotizacion; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cotizaciones') THEN DELETE FROM cotizaciones; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_reservations') THEN DELETE FROM stock_reservations; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'presupuesto_items') THEN DELETE FROM presupuesto_items; END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'presupuestos') THEN DELETE FROM presupuestos; END IF;
END $$;

-- 4. REACTIVAR RLS
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'devoluciones', 'reclamos', 'detalles_ruta', 'rutas_reparto', 
        'checklists_vehiculos', 'ubicaciones_repartidores', 'alertas_reparto',
        'factura_items', 'facturas', 'detalles_pedido', 'pedidos',
        'detalles_cotizacion', 'cotizaciones', 'presupuesto_items', 'presupuestos',
        'stock_reservations', 'cuentas_movimientos', 'tesoreria_movimientos',
        'movimientos_stock', 'notificaciones', 'reportes_export',
        'cuentas_corrientes', 'tesoreria_cajas'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        END IF;
    END LOOP;
    
    RAISE NOTICE '=== LIMPIEZA COMPLETADA ===';
END $$;

COMMIT;
