-- ===========================================
-- MIGRACIÓN: Mejoras en sistema de facturas y cuenta corriente
-- Fecha: 21/12/2025
-- Descripción: Agregar estado de pago, fecha vencimiento, moras a facturas
--              y mejorar gestión de cuenta corriente
-- ===========================================

BEGIN;

-- =====================
-- FASE 1: MEJORAS EN FACTURAS
-- =====================

-- Agregar campos de estado de pago a facturas
ALTER TABLE facturas 
ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) DEFAULT 'pendiente' 
CHECK (estado_pago IN ('pendiente', 'parcial', 'pagada', 'anulada'));

ALTER TABLE facturas 
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

ALTER TABLE facturas 
ADD COLUMN IF NOT EXISTS monto_pagado DECIMAL(12,2) DEFAULT 0;

ALTER TABLE facturas 
ADD COLUMN IF NOT EXISTS saldo_pendiente DECIMAL(12,2);

-- Agregar campos para moras (preparación Fase 3)
ALTER TABLE facturas 
ADD COLUMN IF NOT EXISTS dias_vencida INTEGER DEFAULT 0;

ALTER TABLE facturas 
ADD COLUMN IF NOT EXISTS mora_calculada DECIMAL(12,2) DEFAULT 0;

-- Trigger para calcular saldo_pendiente automáticamente
CREATE OR REPLACE FUNCTION fn_calcular_saldo_factura()
RETURNS TRIGGER AS $$
BEGIN
    NEW.saldo_pendiente := COALESCE(NEW.total, 0) - COALESCE(NEW.monto_pagado, 0);
    
    -- Actualizar estado basado en monto pagado
    IF NEW.monto_pagado >= NEW.total THEN
        NEW.estado_pago := 'pagada';
    ELSIF NEW.monto_pagado > 0 THEN
        NEW.estado_pago := 'parcial';
    ELSE
        NEW.estado_pago := 'pendiente';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calcular_saldo_factura ON facturas;
CREATE TRIGGER trg_calcular_saldo_factura
    BEFORE INSERT OR UPDATE OF monto_pagado, total ON facturas
    FOR EACH ROW
    EXECUTE FUNCTION fn_calcular_saldo_factura();

-- Actualizar facturas existentes para calcular saldo_pendiente
UPDATE facturas 
SET saldo_pendiente = total - COALESCE(monto_pagado, 0)
WHERE saldo_pendiente IS NULL;

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_facturas_estado_pago ON facturas(estado_pago);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_vencimiento ON facturas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON facturas(cliente_id);

-- =====================
-- FASE 2: MEJORAS EN CUENTA CORRIENTE
-- =====================

-- Agregar campos de configuración de moras a clientes (para Fase 3)
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS dias_gracia_mora INTEGER DEFAULT 7;

ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS porcentaje_mora_mensual DECIMAL(5,2) DEFAULT 0;

ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS mora_habilitada BOOLEAN DEFAULT FALSE;

