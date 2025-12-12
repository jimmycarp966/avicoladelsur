-- ===========================================
-- SCRIPT DE LIMPIEZA: Borrar datos de prueba
-- Fecha: 12/12/2025
-- ⚠️ CUIDADO: Este script borra datos reales
-- Solo ejecutar en ambiente de pruebas
-- ===========================================

BEGIN;

-- Fechas a limpiar (hoy y mañana)
DO $$
DECLARE
    v_fecha_hoy DATE := CURRENT_DATE;
    v_fecha_manana DATE := CURRENT_DATE + INTERVAL '1 day';
    v_count_presupuestos INTEGER;
    v_count_pedidos INTEGER;
    v_count_rutas INTEGER;
    v_count_entregas INTEGER;
BEGIN
    RAISE NOTICE '=== LIMPIEZA DE DATOS DE PRUEBA ===';
    RAISE NOTICE 'Fecha hoy: %', v_fecha_hoy;
    RAISE NOTICE 'Fecha mañana: %', v_fecha_manana;
    
    -- 1. Contar registros antes de borrar
    SELECT COUNT(*) INTO v_count_presupuestos
    FROM presupuestos 
    WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana);
    
    SELECT COUNT(*) INTO v_count_pedidos
    FROM pedidos 
    WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana);
    
    SELECT COUNT(*) INTO v_count_rutas
    FROM rutas_reparto 
    WHERE fecha_ruta IN (v_fecha_hoy, v_fecha_manana);
    
    SELECT COUNT(*) INTO v_count_entregas
    FROM entregas e
    JOIN pedidos p ON p.id = e.pedido_id
    WHERE p.fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana);
    
    RAISE NOTICE 'Presupuestos a borrar: %', v_count_presupuestos;
    RAISE NOTICE 'Pedidos a borrar: %', v_count_pedidos;
    RAISE NOTICE 'Rutas a borrar: %', v_count_rutas;
    RAISE NOTICE 'Entregas a borrar: %', v_count_entregas;
    
    -- 2. Borrar alertas de reparto
    DELETE FROM alertas_reparto
    WHERE ruta_reparto_id IN (
        SELECT id FROM rutas_reparto WHERE fecha_ruta IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Alertas de reparto borradas';
    
    -- 3. Borrar ubicaciones de repartidores (del día)
    DELETE FROM ubicaciones_repartidores
    WHERE created_at::date IN (v_fecha_hoy, v_fecha_manana);
    RAISE NOTICE 'Ubicaciones de repartidores borradas';
    
    -- 4. Borrar rutas planificadas
    DELETE FROM rutas_planificadas
    WHERE fecha IN (v_fecha_hoy, v_fecha_manana);
    RAISE NOTICE 'Rutas planificadas borradas';
    
    -- 5. Borrar detalles de ruta
    DELETE FROM detalles_ruta
    WHERE ruta_id IN (
        SELECT id FROM rutas_reparto WHERE fecha_ruta IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Detalles de ruta borrados';
    
    -- 5.5 Limpiar referencia ruta_activa_id en vehiculos_estado
    UPDATE vehiculos_estado
    SET ruta_activa_id = NULL
    WHERE ruta_activa_id IN (
        SELECT id FROM rutas_reparto WHERE fecha_ruta IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Referencias ruta_activa_id en vehiculos_estado limpiadas';
    
    -- 6. Borrar rutas de reparto
    DELETE FROM rutas_reparto 
    WHERE fecha_ruta IN (v_fecha_hoy, v_fecha_manana);
    RAISE NOTICE 'Rutas de reparto borradas';
    
    -- 7. Borrar movimientos de cuentas corrientes relacionados
    DELETE FROM cuentas_movimientos
    WHERE origen_tipo = 'entrega'
    AND origen_id IN (
        SELECT e.id FROM entregas e
        JOIN pedidos p ON p.id = e.pedido_id
        WHERE p.fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Movimientos de cuenta corriente borrados';
    
    -- 8. Borrar movimientos de tesorería relacionados
    DELETE FROM tesoreria_movimientos
    WHERE origen_tipo = 'entrega'
    AND origen_id IN (
        SELECT e.id FROM entregas e
        JOIN pedidos p ON p.id = e.pedido_id
        WHERE p.fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Movimientos de tesorería borrados';
    
    -- 9. Borrar detalles de pedido
    DELETE FROM detalles_pedido
    WHERE pedido_id IN (
        SELECT id FROM pedidos WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Detalles de pedido borrados';
    
    -- 10. Borrar entregas
    DELETE FROM entregas
    WHERE pedido_id IN (
        SELECT id FROM pedidos WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Entregas borradas';
    
    -- 11. IMPORTANTE: Limpiar referencia pedido_convertido_id en presupuestos ANTES de borrar pedidos
    UPDATE presupuestos
    SET pedido_convertido_id = NULL
    WHERE pedido_convertido_id IN (
        SELECT id FROM pedidos WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Referencias pedido_convertido_id limpiadas';
    
    -- 12. Borrar pedidos
    DELETE FROM pedidos 
    WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana);
    RAISE NOTICE 'Pedidos borrados';
    
    -- 13. Borrar reservas de stock
    DELETE FROM stock_reservations
    WHERE presupuesto_id IN (
        SELECT id FROM presupuestos WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Reservas de stock borradas';
    
    -- 14. Borrar items de presupuesto
    DELETE FROM presupuesto_items
    WHERE presupuesto_id IN (
        SELECT id FROM presupuestos WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana)
    );
    RAISE NOTICE 'Items de presupuesto borrados';
    
    -- 15. Borrar presupuestos
    DELETE FROM presupuestos 
    WHERE fecha_entrega_estimada IN (v_fecha_hoy, v_fecha_manana);
    RAISE NOTICE 'Presupuestos borrados';
    
    RAISE NOTICE '=== LIMPIEZA COMPLETADA ===';
END
$$;

COMMIT;
