-- ===========================================
-- MIGRACIÓN: Datos Mock para Sucursales Colón y Simoca
-- Fecha: 2025-12-02
-- Descripción: Crea datos de demostración realistas para mostrar
--              el funcionamiento del sistema de control de sucursales.
-- ===========================================

BEGIN;

-- ===========================================
-- 1. VERIFICAR/CREAR SUCURSALES
-- ===========================================

-- Verificar que existan las sucursales Colón y Simoca (usando INSERT si no existe)
INSERT INTO sucursales (nombre, direccion, telefono, active)
SELECT 'Sucursal Colón', 'Av. Colón 3456, San Miguel de Tucumán', '381-678-9012', true
WHERE NOT EXISTS (SELECT 1 FROM sucursales WHERE nombre = 'Sucursal Colón');

INSERT INTO sucursales (nombre, direccion, telefono, active)
SELECT 'Sucursal Simoca', 'Ruta Nacional 9 Km 45, Simoca, Tucumán', '381-789-0123', true
WHERE NOT EXISTS (SELECT 1 FROM sucursales WHERE nombre = 'Sucursal Simoca');

-- ===========================================
-- 2. CREAR CONFIGURACIÓN DE SUCURSALES
-- ===========================================

-- Configuración para Colón
INSERT INTO sucursal_settings (sucursal_id, low_stock_threshold_default)
SELECT id, 10
FROM sucursales WHERE nombre = 'Sucursal Colón'
ON CONFLICT (sucursal_id) DO NOTHING;

-- Configuración para Simoca
INSERT INTO sucursal_settings (sucursal_id, low_stock_threshold_default)
SELECT id, 8
FROM sucursales WHERE nombre = 'Sucursal Simoca'
ON CONFLICT (sucursal_id) DO NOTHING;

-- ===========================================
-- 3. CREAR CAJAS PARA LAS SUCURSALES
-- ===========================================

-- Caja para Sucursal Colón (solo si no existe)
INSERT INTO tesoreria_cajas (nombre, sucursal_id, saldo_actual, saldo_inicial)
SELECT 'Caja Sucursal Colón', s.id, 125000.00, 50000.00
FROM sucursales s
WHERE s.nombre = 'Sucursal Colón'
AND NOT EXISTS (
    SELECT 1 FROM tesoreria_cajas tc WHERE tc.sucursal_id = s.id
);

-- Caja para Sucursal Simoca (solo si no existe)
INSERT INTO tesoreria_cajas (nombre, sucursal_id, saldo_actual, saldo_inicial)
SELECT 'Caja Sucursal Simoca', s.id, 87500.00, 30000.00
FROM sucursales s
WHERE s.nombre = 'Sucursal Simoca'
AND NOT EXISTS (
    SELECT 1 FROM tesoreria_cajas tc WHERE tc.sucursal_id = s.id
);

-- ===========================================
-- 4. CREAR INVENTARIO (LOTES) PARA COLÓN
-- ===========================================

-- Lotes para Sucursal Colón (stock variado)
INSERT INTO lotes (numero_lote, producto_id, sucursal_id, cantidad_ingresada, cantidad_disponible, 
                   precio_costo_unitario, precio_venta_sugerido, estado, fecha_vencimiento, observaciones)
SELECT 
    'COLON-' || p.codigo || '-001',
    p.id,
    s.id,
    CASE 
        WHEN p.codigo = 'POLLO001' THEN 150
        WHEN p.codigo = 'POLLO002' THEN 80
        WHEN p.codigo = 'POLLO003' THEN 60
        WHEN p.codigo = 'HUEVO001' THEN 200
        WHEN p.codigo = 'HUEVO002' THEN 120
        ELSE 100
    END,
    CASE 
        WHEN p.codigo = 'POLLO001' THEN 125  -- Vendió 25
        WHEN p.codigo = 'POLLO002' THEN 62   -- Vendió 18
        WHEN p.codigo = 'POLLO003' THEN 45   -- Vendió 15
        WHEN p.codigo = 'HUEVO001' THEN 168  -- Vendió 32
        WHEN p.codigo = 'HUEVO002' THEN 95   -- Vendió 25
        ELSE 80
    END,
    p.precio_costo,
    p.precio_venta,
    'disponible',
    CURRENT_DATE + INTERVAL '30 days',
    'Stock inicial Sucursal Colón'
