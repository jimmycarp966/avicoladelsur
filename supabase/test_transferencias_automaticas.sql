-- ===========================================
-- SCRIPT: Pruebas de Transferencias Automáticas
-- Fecha: 2025-01-02
-- Descripción: Verifica el flujo completo de transferencias automáticas
-- ===========================================

-- ===========================================
-- CONFIGURACIÓN INICIAL
-- ===========================================

-- Variables de prueba
DO $$
DECLARE
    v_sucursal_central_id UUID := '00000000-0000-0000-0000-000000000001';
    v_sucursal_test_id UUID;
    v_producto_test_id UUID;
    v_lote_origen_id UUID;
    v_lote_destino_id UUID;
    v_transferencia_id UUID;
    v_pedido_id UUID;
BEGIN
    -- Crear sucursal de prueba si no existe
    INSERT INTO sucursales (id, nombre, direccion, telefono, active)
    VALUES (
        gen_random_uuid(),
        'Sucursal Test Automática',
        'Dirección Test',
        '381-000-0000',
        true
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_sucursal_test_id;
    
    -- Si no se creó, obtener una existente
    IF v_sucursal_test_id IS NULL THEN
        SELECT id INTO v_sucursal_test_id
        FROM sucursales
        WHERE nombre LIKE '%Test%' OR nombre LIKE '%Alberdi%'
        LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Sucursal de prueba: %', v_sucursal_test_id;
    
    -- Crear producto de prueba si no existe
    INSERT INTO productos (id, codigo, nombre, precio_venta, stock_minimo, activo, unidad_medida)
    VALUES (
        gen_random_uuid(),
        'TEST-AUTO-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'Producto Test Automático',
        100.00,
        10, -- Stock mínimo: 10 unidades
        true,
        'kg'
    )
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_producto_test_id;
    
    -- Si no se creó, obtener uno existente
    IF v_producto_test_id IS NULL THEN
        SELECT id INTO v_producto_test_id
        FROM productos
        WHERE activo = true
        LIMIT 1;
        
        -- Actualizar stock mínimo para la prueba
        UPDATE productos
        SET stock_minimo = 10
        WHERE id = v_producto_test_id;
    END IF;
    
    RAISE NOTICE 'Producto de prueba: %', v_producto_test_id;
    
    -- ===========================================
    -- PRUEBA 1: Crear stock bajo en sucursal destino
    -- ===========================================
    
    RAISE NOTICE '=== PRUEBA 1: Crear stock bajo ===';
    
    -- Crear lote en sucursal destino con stock bajo (5 unidades, menos del mínimo de 10)
    INSERT INTO lotes (
        producto_id,
        sucursal_id,
        cantidad_inicial,
        cantidad_disponible,
        precio_compra,
        fecha_ingreso,
        estado,
        numero_lote
    ) VALUES (
        v_producto_test_id,
        v_sucursal_test_id,
        5,
        5, -- Stock bajo (menos del mínimo de 10)
        50.00,
        NOW(),
        'disponible',
        'TEST-LOTE-DESTINO-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MI')
    ) RETURNING id INTO v_lote_destino_id;
    
    RAISE NOTICE 'Lote destino creado: %', v_lote_destino_id;
    RAISE NOTICE 'Stock actual: 5, Stock mínimo: 10';
    
    -- El trigger debería crear automáticamente una solicitud
    -- Esperar un momento para que el trigger se ejecute
    PERFORM pg_sleep(1);
    
    -- Verificar si se creó la solicitud automática
    SELECT id INTO v_transferencia_id
    FROM transferencias_stock
    WHERE sucursal_destino_id = v_sucursal_test_id
      AND estado = 'solicitud_automatica'
      AND origen = 'automatica'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_transferencia_id IS NOT NULL THEN
        RAISE NOTICE '✅ PRUEBA 1 EXITOSA: Solicitud automática creada: %', v_transferencia_id;
    ELSE
        RAISE NOTICE '❌ PRUEBA 1 FALLIDA: No se creó solicitud automática';
    END IF;
    
    -- ===========================================
    -- PRUEBA 2: Verificar que hay stock en origen
    -- ===========================================
    
    RAISE NOTICE '=== PRUEBA 2: Verificar stock en origen ===';
    
    -- Crear lote en Casa Central con stock suficiente
    INSERT INTO lotes (
        producto_id,
        sucursal_id,
        cantidad_inicial,
        cantidad_disponible,
        precio_compra,
        fecha_ingreso,
        estado,
        numero_lote
    ) VALUES (
        v_producto_test_id,
        v_sucursal_central_id,
        100,
        100, -- Stock suficiente
        50.00,
        NOW(),
        'disponible',
        'TEST-LOTE-ORIGEN-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MI')
    ) RETURNING id INTO v_lote_origen_id;
    
    RAISE NOTICE 'Lote origen creado: %', v_lote_origen_id;
    RAISE NOTICE 'Stock en Casa Central: 100 unidades';
    
    -- ===========================================
    -- PRUEBA 3: Aprobar solicitud automática
    -- ===========================================
    
    RAISE NOTICE '=== PRUEBA 3: Aprobar solicitud automática ===';
    
    IF v_transferencia_id IS NOT NULL THEN
        -- Aprobar la solicitud (cambiar estado a pendiente)
        UPDATE transferencias_stock
        SET estado = 'pendiente',
            aprobado_por = (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
            fecha_aprobacion = NOW()
        WHERE id = v_transferencia_id;
        
        RAISE NOTICE '✅ Solicitud aprobada: %', v_transferencia_id;
        
        -- Aprobar y enviar transferencia
        PERFORM fn_aprobar_transferencia(
            v_transferencia_id,
            (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1)
        );
        
        RAISE NOTICE '✅ Transferencia aprobada y enviada';
    ELSE
        RAISE NOTICE '⚠️ No hay solicitud para aprobar';
    END IF;
    
    -- ===========================================
    -- PRUEBA 4: Verificar que se creó pedido automáticamente
    -- ===========================================
    
    RAISE NOTICE '=== PRUEBA 4: Verificar creación de pedido ===';
    
    IF v_transferencia_id IS NOT NULL THEN
        SELECT id INTO v_pedido_id
        FROM pedidos
        WHERE transferencia_id = v_transferencia_id;
        
        IF v_pedido_id IS NOT NULL THEN
            RAISE NOTICE '✅ PRUEBA 4 EXITOSA: Pedido creado automáticamente: %', v_pedido_id;
            
            -- Verificar detalles del pedido
            RAISE NOTICE 'Detalles del pedido:';
            FOR v_detalle IN
                SELECT dp.*, p.nombre as producto_nombre
                FROM detalles_pedido dp
                INNER JOIN productos p ON p.id = dp.producto_id
                WHERE dp.pedido_id = v_pedido_id
            LOOP
                RAISE NOTICE '  - %: % unidades', v_detalle.producto_nombre, v_detalle.cantidad;
            END LOOP;
        ELSE
            RAISE NOTICE '❌ PRUEBA 4 FALLIDA: No se creó pedido automáticamente';
        END IF;
    END IF;
    
    -- ===========================================
    -- PRUEBA 5: Verificar sincronización de cajas
    -- ===========================================
    
    RAISE NOTICE '=== PRUEBA 5: Verificar sincronización de cajas ===';
    
    -- Ejecutar función de corrección
    PERFORM fn_corregir_sincronizacion_cajas();
    
    RAISE NOTICE '✅ Función de corrección ejecutada';
    
    -- Verificar resultados
    FOR v_resultado IN
        SELECT 
            tc.id,
            tc.nombre,
            tc.saldo_actual,
            COALESCE(
                tc.saldo_inicial + 
                SUM(CASE 
                    WHEN tm.tipo = 'ingreso' THEN tm.monto 
                    WHEN tm.tipo = 'egreso' THEN -tm.monto 
                    ELSE 0 
                END),
                tc.saldo_inicial
            ) as saldo_calculado
        FROM tesoreria_cajas tc
        LEFT JOIN tesoreria_movimientos tm ON tm.caja_id = tc.id
        GROUP BY tc.id, tc.nombre, tc.saldo_inicial, tc.saldo_actual
        HAVING ABS(tc.saldo_actual - COALESCE(
            tc.saldo_inicial + 
            SUM(CASE 
                WHEN tm.tipo = 'ingreso' THEN tm.monto 
                WHEN tm.tipo = 'egreso' THEN -tm.monto 
                ELSE 0 
            END),
            tc.saldo_inicial
        )) >= 0.01
        LIMIT 5
    LOOP
        RAISE NOTICE '⚠️ Caja desincronizada: % (Saldo: %, Calculado: %)', 
            v_resultado.nombre, 
            v_resultado.saldo_actual, 
            v_resultado.saldo_calculado;
    END LOOP;
    
    RAISE NOTICE '✅ PRUEBA 5 COMPLETADA';
    
    -- ===========================================
    -- RESUMEN
    -- ===========================================
    
    RAISE NOTICE '=== RESUMEN DE PRUEBAS ===';
    RAISE NOTICE 'Sucursal de prueba: %', v_sucursal_test_id;
    RAISE NOTICE 'Producto de prueba: %', v_producto_test_id;
    RAISE NOTICE 'Transferencia creada: %', COALESCE(v_transferencia_id::TEXT, 'Ninguna');
    RAISE NOTICE 'Pedido creado: %', COALESCE(v_pedido_id::TEXT, 'Ninguno');
    
END $$;

-- ===========================================
-- CONSULTAS DE VERIFICACIÓN
-- ===========================================

-- Ver solicitudes automáticas pendientes
SELECT 
    ts.id,
    ts.numero_transferencia,
    so.nombre as sucursal_origen,
    sd.nombre as sucursal_destino,
    ts.estado,
    ts.origen,
    ts.fecha_solicitud,
    COUNT(ti.id) as total_items
FROM transferencias_stock ts
INNER JOIN sucursales so ON so.id = ts.sucursal_origen_id
INNER JOIN sucursales sd ON sd.id = ts.sucursal_destino_id
LEFT JOIN transferencia_items ti ON ti.transferencia_id = ts.id
WHERE ts.estado = 'solicitud_automatica'
  AND ts.origen = 'automatica'
GROUP BY ts.id, ts.numero_transferencia, so.nombre, sd.nombre, ts.estado, ts.origen, ts.fecha_solicitud
ORDER BY ts.fecha_solicitud DESC;

-- Ver pedidos generados desde transferencias
SELECT 
    p.id,
    p.numero_pedido,
    p.tipo_pedido,
    p.origen,
    p.estado,
    ts.numero_transferencia,
    s.nombre as sucursal_destino
FROM pedidos p
INNER JOIN transferencias_stock ts ON ts.id = p.transferencia_id
INNER JOIN sucursales s ON s.id = p.sucursal_id
WHERE p.transferencia_id IS NOT NULL
ORDER BY p.created_at DESC
LIMIT 10;

-- Verificar sincronización de cajas
SELECT 
    tc.nombre,
    tc.sucursal_id,
    s.nombre as sucursal_nombre,
    tc.saldo_actual,
    COALESCE(
        tc.saldo_inicial + 
        SUM(CASE 
            WHEN tm.tipo = 'ingreso' THEN tm.monto 
            WHEN tm.tipo = 'egreso' THEN -tm.monto 
            ELSE 0 
        END),
        tc.saldo_inicial
    ) as saldo_calculado,
    CASE 
        WHEN ABS(tc.saldo_actual - COALESCE(
            tc.saldo_inicial + 
            SUM(CASE 
                WHEN tm.tipo = 'ingreso' THEN tm.monto 
                WHEN tm.tipo = 'egreso' THEN -tm.monto 
                ELSE 0 
            END),
            tc.saldo_inicial
        )) < 0.01 THEN '✅ Sincronizado'
        ELSE '❌ Desincronizado'
    END as estado
FROM tesoreria_cajas tc
LEFT JOIN tesoreria_movimientos tm ON tm.caja_id = tc.id
LEFT JOIN sucursales s ON s.id = tc.sucursal_id
GROUP BY tc.id, tc.nombre, tc.sucursal_id, s.nombre, tc.saldo_inicial, tc.saldo_actual
ORDER BY estado DESC, tc.nombre;

