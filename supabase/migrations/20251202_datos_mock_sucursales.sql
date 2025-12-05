-- ===========================================
-- MIGRACIÓN: Datos Mock para Sucursales Colón y Simoca
-- Fecha: 2025-12-02
-- Descripción: Crea datos de demostración realistas para mostrar
--              el funcionamiento del sistema de control de sucursales.
-- ===========================================

BEGIN;

-- ===========================================
-- 1. VERIFICAR SUCURSALES EXISTENTES
-- ===========================================

-- Las sucursales ya existen desde migraciones anteriores:
-- - Sucursal Alberdi
-- - Sucursal San Martín
-- - Sucursal Colón
-- - Sucursal Simoca
-- Usaremos estas para agregar datos mock

-- ===========================================
-- 2. CREAR CONFIGURACIÓN DE SUCURSALES
-- ===========================================

-- Configuración para todas las sucursales existentes
INSERT INTO sucursal_settings (sucursal_id, low_stock_threshold_default)
SELECT s.id, 5
FROM sucursales s
WHERE s.nombre IN ('Sucursal Alberdi', 'Sucursal San Martín', 'Sucursal Colón', 'Sucursal Simoca')
AND NOT EXISTS (
    SELECT 1 FROM sucursal_settings ss WHERE ss.sucursal_id = s.id
);

-- ===========================================
-- 3. CREAR CAJAS PARA LAS SUCURSALES EXISTENTES
-- ===========================================

-- Cajas para todas las sucursales existentes (solo si no existen)
INSERT INTO tesoreria_cajas (nombre, sucursal_id, saldo_actual, saldo_inicial)
SELECT
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 'Caja Sucursal Alberdi'
        WHEN s.nombre = 'Sucursal San Martín' THEN 'Caja Sucursal San Martín'
        WHEN s.nombre = 'Sucursal Colón' THEN 'Caja Sucursal Colón'
        WHEN s.nombre = 'Sucursal Simoca' THEN 'Caja Sucursal Simoca'
    END,
    s.id,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 100000.00
        WHEN s.nombre = 'Sucursal San Martín' THEN 115000.00
        WHEN s.nombre = 'Sucursal Colón' THEN 125000.00
        WHEN s.nombre = 'Sucursal Simoca' THEN 87500.00
    END,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 40000.00
        WHEN s.nombre = 'Sucursal San Martín' THEN 45000.00
        WHEN s.nombre = 'Sucursal Colón' THEN 50000.00
        WHEN s.nombre = 'Sucursal Simoca' THEN 30000.00
    END
FROM sucursales s
WHERE s.nombre IN ('Sucursal Alberdi', 'Sucursal San Martín', 'Sucursal Colón', 'Sucursal Simoca')
AND NOT EXISTS (
    SELECT 1 FROM tesoreria_cajas tc WHERE tc.sucursal_id = s.id
);

-- ===========================================
-- 4. CREAR INVENTARIO (LOTES) PARA TODAS LAS SUCURSALES EXISTENTES
-- ===========================================

-- Lotes para todas las sucursales (stock variado por sucursal)
INSERT INTO lotes (numero_lote, producto_id, sucursal_id, cantidad_ingresada, cantidad_disponible,
                   costo_unitario, estado, fecha_ingreso, fecha_vencimiento)