FROM productos p
CROSS JOIN sucursales s
WHERE s.nombre = 'Sucursal Colón'
AND p.activo = true
ON CONFLICT (numero_lote) DO UPDATE SET 
    cantidad_disponible = EXCLUDED.cantidad_disponible,
    updated_at = NOW();

-- ===========================================
-- 5. CREAR INVENTARIO (LOTES) PARA SIMOCA
-- ===========================================

-- Lotes para Sucursal Simoca (stock diferente)
INSERT INTO lotes (numero_lote, producto_id, sucursal_id, cantidad_ingresada, cantidad_disponible, 
                   precio_costo_unitario, precio_venta_sugerido, estado, fecha_vencimiento, observaciones)
SELECT 
    'SIMOCA-' || p.codigo || '-001',
    p.id,
    s.id,
    CASE 
        WHEN p.codigo = 'POLLO001' THEN 100
        WHEN p.codigo = 'POLLO002' THEN 50
        WHEN p.codigo = 'POLLO003' THEN 40
        WHEN p.codigo = 'HUEVO001' THEN 150
        WHEN p.codigo = 'HUEVO002' THEN 80
        ELSE 70
    END,
    CASE 
        WHEN p.codigo = 'POLLO001' THEN 78   -- Vendió 22
        WHEN p.codigo = 'POLLO002' THEN 35   -- Vendió 15
        WHEN p.codigo = 'POLLO003' THEN 28   -- Vendió 12
        WHEN p.codigo = 'HUEVO001' THEN 118  -- Vendió 32
        WHEN p.codigo = 'HUEVO002' THEN 58   -- Vendió 22
        ELSE 55
    END,
    p.precio_costo,
    p.precio_venta,
    'disponible',
    CURRENT_DATE + INTERVAL '25 days',
    'Stock inicial Sucursal Simoca'
FROM productos p
CROSS JOIN sucursales s
WHERE s.nombre = 'Sucursal Simoca'
AND p.activo = true
ON CONFLICT (numero_lote) DO UPDATE SET 
    cantidad_disponible = EXCLUDED.cantidad_disponible,
    updated_at = NOW();

-- ===========================================
-- 6. CREAR LISTAS DE PRECIOS SI NO EXISTEN
-- ===========================================

INSERT INTO listas_precios (codigo, nombre, tipo, activa, margen_ganancia)
VALUES 
    ('MINORISTA', 'Lista Minorista', 'minorista', true, 30.00),
    ('MAYORISTA', 'Lista Mayorista', 'mayorista', true, 15.00),
    ('DISTRIBUIDOR', 'Lista Distribuidor', 'distribuidor', true, 10.00)
ON CONFLICT (codigo) DO NOTHING;

-- ===========================================
-- 7. CREAR CLIENTES DE EJEMPLO PARA LAS SUCURSALES
-- ===========================================

-- Clientes para zona Colón
INSERT INTO clientes (codigo, nombre, apellido, telefono, direccion, zona_entrega, tipo_cliente, activo)
VALUES 
    ('CLI-COL-001', 'Almacén Don Pedro', '', '381-555-1001', 'Av. Colón 1234', 'Colón', 'minorista', true),
    ('CLI-COL-002', 'Carnicería El Gaucho', '', '381-555-1002', 'Calle San Juan 567', 'Colón', 'minorista', true),
    ('CLI-COL-003', 'Distribuidora Norte', '', '381-555-1003', 'Av. Alem 890', 'Colón', 'mayorista', true),
    ('CLI-COL-004', 'Restaurante La Esquina', '', '381-555-1004', 'Esquina Colón y San Martín', 'Colón', 'mayorista', true)
ON CONFLICT (codigo) DO NOTHING;

-- Clientes para zona Simoca
INSERT INTO clientes (codigo, nombre, apellido, telefono, direccion, zona_entrega, tipo_cliente, activo)
VALUES 
    ('CLI-SIM-001', 'Despensa María', '', '381-555-2001', 'Ruta 9 Km 44', 'Simoca', 'minorista', true),
    ('CLI-SIM-002', 'Granja Los Pinos', '', '381-555-2002', 'Camino Rural 12', 'Simoca', 'mayorista', true),
    ('CLI-SIM-003', 'Pollería Central Simoca', '', '381-555-2003', 'Plaza Principal S/N', 'Simoca', 'minorista', true),
    ('CLI-SIM-004', 'Cooperativa Agrícola', '', '381-555-2004', 'Ruta 9 Km 48', 'Simoca', 'distribuidor', true)
ON CONFLICT (codigo) DO NOTHING;

