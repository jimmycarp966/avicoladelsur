-- ===========================================
-- VERIFICAR CAJA DE SUCURSAL ALBERDI
-- ===========================================

-- 1. Verificar sucursal Alberdi
SELECT 
    'Sucursal Alberdi:' as tipo,
    id,
    nombre,
    active as activa,
    created_at
FROM sucursales
WHERE nombre ILIKE '%alberdi%'
ORDER BY created_at;

-- 2. Verificar cajas asociadas a la sucursal Alberdi
SELECT 
    'Cajas de Sucursal Alberdi:' as tipo,
    tc.id as caja_id,
    tc.nombre as caja_nombre,
    tc.sucursal_id,
    s.nombre as sucursal_nombre,
    tc.saldo_inicial,
    tc.saldo_actual,
    tc.moneda,
    tc.created_at,
    CASE 
        WHEN tc.saldo_inicial = 0 AND tc.saldo_actual = 0 AND tc.created_at::date = CURRENT_DATE THEN 'Posible caja mock/recién creada'
        WHEN tc.saldo_inicial = 0 AND tc.saldo_actual = 0 THEN 'Caja con saldo cero (puede ser mock o real)'
        ELSE 'Caja con movimientos'
    END as estado_caja
FROM tesoreria_cajas tc
LEFT JOIN sucursales s ON s.id = tc.sucursal_id
WHERE s.nombre ILIKE '%alberdi%'
ORDER BY tc.created_at;

-- 3. Verificar movimientos de caja de Alberdi
SELECT 
    'Movimientos de caja Alberdi:' as tipo,
    COUNT(*) as total_movimientos,
    SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) as total_ingresos,
    SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) as total_egresos
FROM tesoreria_movimientos tm
JOIN tesoreria_cajas tc ON tc.id = tm.caja_id
JOIN sucursales s ON s.id = tc.sucursal_id
WHERE s.nombre ILIKE '%alberdi%';

-- 4. Verificar todas las cajas y su origen
SELECT 
    'Todas las cajas:' as tipo,
    tc.id,
    tc.nombre,
    tc.sucursal_id,
    s.nombre as sucursal_nombre,
    tc.saldo_inicial,
    tc.saldo_actual,
    tc.created_at,
    CASE 
        WHEN tc.sucursal_id IS NULL THEN 'Sin sucursal asignada'
        WHEN tc.nombre = 'Caja Principal' AND tc.sucursal_id IS NULL THEN 'Caja mock por defecto'
        WHEN tc.nombre LIKE 'Caja %' AND tc.saldo_inicial = 0 AND tc.saldo_actual = 0 THEN 'Caja creada automáticamente (probable)'
        ELSE 'Caja manual o con datos'
    END as tipo_caja
FROM tesoreria_cajas tc
LEFT JOIN sucursales s ON s.id = tc.sucursal_id
ORDER BY tc.created_at;

