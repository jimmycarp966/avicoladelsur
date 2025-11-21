-- ===========================================
-- REACTIVAR RLS DE TODO EL SISTEMA
-- ===========================================
-- Script para reactivar RLS después de pruebas
-- ===========================================

-- Reactivar RLS de TODAS las tablas del sistema (verificando existencia)
-- ===========================================

DO $$ 
DECLARE
    v_table_name TEXT;
    v_tables TEXT[] := ARRAY[
        -- Tablas maestras
        'productos',
        'clientes',
        'vehiculos',
        'usuarios',
        -- Tablas de almacén
        'lotes',
        'movimientos_stock',
        'checklists_calidad',
        'recepcion_almacen',
        -- Tablas de ventas
        'pedidos',
        'detalles_pedido',
        'cotizaciones',
        'detalles_cotizacion',
        'presupuestos',
        'presupuesto_items',
        'stock_reservations',
        'reclamos',
        'devoluciones',
        -- Tablas de reparto
        'checklists_vehiculos',
        'rutas_reparto',
        'detalles_ruta',
        'ubicaciones_repartidores',
        'rutas_planificadas',
        'alertas_reparto',
        'vehiculos_estado',
        'plan_rutas_semanal',
        -- Tablas de tesorería
        'tesoreria_cajas',
        'tesoreria_movimientos',
        'gastos',
        'gastos_categorias',
        'cuentas_corrientes',
        'cuentas_movimientos',
        -- Tablas de configuración y reportes
        'zonas',
        'zonas_dias',
        'reportes_export',
        'notificaciones',
        -- Tablas opcionales
        'cierres_caja',
        'tesoro'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY v_tables
    LOOP
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table_name);
            RAISE NOTICE 'RLS reactivado en tabla: %', v_table_name;
        ELSE
            RAISE NOTICE 'Tabla no encontrada (se omite): %', v_table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Proceso completado. RLS reactivado en todas las tablas existentes.';
END $$;

-- ===========================================
-- NOTA: Después de reactivar RLS, asegúrate de que
-- las políticas estén creadas correctamente.
-- Ver: supabase/migrations/20251127_fix_rls_vehiculos.sql
-- ===========================================