-- ===========================================
-- 8. CREAR PEDIDOS (VENTAS) PARA COLÓN - Últimos 7 días
-- ===========================================

-- Venta 1 Colón: Venta minorista
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'efectivo',
    4250.00,  -- Total
    4250.00,  -- Subtotal
    3400.00,  -- Costo
    850.00,   -- Margen
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE - INTERVAL '1 day'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Colón' AND c.codigo = 'CLI-COL-001';

-- Venta 2 Colón: Venta mayorista
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'transferencia',
    15600.00,  -- Total
    15600.00,  -- Subtotal
    13500.00,  -- Costo
    2100.00,   -- Margen
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE - INTERVAL '2 days'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Colón' AND c.codigo = 'CLI-COL-003';

-- Venta 3 Colón: Venta minorista
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'efectivo',
    2850.00,
    2850.00,
    2280.00,
    570.00,
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE - INTERVAL '3 days'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Colón' AND c.codigo = 'CLI-COL-002';

-- Venta 4 Colón: Venta mayorista grande
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'transferencia',
    28500.00,
    28500.00,
    24500.00,
    4000.00,
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE - INTERVAL '5 days'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Colón' AND c.codigo = 'CLI-COL-004';

-- ===========================================
-- 9. CREAR PEDIDOS (VENTAS) PARA SIMOCA - Últimos 7 días
-- ===========================================

-- Venta 1 Simoca: Venta minorista
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'efectivo',
    3200.00,
    3200.00,
    2560.00,
    640.00,
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE - INTERVAL '1 day'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Simoca' AND c.codigo = 'CLI-SIM-001';

-- Venta 2 Simoca: Venta mayorista
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'transferencia',
    12800.00,
    12800.00,
    11200.00,
    1600.00,
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE - INTERVAL '2 days'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Simoca' AND c.codigo = 'CLI-SIM-002';

-- Venta 3 Simoca: Venta minorista
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'efectivo',
    1850.00,
    1850.00,
    1480.00,
    370.00,
    CURRENT_DATE - INTERVAL '4 days',
    CURRENT_DATE - INTERVAL '4 days'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Simoca' AND c.codigo = 'CLI-SIM-003';

-- Venta 4 Simoca: Venta distribuidor
INSERT INTO pedidos (
    sucursal_id, cliente_id, estado, metodo_pago, total, subtotal, 
    costo_total, margen_bruto_total, fecha_entrega, created_at
)
SELECT 
    s.id,
    c.id,
    'completado',
    'transferencia',
    35000.00,
    35000.00,
    31500.00,
    3500.00,
    CURRENT_DATE - INTERVAL '6 days',
    CURRENT_DATE - INTERVAL '6 days'
FROM sucursales s, clientes c
WHERE s.nombre = 'Sucursal Simoca' AND c.codigo = 'CLI-SIM-004';

-- ===========================================
-- 10. CREAR ALERTAS DE STOCK
-- ===========================================

-- Alerta para Colón: Alas de pollo bajo stock (solo si no existe una pendiente)
INSERT INTO alertas_stock (sucursal_id, producto_id, cantidad_actual, umbral, estado)
SELECT 
    s.id,
    p.id,
    45,
    50,
    'pendiente'
FROM sucursales s, productos p
WHERE s.nombre = 'Sucursal Colón' AND p.codigo = 'POLLO003'
AND NOT EXISTS (
    SELECT 1 FROM alertas_stock a 
    WHERE a.sucursal_id = s.id AND a.producto_id = p.id AND a.estado = 'pendiente'
);

-- Alerta para Simoca: Pechuga bajo stock (solo si no existe una pendiente)
INSERT INTO alertas_stock (sucursal_id, producto_id, cantidad_actual, umbral, estado)
SELECT 
    s.id,
    p.id,
    35,
    40,
    'pendiente'
FROM sucursales s, productos p
WHERE s.nombre = 'Sucursal Simoca' AND p.codigo = 'POLLO002'
AND NOT EXISTS (
    SELECT 1 FROM alertas_stock a 
    WHERE a.sucursal_id = s.id AND a.producto_id = p.id AND a.estado = 'pendiente'
);

-- Alerta resuelta para Colón (histórico) - solo si no existe
INSERT INTO alertas_stock (sucursal_id, producto_id, cantidad_actual, umbral, estado, created_at, updated_at)
SELECT 
    s.id,
    p.id,
    8,
    10,
    'resuelto',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE - INTERVAL '3 days'