-- Función para registrar pago a cuenta corriente
CREATE OR REPLACE FUNCTION fn_registrar_pago_cuenta_corriente(
    p_cliente_id UUID,
    p_monto DECIMAL(12,2),
    p_metodo_pago VARCHAR(50),
    p_descripcion TEXT DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL,
    p_factura_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_cuenta_id UUID;
    v_saldo_anterior DECIMAL(12,2);
    v_saldo_nuevo DECIMAL(12,2);
    v_movimiento_id UUID;
BEGIN
    -- Verificar que el cliente existe
    IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;
    
    -- Asegurar que existe cuenta corriente
    v_cuenta_id := fn_asegurar_cuenta_corriente(p_cliente_id);
    
    -- Obtener saldo actual
    SELECT COALESCE(saldo, 0) INTO v_saldo_anterior
    FROM cuentas_corrientes
    WHERE id = v_cuenta_id;
    
    -- Calcular nuevo saldo (el pago reduce el saldo/deuda)
    v_saldo_nuevo := v_saldo_anterior - p_monto;
    
    -- Actualizar cuenta corriente
    UPDATE cuentas_corrientes
    SET saldo = v_saldo_nuevo,
        updated_at = NOW()
    WHERE id = v_cuenta_id;
    
    -- Registrar movimiento en cuentas_movimientos
    INSERT INTO cuentas_movimientos (
        cuenta_corriente_id,
        tipo,
        monto,
        descripcion,
        metodo_pago,
        origen_tipo,
        origen_id
    ) VALUES (
        v_cuenta_id,
        'pago',
        p_monto,
        COALESCE(p_descripcion, 'Pago a cuenta corriente - ' || p_metodo_pago),
        p_metodo_pago,
        CASE WHEN p_factura_id IS NOT NULL THEN 'factura' ELSE 'pago_directo' END,
        p_factura_id
    )
    RETURNING id INTO v_movimiento_id;
    
    -- Si hay factura asociada, actualizar su monto pagado
    IF p_factura_id IS NOT NULL THEN
        UPDATE facturas
        SET monto_pagado = COALESCE(monto_pagado, 0) + p_monto,
            updated_at = NOW()
        WHERE id = p_factura_id;
    END IF;
    
    -- Verificar si el cliente debe ser desbloqueado
    IF v_saldo_nuevo <= (SELECT COALESCE(limite_credito, 0) FROM cuentas_corrientes WHERE id = v_cuenta_id) THEN
        UPDATE clientes
        SET bloqueado_por_deuda = FALSE,
            updated_at = NOW()
        WHERE id = p_cliente_id AND bloqueado_por_deuda = TRUE;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'movimiento_id', v_movimiento_id,
        'saldo_anterior', v_saldo_anterior,
        'saldo_nuevo', v_saldo_nuevo,
        'monto_registrado', p_monto
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener resumen de cuenta corriente de un cliente
CREATE OR REPLACE FUNCTION fn_obtener_resumen_cuenta_cliente(p_cliente_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_resultado JSONB;
    v_cuenta RECORD;
    v_facturas_pendientes JSONB;
    v_ultimos_movimientos JSONB;
BEGIN
    -- Obtener datos de cuenta corriente
    SELECT 
        cc.id,
        cc.saldo,
        cc.limite_credito,
        cc.updated_at,
        c.nombre as cliente_nombre,
        c.bloqueado_por_deuda,
        c.dias_gracia_mora,
        c.porcentaje_mora_mensual
    INTO v_cuenta
    FROM cuentas_corrientes cc
    JOIN clientes c ON c.id = cc.cliente_id
    WHERE cc.cliente_id = p_cliente_id;
    
    IF v_cuenta IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cuenta no encontrada');
    END IF;
    
    -- Obtener facturas pendientes
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', f.id,
        'numero_factura', f.numero_factura,
        'fecha_emision', f.fecha_emision,
        'fecha_vencimiento', f.fecha_vencimiento,
        'total', f.total,
        'monto_pagado', f.monto_pagado,
        'saldo_pendiente', f.saldo_pendiente,
        'estado_pago', f.estado_pago,
        'dias_vencida', CASE 
            WHEN f.fecha_vencimiento < CURRENT_DATE THEN 
                CURRENT_DATE - f.fecha_vencimiento 
            ELSE 0 
        END
    ) ORDER BY f.fecha_emision DESC), '[]'::jsonb)
    INTO v_facturas_pendientes
    FROM facturas f
    WHERE f.cliente_id = p_cliente_id
    AND f.estado_pago IN ('pendiente', 'parcial');
    
    -- Obtener últimos 10 movimientos
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', cm.id,
        'tipo', cm.tipo,
        'monto', cm.monto,
        'descripcion', cm.descripcion,
        'fecha', cm.created_at
    ) ORDER BY cm.created_at DESC), '[]'::jsonb)
    INTO v_ultimos_movimientos
    FROM cuentas_movimientos cm
    WHERE cm.cuenta_corriente_id = v_cuenta.id
    LIMIT 10;
    
    RETURN jsonb_build_object(
        'success', true,
        'cuenta', jsonb_build_object(
            'id', v_cuenta.id,
            'saldo', v_cuenta.saldo,
            'limite_credito', v_cuenta.limite_credito,
            'credito_disponible', COALESCE(v_cuenta.limite_credito, 0) - COALESCE(v_cuenta.saldo, 0),
            'bloqueado', v_cuenta.bloqueado_por_deuda,
            'cliente_nombre', v_cuenta.cliente_nombre
        ),
        'facturas_pendientes', v_facturas_pendientes,
        'ultimos_movimientos', v_ultimos_movimientos,
        'total_facturas_pendientes', (
            SELECT COUNT(*) FROM facturas 
            WHERE cliente_id = p_cliente_id 
            AND estado_pago IN ('pendiente', 'parcial')
        ),
        'total_deuda_facturas', (
            SELECT COALESCE(SUM(saldo_pendiente), 0) FROM facturas 
            WHERE cliente_id = p_cliente_id 
            AND estado_pago IN ('pendiente', 'parcial')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_registrar_pago_cuenta_corriente IS 
'Registra un pago a la cuenta corriente de un cliente.
Actualiza saldo de cuenta, registra movimiento, y opcionalmente actualiza factura.';

COMMENT ON FUNCTION fn_obtener_resumen_cuenta_cliente IS 
'Obtiene resumen completo de cuenta corriente: saldo, facturas pendientes, movimientos.';

COMMIT;