SELECT
    UPPER(LEFT(REPLACE(s.nombre, 'Sucursal ', ''), 4)) || '-' || p.codigo || '-001',
    p.id,
    s.id,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 120
                WHEN p.codigo = 'POLLO002' THEN 60
                WHEN p.codigo = 'POLLO003' THEN 45
                WHEN p.codigo = 'HUEVO001' THEN 180
                WHEN p.codigo = 'HUEVO002' THEN 100
                ELSE 85
            END
        WHEN s.nombre = 'Sucursal San Martín' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 110
                WHEN p.codigo = 'POLLO002' THEN 55
                WHEN p.codigo = 'POLLO003' THEN 42
                WHEN p.codigo = 'HUEVO001' THEN 165
                WHEN p.codigo = 'HUEVO002' THEN 90
                ELSE 78
            END
        WHEN s.nombre = 'Sucursal Colón' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 150
                WHEN p.codigo = 'POLLO002' THEN 80
                WHEN p.codigo = 'POLLO003' THEN 60
                WHEN p.codigo = 'HUEVO001' THEN 200
                WHEN p.codigo = 'HUEVO002' THEN 120
                ELSE 100
            END
        WHEN s.nombre = 'Sucursal Simoca' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 100
                WHEN p.codigo = 'POLLO002' THEN 50
                WHEN p.codigo = 'POLLO003' THEN 40
                WHEN p.codigo = 'HUEVO001' THEN 150
                WHEN p.codigo = 'HUEVO002' THEN 80
                ELSE 70
            END
    END,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 95   -- Vendió 25
                WHEN p.codigo = 'POLLO002' THEN 45   -- Vendió 15
                WHEN p.codigo = 'POLLO003' THEN 32   -- Vendió 13
                WHEN p.codigo = 'HUEVO001' THEN 145  -- Vendió 35
                WHEN p.codigo = 'HUEVO002' THEN 75   -- Vendió 25
                ELSE 68
            END
        WHEN s.nombre = 'Sucursal San Martín' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 88   -- Vendió 22
                WHEN p.codigo = 'POLLO002' THEN 42   -- Vendió 13
                WHEN p.codigo = 'POLLO003' THEN 31   -- Vendió 11
                WHEN p.codigo = 'HUEVO001' THEN 132  -- Vendió 33
                WHEN p.codigo = 'HUEVO002' THEN 68   -- Vendió 22
                ELSE 62
            END
        WHEN s.nombre = 'Sucursal Colón' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 125  -- Vendió 25
                WHEN p.codigo = 'POLLO002' THEN 62   -- Vendió 18
                WHEN p.codigo = 'POLLO003' THEN 45   -- Vendió 15
                WHEN p.codigo = 'HUEVO001' THEN 168  -- Vendió 32
                WHEN p.codigo = 'HUEVO002' THEN 95   -- Vendió 25
                ELSE 80
            END
        WHEN s.nombre = 'Sucursal Simoca' THEN
            CASE
                WHEN p.codigo = 'POLLO001' THEN 78   -- Vendió 22
                WHEN p.codigo = 'POLLO002' THEN 35   -- Vendió 15
                WHEN p.codigo = 'POLLO003' THEN 28   -- Vendió 12
                WHEN p.codigo = 'HUEVO001' THEN 118  -- Vendió 32
                WHEN p.codigo = 'HUEVO002' THEN 58   -- Vendió 22
                ELSE 55
            END
    END,
    p.precio_costo,
    'disponible',
    CURRENT_DATE - INTERVAL '10 days',
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN CURRENT_DATE + INTERVAL '32 days'
        WHEN s.nombre = 'Sucursal San Martín' THEN CURRENT_DATE + INTERVAL '28 days'
        WHEN s.nombre = 'Sucursal Colón' THEN CURRENT_DATE + INTERVAL '30 days'
        WHEN s.nombre = 'Sucursal Simoca' THEN CURRENT_DATE + INTERVAL '25 days'
    END
FROM productos p
CROSS JOIN sucursales s
WHERE s.nombre IN ('Sucursal Alberdi', 'Sucursal San Martín', 'Sucursal Colón', 'Sucursal Simoca')
AND p.activo = true
AND NOT EXISTS (
    SELECT 1 FROM lotes l2 WHERE l2.numero_lote = UPPER(LEFT(REPLACE(s.nombre, 'Sucursal ', ''), 4)) || '-' || p.codigo || '-001'
);

-- ===========================================
-- 6. CREAR LISTAS DE PRECIOS SI NO EXISTEN
-- ===========================================

