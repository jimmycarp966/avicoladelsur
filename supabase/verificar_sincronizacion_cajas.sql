-- ===========================================
-- SCRIPT: Verificación de Sincronización de Cajas
-- Fecha: 2025-01-02
-- Descripción: Verifica que las cajas estén correctamente sincronizadas con tesorería
-- ===========================================

-- 1. VERIFICAR QUE SALDO_ACTUAL COINCIDA CON SUMA DE MOVIMIENTOS
SELECT 
    'Verificación de Saldos' as tipo_verificacion,
    tc.id as caja_id,
    tc.nombre as caja_nombre,
    tc.sucursal_id,
    s.nombre as sucursal_nombre,
    tc.saldo_inicial,
    tc.saldo_actual as saldo_actual_registrado,
    -- Calcular saldo esperado desde movimientos
    COALESCE(
        tc.saldo_inicial + 
        SUM(CASE 
            WHEN tm.tipo = 'ingreso' THEN tm.monto 
            WHEN tm.tipo = 'egreso' THEN -tm.monto 
            ELSE 0 
        END),
        tc.saldo_inicial
    ) as saldo_actual_calculado,
    -- Diferencia
    tc.saldo_actual - COALESCE(
        tc.saldo_inicial + 
        SUM(CASE 
            WHEN tm.tipo = 'ingreso' THEN tm.monto 
            WHEN tm.tipo = 'egreso' THEN -tm.monto 
            ELSE 0 
        END),
        tc.saldo_inicial
    ) as diferencia,
    -- Estado
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
    END as estado_sincronizacion,
    COUNT(tm.id) as total_movimientos
FROM tesoreria_cajas tc
LEFT JOIN tesoreria_movimientos tm ON tm.caja_id = tc.id
LEFT JOIN sucursales s ON s.id = tc.sucursal_id
GROUP BY tc.id, tc.nombre, tc.sucursal_id, s.nombre, tc.saldo_inicial, tc.saldo_actual
ORDER BY diferencia DESC NULLS LAST;

-- 2. VERIFICAR QUE TODAS LAS CAJAS TENGAN SUCURSAL_ID ASIGNADO
SELECT 
    'Verificación de Sucursal' as tipo_verificacion,
    tc.id as caja_id,
    tc.nombre as caja_nombre,
    tc.sucursal_id,
    s.nombre as sucursal_nombre,
    CASE 
        WHEN tc.sucursal_id IS NULL THEN '❌ Sin sucursal asignada'
        WHEN s.id IS NULL THEN '❌ Sucursal no existe'
        ELSE '✅ Sucursal asignada correctamente'
    END as estado_sucursal
FROM tesoreria_cajas tc
LEFT JOIN sucursales s ON s.id = tc.sucursal_id
ORDER BY 
    CASE 
        WHEN tc.sucursal_id IS NULL THEN 1
        WHEN s.id IS NULL THEN 2
        ELSE 3
    END;

-- 3. DETECTAR MOVIMIENTOS HUÉRFANOS (sin caja válida)
SELECT 
    'Movimientos Huérfanos' as tipo_verificacion,
    tm.id as movimiento_id,
    tm.caja_id,
    tm.tipo,
    tm.monto,
    tm.descripcion,
    tm.created_at,
    CASE 
        WHEN tc.id IS NULL THEN '❌ Caja no existe'
        ELSE '✅ Caja válida'
    END as estado_caja
FROM tesoreria_movimientos tm
LEFT JOIN tesoreria_cajas tc ON tc.id = tm.caja_id
WHERE tc.id IS NULL
ORDER BY tm.created_at DESC;

-- 4. DETECTAR SALDOS NEGATIVOS O INCONSISTENTES
SELECT 
    'Saldos Negativos' as tipo_verificacion,
    tc.id as caja_id,
    tc.nombre as caja_nombre,
    tc.sucursal_id,
    s.nombre as sucursal_nombre,
    tc.saldo_inicial,
    tc.saldo_actual,
    CASE 
        WHEN tc.saldo_actual < 0 THEN '❌ Saldo negativo'
        WHEN tc.saldo_actual < tc.saldo_inicial AND tc.saldo_inicial > 0 THEN '⚠️ Saldo menor al inicial'
        ELSE '✅ Saldo válido'
    END as estado_saldo,
    COUNT(tm.id) as total_movimientos
FROM tesoreria_cajas tc
LEFT JOIN tesoreria_movimientos tm ON tm.caja_id = tc.id
LEFT JOIN sucursales s ON s.id = tc.sucursal_id
WHERE tc.saldo_actual < 0 
   OR (tc.saldo_actual < tc.saldo_inicial AND tc.saldo_inicial > 0)
GROUP BY tc.id, tc.nombre, tc.sucursal_id, s.nombre, tc.saldo_inicial, tc.saldo_actual
ORDER BY tc.saldo_actual ASC;

-- 5. RESUMEN GENERAL
WITH cajas_con_saldos AS (
    SELECT 
        tc.id,
        tc.sucursal_id,
        tc.saldo_actual,
        tc.saldo_inicial,
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
    GROUP BY tc.id, tc.sucursal_id, tc.saldo_actual, tc.saldo_inicial
)
SELECT 
    'Resumen General' as tipo_verificacion,
    COUNT(DISTINCT tc.id) as total_cajas,
    COUNT(DISTINCT CASE WHEN tc.sucursal_id IS NOT NULL THEN tc.id END) as cajas_con_sucursal,
    COUNT(DISTINCT CASE WHEN tc.sucursal_id IS NULL THEN tc.id END) as cajas_sin_sucursal,
    COUNT(DISTINCT tm.id) as total_movimientos,
    COUNT(DISTINCT CASE WHEN tc2.id IS NULL THEN tm.id END) as movimientos_huerfanos,
    COUNT(DISTINCT CASE WHEN tc.saldo_actual < 0 THEN tc.id END) as cajas_saldo_negativo,
    COUNT(DISTINCT CASE 
        WHEN ABS(ccs.saldo_actual - ccs.saldo_calculado) >= 0.01 THEN ccs.id
    END) as cajas_desincronizadas
FROM tesoreria_cajas tc
LEFT JOIN tesoreria_movimientos tm ON tm.caja_id = tc.id
LEFT JOIN tesoreria_cajas tc2 ON tc2.id = tm.caja_id
LEFT JOIN cajas_con_saldos ccs ON ccs.id = tc.id;