FROM sucursales s, productos p
WHERE s.nombre = 'Sucursal Colón' AND p.codigo = 'HUEVO002'
AND NOT EXISTS (
    SELECT 1 FROM alertas_stock a 
    WHERE a.sucursal_id = s.id AND a.producto_id = p.id AND a.estado = 'resuelto'
);

-- ===========================================
-- 11. CREAR TRANSFERENCIAS ENTRE SUCURSALES
-- ===========================================

-- Transferencia pendiente: Casa Central -> Colón
INSERT INTO transferencias_stock (
    sucursal_origen_id, sucursal_destino_id, estado, 
    solicitado_por, observaciones, created_at
)
SELECT 
    origen.id,
    destino.id,
    'pendiente',
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    'Reposición semanal de stock',
    CURRENT_DATE - INTERVAL '1 day'
FROM sucursales origen, sucursales destino
WHERE origen.nombre = 'Casa Central' AND destino.nombre = 'Sucursal Colón';

-- Transferencia en tránsito: Casa Central -> Simoca
INSERT INTO transferencias_stock (
    sucursal_origen_id, sucursal_destino_id, estado, 
    solicitado_por, aprobado_por, fecha_aprobacion, observaciones, created_at
)
SELECT 
    origen.id,
    destino.id,
    'en_transito',
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    CURRENT_DATE,
    'Envío urgente por demanda alta',
    CURRENT_DATE - INTERVAL '2 days'
FROM sucursales origen, sucursales destino
WHERE origen.nombre = 'Casa Central' AND destino.nombre = 'Sucursal Simoca';

-- Transferencia completada: Casa Central -> Colón (histórica)
INSERT INTO transferencias_stock (
    sucursal_origen_id, sucursal_destino_id, estado, 
    solicitado_por, aprobado_por, fecha_aprobacion,
    recibido_por, fecha_recepcion, observaciones, created_at
)
SELECT 
    origen.id,
    destino.id,
    'completada',
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    CURRENT_DATE - INTERVAL '8 days',
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    CURRENT_DATE - INTERVAL '7 days',
    'Transferencia mensual completada',
    CURRENT_DATE - INTERVAL '10 days'
FROM sucursales origen, sucursales destino
WHERE origen.nombre = 'Casa Central' AND destino.nombre = 'Sucursal Colón';

-- ===========================================
-- 12. CREAR CONTEOS DE STOCK
-- ===========================================

-- Conteo completado para Colón (hace 5 días)
INSERT INTO conteos_stock (
    sucursal_id, fecha_conteo, estado, realizado_por,
    total_diferencias, total_merma_valor, observaciones, created_at
)
SELECT 
    s.id,
    CURRENT_DATE - INTERVAL '5 days',
    'aprobado',
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    3,
    1250.00,
    'Conteo mensual - Diferencias menores dentro de tolerancia',
    CURRENT_DATE - INTERVAL '5 days'
FROM sucursales s
WHERE s.nombre = 'Sucursal Colón';

-- Conteo en proceso para Simoca (hoy)
INSERT INTO conteos_stock (
    sucursal_id, fecha_conteo, estado, realizado_por,
    total_diferencias, total_merma_valor, observaciones, created_at
)
SELECT 
    s.id,
    CURRENT_DATE,
    'en_proceso',
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    0,
    0,
    'Conteo semanal en progreso',
    CURRENT_DATE
FROM sucursales s
WHERE s.nombre = 'Sucursal Simoca';

-- ===========================================
-- 13. CREAR MOVIMIENTOS DE CAJA
-- ===========================================

-- Movimientos para Caja Colón
INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, concepto, metodo_pago, created_at
)
SELECT 
    c.id,
    'ingreso',
    4250.00,
    'Venta del día - Almacén Don Pedro',
    'efectivo',
    CURRENT_DATE - INTERVAL '1 day'
FROM tesoreria_cajas c
WHERE c.nombre = 'Caja Sucursal Colón';

INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, concepto, metodo_pago, created_at
)
SELECT 
    c.id,
    'ingreso',
    2850.00,
    'Venta del día - Carnicería El Gaucho',
    'efectivo',
    CURRENT_DATE - INTERVAL '3 days'
FROM tesoreria_cajas c
WHERE c.nombre = 'Caja Sucursal Colón';

INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, concepto, metodo_pago, created_at
)
SELECT 
    c.id,
    'egreso',
    1500.00,
    'Gastos operativos - Limpieza',
    'efectivo',
    CURRENT_DATE - INTERVAL '2 days'