-- Crear listas de precios si no existen
INSERT INTO listas_precios (codigo, nombre, tipo, activa, margen_ganancia)
SELECT v.* FROM (VALUES
    ('MINORISTA', 'Lista Minorista', 'minorista'::varchar(50), true, 30.00),
    ('MAYORISTA', 'Lista Mayorista', 'mayorista'::varchar(50), true, 15.00),
    ('DISTRIBUIDOR', 'Lista Distribuidor', 'distribuidor'::varchar(50), true, 10.00)
) AS v(codigo, nombre, tipo, activa, margen_ganancia)
WHERE NOT EXISTS (
    SELECT 1 FROM listas_precios lp WHERE lp.codigo = v.codigo
);

-- ===========================================
-- 5. CREAR CLIENTES DE EJEMPLO PARA LAS SUCURSALES
-- ===========================================

-- Clientes para todas las zonas de sucursales
INSERT INTO clientes (codigo, nombre, telefono, direccion, zona_entrega, tipo_cliente, activo)
SELECT * FROM (VALUES
    ('CLI-ALB-001', 'Almacén Centro', '381-555-1001', 'Av. Alberdi 1234', 'Alberdi', 'minorista'::varchar(50), true),
    ('CLI-ALB-002', 'Carnicería El Progreso', '381-555-1002', 'Calle San Juan 567', 'Alberdi', 'minorista'::varchar(50), true),
    ('CLI-ALB-003', 'Distribuidora Alberdi', '381-555-1003', 'Av. Alem 890', 'Alberdi', 'mayorista'::varchar(50), true),
    ('CLI-ALB-004', 'Restaurante El Patio', '381-555-1004', 'Esquina Alberdi y San Martín', 'Alberdi', 'mayorista'::varchar(50), true),
    ('CLI-SMA-001', 'Despensa Doña Ana', '381-555-1101', 'Av. San Martín 234', 'San Martín', 'minorista'::varchar(50), true),
    ('CLI-SMA-002', 'Carnicería San Martín', '381-555-1102', 'Calle Córdoba 345', 'San Martín', 'minorista'::varchar(50), true),
    ('CLI-SMA-003', 'Mayorista del Centro', '381-555-1103', 'Av. Belgrano 456', 'San Martín', 'mayorista'::varchar(50), true),
    ('CLI-SMA-004', 'Hotel Plaza', '381-555-1104', 'Plaza Principal 789', 'San Martín', 'mayorista'::varchar(50), true),
    ('CLI-COL-001', 'Almacén Don Pedro', '381-555-1201', 'Av. Colón 1234', 'Colón', 'minorista'::varchar(50), true),
    ('CLI-COL-002', 'Carnicería El Gaucho', '381-555-1202', 'Calle San Juan 567', 'Colón', 'minorista'::varchar(50), true),
    ('CLI-COL-003', 'Distribuidora Norte', '381-555-1203', 'Av. Alem 890', 'Colón', 'mayorista'::varchar(50), true),
    ('CLI-COL-004', 'Restaurante La Esquina', '381-555-1204', 'Esquina Colón y San Martín', 'Colón', 'mayorista'::varchar(50), true),
    ('CLI-SIM-001', 'Despensa María', '381-555-1301', 'Ruta 9 Km 44', 'Simoca', 'minorista'::varchar(50), true),
    ('CLI-SIM-002', 'Granja Los Pinos', '381-555-1302', 'Camino Rural 12', 'Simoca', 'mayorista'::varchar(50), true),
    ('CLI-SIM-003', 'Pollería Central Simoca', '381-555-1303', 'Plaza Principal S/N', 'Simoca', 'minorista'::varchar(50), true),
    ('CLI-SIM-004', 'Cooperativa Agrícola', '381-555-1304', 'Ruta 9 Km 48', 'Simoca', 'distribuidor'::varchar(50), true)
) AS v(codigo, nombre, telefono, direccion, zona_entrega, tipo_cliente, activo)
WHERE NOT EXISTS (
    SELECT 1 FROM clientes c WHERE c.codigo = v.codigo
);

-- ===========================================
-- 6. CREAR PEDIDOS (VENTAS) PARA TODAS LAS SUCURSALES - Últimos 7 días
-- ===========================================

-- Ventas para Sucursal Alberdi
INSERT INTO pedidos (
    numero_pedido, sucursal_id, cliente_id, estado, pago_estado, total, subtotal,
    costo_total, margen_bruto_total, fecha_entrega_estimada, created_at
)
SELECT
    'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || c.id::TEXT) FROM 1 FOR 4)),
    s.id,
    c.id,
    'completado',
    CASE WHEN c.tipo_cliente = 'minorista' THEN 'pagado' ELSE 'pagado' END,
    CASE
        WHEN c.codigo = 'CLI-ALB-001' THEN 3950.00
        WHEN c.codigo = 'CLI-ALB-002' THEN 2650.00
        WHEN c.codigo = 'CLI-ALB-003' THEN 14200.00
        WHEN c.codigo = 'CLI-ALB-004' THEN 25800.00
    END,
    CASE
        WHEN c.codigo = 'CLI-ALB-001' THEN 3950.00
        WHEN c.codigo = 'CLI-ALB-002' THEN 2650.00
        WHEN c.codigo = 'CLI-ALB-003' THEN 14200.00
        WHEN c.codigo = 'CLI-ALB-004' THEN 25800.00
    END,
    CASE
        WHEN c.codigo = 'CLI-ALB-001' THEN 3160.00
        WHEN c.codigo = 'CLI-ALB-002' THEN 2120.00
        WHEN c.codigo = 'CLI-ALB-003' THEN 12100.00
        WHEN c.codigo = 'CLI-ALB-004' THEN 20640.00
    END,
    CASE
        WHEN c.codigo = 'CLI-ALB-001' THEN 790.00
        WHEN c.codigo = 'CLI-ALB-002' THEN 530.00
        WHEN c.codigo = 'CLI-ALB-003' THEN 2100.00
        WHEN c.codigo = 'CLI-ALB-004' THEN 5160.00
    END,
    CASE
        WHEN c.codigo = 'CLI-ALB-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-ALB-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-ALB-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-ALB-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END,
    CASE
        WHEN c.codigo = 'CLI-ALB-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-ALB-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-ALB-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-ALB-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END
FROM sucursales s
CROSS JOIN clientes c
WHERE s.nombre = 'Sucursal Alberdi' AND c.zona_entrega = 'Alberdi';

-- Ventas para Sucursal San Martín
INSERT INTO pedidos (
    numero_pedido, sucursal_id, cliente_id, estado, pago_estado, total, subtotal,
    costo_total, margen_bruto_total, fecha_entrega_estimada, created_at
)
SELECT
    'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || c.id::TEXT || 'SMA') FROM 1 FOR 4)),
    s.id,
    c.id,
    'completado',
    CASE WHEN c.tipo_cliente = 'minorista' THEN 'pagado' ELSE 'pagado' END,
    CASE
        WHEN c.codigo = 'CLI-SMA-001' THEN 3650.00
        WHEN c.codigo = 'CLI-SMA-002' THEN 2450.00
        WHEN c.codigo = 'CLI-SMA-003' THEN 13100.00
        WHEN c.codigo = 'CLI-SMA-004' THEN 23500.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SMA-001' THEN 3650.00
        WHEN c.codigo = 'CLI-SMA-002' THEN 2450.00
        WHEN c.codigo = 'CLI-SMA-003' THEN 13100.00
        WHEN c.codigo = 'CLI-SMA-004' THEN 23500.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SMA-001' THEN 2920.00
        WHEN c.codigo = 'CLI-SMA-002' THEN 1960.00
        WHEN c.codigo = 'CLI-SMA-003' THEN 11150.00
        WHEN c.codigo = 'CLI-SMA-004' THEN 18800.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SMA-001' THEN 730.00
        WHEN c.codigo = 'CLI-SMA-002' THEN 490.00
        WHEN c.codigo = 'CLI-SMA-003' THEN 1950.00
        WHEN c.codigo = 'CLI-SMA-004' THEN 4700.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SMA-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-SMA-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-SMA-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-SMA-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END,
    CASE
        WHEN c.codigo = 'CLI-SMA-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-SMA-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-SMA-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-SMA-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END
FROM sucursales s
CROSS JOIN clientes c
WHERE s.nombre = 'Sucursal San Martín' AND c.zona_entrega = 'San Martín';