FROM tesoreria_cajas c
WHERE c.nombre = 'Caja Sucursal Colón';

-- Movimientos para Caja Simoca
INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, concepto, metodo_pago, created_at
)
SELECT 
    c.id,
    'ingreso',
    3200.00,
    'Venta del día - Despensa María',
    'efectivo',
    CURRENT_DATE - INTERVAL '1 day'
FROM tesoreria_cajas c
WHERE c.nombre = 'Caja Sucursal Simoca';

INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, concepto, metodo_pago, created_at
)
SELECT 
    c.id,
    'ingreso',
    1850.00,
    'Venta del día - Pollería Central',
    'efectivo',
    CURRENT_DATE - INTERVAL '4 days'
FROM tesoreria_cajas c
WHERE c.nombre = 'Caja Sucursal Simoca';

INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, concepto, metodo_pago, created_at
)
SELECT 
    c.id,
    'egreso',
    800.00,
    'Gastos operativos - Combustible',
    'efectivo',
    CURRENT_DATE - INTERVAL '3 days'
FROM tesoreria_cajas c
WHERE c.nombre = 'Caja Sucursal Simoca';

-- ===========================================
-- 14. CREAR AUDITORÍA DE LISTAS DE PRECIOS
-- ===========================================

-- Auditoría para ventas de Colón
INSERT INTO auditoria_listas_precios (
    sucursal_id, usuario_id, cliente_id, lista_precio_id, tipo_lista,
    cantidad_total, monto_total, fecha_venta
)
SELECT 
    s.id,
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    c.id,
    lp.id,
    'minorista',
    5.0,
    4250.00,
    CURRENT_DATE - INTERVAL '1 day'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal Colón' 
AND c.codigo = 'CLI-COL-001'
AND lp.codigo = 'MINORISTA';

INSERT INTO auditoria_listas_precios (
    sucursal_id, usuario_id, cliente_id, lista_precio_id, tipo_lista,
    cantidad_total, monto_total, fecha_venta
)
SELECT 
    s.id,
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    c.id,
    lp.id,
    'mayorista',
    20.0,
    15600.00,
    CURRENT_DATE - INTERVAL '2 days'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal Colón' 
AND c.codigo = 'CLI-COL-003'
AND lp.codigo = 'MAYORISTA';

-- Auditoría para ventas de Simoca
INSERT INTO auditoria_listas_precios (
    sucursal_id, usuario_id, cliente_id, lista_precio_id, tipo_lista,
    cantidad_total, monto_total, fecha_venta
)
SELECT 
    s.id,
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    c.id,
    lp.id,
    'minorista',
    4.0,
    3200.00,
    CURRENT_DATE - INTERVAL '1 day'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal Simoca' 
AND c.codigo = 'CLI-SIM-001'
AND lp.codigo = 'MINORISTA';

INSERT INTO auditoria_listas_precios (
    sucursal_id, usuario_id, cliente_id, lista_precio_id, tipo_lista,
    cantidad_total, monto_total, fecha_venta
)
SELECT 
    s.id,
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    c.id,
    lp.id,
    'distribuidor',
    50.0,
    35000.00,
    CURRENT_DATE - INTERVAL '6 days'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal Simoca' 
AND c.codigo = 'CLI-SIM-004'
AND lp.codigo = 'DISTRIBUIDOR';

COMMIT;

-- ===========================================
-- RESUMEN DE DATOS CREADOS
-- ===========================================
-- 
-- Sucursal Colón:
-- - 5 lotes de productos con stock variado
-- - 4 ventas completadas (2 minoristas, 2 mayoristas)
-- - 2 alertas de stock (1 pendiente, 1 resuelta)
-- - 2 transferencias (1 pendiente, 1 completada)
-- - 1 conteo de stock aprobado
-- - 3 movimientos de caja
-- - Saldo caja: $125,000
--
-- Sucursal Simoca:
-- - 5 lotes de productos con stock variado
-- - 4 ventas completadas (2 minoristas, 1 mayorista, 1 distribuidor)
-- - 1 alerta de stock pendiente
-- - 1 transferencia en tránsito
-- - 1 conteo de stock en proceso
-- - 3 movimientos de caja
-- - Saldo caja: $87,500
--
-- Datos adicionales:
-- - 8 clientes de ejemplo (4 por zona)
-- - 3 listas de precios (minorista, mayorista, distribuidor)
-- - Auditoría de uso de listas de precios
-- ===========================================