-- Ventas para Sucursal Colón
INSERT INTO pedidos (
    numero_pedido, sucursal_id, cliente_id, estado, pago_estado, total, subtotal,
    costo_total, margen_bruto_total, fecha_entrega_estimada, created_at
)
SELECT
    'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || c.id::TEXT || 'COL') FROM 1 FOR 4)),
    s.id,
    c.id,
    'completado',
    CASE WHEN c.tipo_cliente = 'minorista' THEN 'pagado' ELSE 'pagado' END,
    CASE
        WHEN c.codigo = 'CLI-COL-001' THEN 4250.00
        WHEN c.codigo = 'CLI-COL-002' THEN 2850.00
        WHEN c.codigo = 'CLI-COL-003' THEN 15600.00
        WHEN c.codigo = 'CLI-COL-004' THEN 28500.00
    END,
    CASE
        WHEN c.codigo = 'CLI-COL-001' THEN 4250.00
        WHEN c.codigo = 'CLI-COL-002' THEN 2850.00
        WHEN c.codigo = 'CLI-COL-003' THEN 15600.00
        WHEN c.codigo = 'CLI-COL-004' THEN 28500.00
    END,
    CASE
        WHEN c.codigo = 'CLI-COL-001' THEN 3400.00
        WHEN c.codigo = 'CLI-COL-002' THEN 2280.00
        WHEN c.codigo = 'CLI-COL-003' THEN 13500.00
        WHEN c.codigo = 'CLI-COL-004' THEN 24500.00
    END,
    CASE
        WHEN c.codigo = 'CLI-COL-001' THEN 850.00
        WHEN c.codigo = 'CLI-COL-002' THEN 570.00
        WHEN c.codigo = 'CLI-COL-003' THEN 2100.00
        WHEN c.codigo = 'CLI-COL-004' THEN 4000.00
    END,
    CASE
        WHEN c.codigo = 'CLI-COL-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-COL-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-COL-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-COL-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END,
    CASE
        WHEN c.codigo = 'CLI-COL-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-COL-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-COL-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-COL-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END
FROM sucursales s
CROSS JOIN clientes c
WHERE s.nombre = 'Sucursal Colón' AND c.zona_entrega = 'Colón';

-- Ventas para Sucursal Simoca
INSERT INTO pedidos (
    numero_pedido, sucursal_id, cliente_id, estado, pago_estado, total, subtotal,
    costo_total, margen_bruto_total, fecha_entrega_estimada, created_at
)
SELECT
    'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || c.id::TEXT || 'SIM') FROM 1 FOR 4)),
    s.id,
    c.id,
    'completado',
    CASE WHEN c.tipo_cliente = 'minorista' THEN 'pagado' ELSE 'pagado' END,
    CASE
        WHEN c.codigo = 'CLI-SIM-001' THEN 3200.00
        WHEN c.codigo = 'CLI-SIM-002' THEN 1850.00
        WHEN c.codigo = 'CLI-SIM-003' THEN 12800.00
        WHEN c.codigo = 'CLI-SIM-004' THEN 35000.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SIM-001' THEN 3200.00
        WHEN c.codigo = 'CLI-SIM-002' THEN 1850.00
        WHEN c.codigo = 'CLI-SIM-003' THEN 12800.00
        WHEN c.codigo = 'CLI-SIM-004' THEN 35000.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SIM-001' THEN 2560.00
        WHEN c.codigo = 'CLI-SIM-002' THEN 1480.00
        WHEN c.codigo = 'CLI-SIM-003' THEN 11200.00
        WHEN c.codigo = 'CLI-SIM-004' THEN 31500.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SIM-001' THEN 640.00
        WHEN c.codigo = 'CLI-SIM-002' THEN 370.00
        WHEN c.codigo = 'CLI-SIM-003' THEN 1600.00
        WHEN c.codigo = 'CLI-SIM-004' THEN 3500.00
    END,
    CASE
        WHEN c.codigo = 'CLI-SIM-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-SIM-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-SIM-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-SIM-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END,
    CASE
        WHEN c.codigo = 'CLI-SIM-001' THEN CURRENT_DATE - INTERVAL '1 day'
        WHEN c.codigo = 'CLI-SIM-002' THEN CURRENT_DATE - INTERVAL '2 days'
        WHEN c.codigo = 'CLI-SIM-003' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN c.codigo = 'CLI-SIM-004' THEN CURRENT_DATE - INTERVAL '4 days'
    END
FROM sucursales s
CROSS JOIN clientes c
WHERE s.nombre = 'Sucursal Simoca' AND c.zona_entrega = 'Simoca';

-- ===========================================
-- 7. CREAR ALERTAS DE STOCK PARA TODAS LAS SUCURSALES
-- ===========================================

-- Alertas pendientes (solo si no existen)
INSERT INTO alertas_stock (sucursal_id, producto_id, cantidad_actual, umbral, estado)
SELECT DISTINCT
    s.id,
    p.id,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' AND p.codigo = 'POLLO003' THEN 32
        WHEN s.nombre = 'Sucursal San Martín' AND p.codigo = 'POLLO002' THEN 42
        WHEN s.nombre = 'Sucursal Colón' AND p.codigo = 'POLLO003' THEN 45
        WHEN s.nombre = 'Sucursal Simoca' AND p.codigo = 'POLLO002' THEN 35
    END,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 35
        WHEN s.nombre = 'Sucursal San Martín' THEN 45
        WHEN s.nombre = 'Sucursal Colón' THEN 50
        WHEN s.nombre = 'Sucursal Simoca' THEN 40
    END,
    'pendiente'
FROM sucursales s, productos p
WHERE s.nombre IN ('Sucursal Alberdi', 'Sucursal San Martín', 'Sucursal Colón', 'Sucursal Simoca')
AND p.activo = true
AND (
    (s.nombre = 'Sucursal Alberdi' AND p.codigo = 'POLLO003') OR
    (s.nombre = 'Sucursal San Martín' AND p.codigo = 'POLLO002') OR
    (s.nombre = 'Sucursal Colón' AND p.codigo = 'POLLO003') OR
    (s.nombre = 'Sucursal Simoca' AND p.codigo = 'POLLO002')
)
AND NOT EXISTS (
    SELECT 1 FROM alertas_stock a
    WHERE a.sucursal_id = s.id AND a.producto_id = p.id AND a.estado = 'pendiente'
);

-- Alertas resueltas (históricas)
INSERT INTO alertas_stock (sucursal_id, producto_id, cantidad_actual, umbral, estado, created_at)
SELECT DISTINCT
    s.id,
    p.id,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 6
        WHEN s.nombre = 'Sucursal San Martín' THEN 7
        WHEN s.nombre = 'Sucursal Colón' THEN 8
        WHEN s.nombre = 'Sucursal Simoca' THEN 5
    END,
    10,
    'resuelto',
    CURRENT_DATE - INTERVAL '5 days'
FROM sucursales s, productos p
WHERE s.nombre IN ('Sucursal Alberdi', 'Sucursal San Martín', 'Sucursal Colón', 'Sucursal Simoca')
AND p.codigo = 'HUEVO002'
AND NOT EXISTS (
    SELECT 1 FROM alertas_stock a
    WHERE a.sucursal_id = s.id AND a.producto_id = p.id AND a.estado = 'resuelto'
);

-- ===========================================
-- 8. CREAR TRANSFERENCIAS ENTRE SUCURSALES
-- ===========================================

-- Transferencias para todas las sucursales
INSERT INTO transferencias_stock (
    numero_transferencia, sucursal_origen_id, sucursal_destino_id, estado,
    solicitado_por, aprobado_por, fecha_aprobacion,
    recibido_por, fecha_recepcion, observaciones
)
SELECT
    'TRF-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || destino.nombre::TEXT) FROM 1 FOR 4)),
    origen.id,
    destino.id,
    CASE
        WHEN destino.nombre = 'Sucursal Alberdi' THEN 'recibida'
        WHEN destino.nombre = 'Sucursal San Martín' THEN 'en_transito'
        WHEN destino.nombre = 'Sucursal Colón' THEN 'pendiente'
        WHEN destino.nombre = 'Sucursal Simoca' THEN 'recibida'
    END,
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    CASE
        WHEN destino.nombre IN ('Sucursal Alberdi', 'Sucursal Simoca') THEN (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1)
        ELSE NULL
    END,
    CASE
        WHEN destino.nombre IN ('Sucursal Alberdi', 'Sucursal Simoca') THEN CURRENT_DATE - INTERVAL '5 days'
        ELSE NULL
    END,
    CASE
        WHEN destino.nombre = 'Sucursal Alberdi' THEN (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1)
        WHEN destino.nombre = 'Sucursal Simoca' THEN (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1)
        ELSE NULL
    END,
    CASE
        WHEN destino.nombre = 'Sucursal Alberdi' THEN CURRENT_DATE - INTERVAL '4 days'
        WHEN destino.nombre = 'Sucursal Simoca' THEN CURRENT_DATE - INTERVAL '3 days'
        ELSE NULL
    END,
    CASE
        WHEN destino.nombre = 'Sucursal Alberdi' THEN 'Transferencia semanal completada'
        WHEN destino.nombre = 'Sucursal San Martín' THEN 'Envío programado'
        WHEN destino.nombre = 'Sucursal Colón' THEN 'Reposición semanal de stock'
        WHEN destino.nombre = 'Sucursal Simoca' THEN 'Transferencia mensual completada'
    END
FROM sucursales origen, sucursales destino
WHERE origen.nombre = 'Casa Central'
AND destino.nombre IN ('Sucursal Alberdi', 'Sucursal San Martín', 'Sucursal Colón', 'Sucursal Simoca');

-- ===========================================
-- 9. CREAR CONTEOS DE STOCK
-- ===========================================

-- Conteos para todas las sucursales
INSERT INTO conteos_stock (
    sucursal_id, fecha_conteo, estado, realizado_por,
    total_diferencias, total_merma_valor, observaciones, created_at
)
SELECT
    s.id,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN CURRENT_DATE - INTERVAL '7 days'
        WHEN s.nombre = 'Sucursal San Martín' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN s.nombre = 'Sucursal Colón' THEN CURRENT_DATE - INTERVAL '5 days'
        WHEN s.nombre = 'Sucursal Simoca' THEN CURRENT_DATE
    END,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 'aprobado'
        WHEN s.nombre = 'Sucursal San Martín' THEN 'aprobado'
        WHEN s.nombre = 'Sucursal Colón' THEN 'aprobado'
        WHEN s.nombre = 'Sucursal Simoca' THEN 'en_proceso'
    END,
    (SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1),
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 2
        WHEN s.nombre = 'Sucursal San Martín' THEN 1
        WHEN s.nombre = 'Sucursal Colón' THEN 3
        WHEN s.nombre = 'Sucursal Simoca' THEN 0
    END,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 950.00
        WHEN s.nombre = 'Sucursal San Martín' THEN 480.00
        WHEN s.nombre = 'Sucursal Colón' THEN 1250.00
        WHEN s.nombre = 'Sucursal Simoca' THEN 0
    END,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN 'Conteo mensual aprobado'
        WHEN s.nombre = 'Sucursal San Martín' THEN 'Conteo semanal aprobado'
        WHEN s.nombre = 'Sucursal Colón' THEN 'Conteo mensual - Diferencias menores dentro de tolerancia'
        WHEN s.nombre = 'Sucursal Simoca' THEN 'Conteo semanal en progreso'
    END,
    CASE
        WHEN s.nombre = 'Sucursal Alberdi' THEN CURRENT_DATE - INTERVAL '7 days'
        WHEN s.nombre = 'Sucursal San Martín' THEN CURRENT_DATE - INTERVAL '3 days'
        WHEN s.nombre = 'Sucursal Colón' THEN CURRENT_DATE - INTERVAL '5 days'
        WHEN s.nombre = 'Sucursal Simoca' THEN CURRENT_DATE
    END
FROM sucursales s
WHERE s.nombre IN ('Sucursal Alberdi', 'Sucursal San Martín', 'Sucursal Colón', 'Sucursal Simoca');

-- ===========================================
-- 10. CREAR MOVIMIENTOS DE CAJA
-- ===========================================

-- Movimientos para todas las sucursales
INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, descripcion, metodo_pago, created_at
)
SELECT
    c.id,
    CASE WHEN tipo_mov = 'ingreso' THEN 'ingreso' ELSE 'egreso' END,
    monto,
    descripcion,
    metodo_pago,
    fecha
FROM tesoreria_cajas c
CROSS JOIN (
    VALUES
        ('Sucursal Alberdi', 'ingreso', 3950.00, 'Venta del día - Almacén Centro', 'efectivo', CURRENT_DATE - INTERVAL '1 day'),
        ('Sucursal Alberdi', 'ingreso', 2650.00, 'Venta del día - Carnicería El Progreso', 'efectivo', CURRENT_DATE - INTERVAL '2 days'),
        ('Sucursal Alberdi', 'egreso', 1200.00, 'Gastos operativos - Suministros', 'efectivo', CURRENT_DATE - INTERVAL '1 day'),
        ('Sucursal San Martín', 'ingreso', 3650.00, 'Venta del día - Despensa Doña Ana', 'efectivo', CURRENT_DATE - INTERVAL '1 day'),
        ('Sucursal San Martín', 'ingreso', 2450.00, 'Venta del día - Carnicería San Martín', 'efectivo', CURRENT_DATE - INTERVAL '2 days'),
        ('Sucursal San Martín', 'egreso', 1000.00, 'Gastos operativos - Servicios', 'efectivo', CURRENT_DATE - INTERVAL '2 days'),
        ('Sucursal Colón', 'ingreso', 4250.00, 'Venta del día - Almacén Don Pedro', 'efectivo', CURRENT_DATE - INTERVAL '1 day'),
        ('Sucursal Colón', 'ingreso', 2850.00, 'Venta del día - Carnicería El Gaucho', 'efectivo', CURRENT_DATE - INTERVAL '3 days'),
        ('Sucursal Colón', 'egreso', 1500.00, 'Gastos operativos - Limpieza', 'efectivo', CURRENT_DATE - INTERVAL '2 days'),
        ('Sucursal Simoca', 'ingreso', 3200.00, 'Venta del día - Despensa María', 'efectivo', CURRENT_DATE - INTERVAL '1 day'),
        ('Sucursal Simoca', 'ingreso', 1850.00, 'Venta del día - Pollería Central', 'efectivo', CURRENT_DATE - INTERVAL '4 days'),
        ('Sucursal Simoca', 'egreso', 800.00, 'Gastos operativos - Combustible', 'efectivo', CURRENT_DATE - INTERVAL '3 days')
) AS movimientos(sucursal, tipo_mov, monto, descripcion, metodo_pago, fecha)
WHERE c.nombre = 'Caja ' || movimientos.sucursal;

-- ===========================================
-- 11. CREAR AUDITORÍA DE LISTAS DE PRECIOS
-- ===========================================

-- Auditoría para Sucursal Alberdi
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
    3950.00,
    CURRENT_DATE - INTERVAL '1 day'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal Alberdi'
AND c.codigo = 'CLI-ALB-001'
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
    18.0,
    14200.00,
    CURRENT_DATE - INTERVAL '3 days'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal Alberdi'
AND c.codigo = 'CLI-ALB-003'
AND lp.codigo = 'MAYORISTA';

-- Auditoría para Sucursal San Martín
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
    3650.00,
    CURRENT_DATE - INTERVAL '1 day'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal San Martín'
AND c.codigo = 'CLI-SMA-001'
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
    15.0,
    13100.00,
    CURRENT_DATE - INTERVAL '2 days'
FROM sucursales s, clientes c, listas_precios lp
WHERE s.nombre = 'Sucursal San Martín'
AND c.codigo = 'CLI-SMA-003'
AND lp.codigo = 'MAYORISTA';

-- Auditoría para Sucursal Colón
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

-- Auditoría para Sucursal Simoca
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

