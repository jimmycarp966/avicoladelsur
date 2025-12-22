-- ===========================================
-- MIGRACIÓN: Sistema de Moras para Facturas Vencidas
-- Fecha: 21/12/2025
-- Descripción: Función para calcular moras y vista de clientes morosos
-- ===========================================

BEGIN;

-- Función para obtener clientes con deuda y moratorias
CREATE OR REPLACE FUNCTION fn_obtener_clientes_morosos()
RETURNS TABLE (
    cliente_id UUID,
    cliente_nombre TEXT,
    cliente_telefono TEXT,
    cliente_whatsapp TEXT,
    bloqueado_por_deuda BOOLEAN,
    limite_credito DECIMAL(12,2),
    saldo_cuenta_corriente DECIMAL(12,2),
    total_facturas_pendientes INTEGER,
    total_deuda_facturas DECIMAL(12,2),
    factura_mas_antigua_fecha DATE,
    dias_maximos_vencido INTEGER,
    total_mora_calculada DECIMAL(12,2),
    dias_gracia INTEGER,
    porcentaje_mora DECIMAL(5,2),
    deuda_total DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS cliente_id,
        c.nombre::TEXT AS cliente_nombre,
        c.telefono::TEXT AS cliente_telefono,
        c.whatsapp::TEXT AS cliente_whatsapp,
        COALESCE(c.bloqueado_por_deuda, FALSE) AS bloqueado_por_deuda,
        COALESCE(cc.limite_credito, c.limite_credito, 0)::DECIMAL(12,2) AS limite_credito,
        COALESCE(cc.saldo, c.saldo_cuenta_corriente, 0)::DECIMAL(12,2) AS saldo_cuenta_corriente,
        COUNT(f.id)::INTEGER AS total_facturas_pendientes,
        COALESCE(SUM(f.saldo_pendiente), 0)::DECIMAL(12,2) AS total_deuda_facturas,
        MIN(f.fecha_emision)::DATE AS factura_mas_antigua_fecha,
        COALESCE(MAX(
            CASE 
                WHEN f.fecha_vencimiento IS NOT NULL AND f.fecha_vencimiento < CURRENT_DATE 
                THEN CURRENT_DATE - f.fecha_vencimiento 
                ELSE 0 
            END
        ), 0)::INTEGER AS dias_maximos_vencido,
        COALESCE(SUM(f.mora_calculada), 0)::DECIMAL(12,2) AS total_mora_calculada,
        COALESCE(c.dias_gracia_mora, 7)::INTEGER AS dias_gracia,
        COALESCE(c.porcentaje_mora_mensual, 0)::DECIMAL(5,2) AS porcentaje_mora,
        (COALESCE(cc.saldo, c.saldo_cuenta_corriente, 0) + COALESCE(SUM(f.mora_calculada), 0))::DECIMAL(12,2) AS deuda_total
    FROM clientes c
    LEFT JOIN cuentas_corrientes cc ON cc.cliente_id = c.id
    LEFT JOIN facturas f ON f.cliente_id = c.id AND f.estado_pago IN ('pendiente', 'parcial')
    WHERE c.activo = TRUE
    AND (
        -- Tiene deuda en cuenta corriente
        COALESCE(cc.saldo, c.saldo_cuenta_corriente, 0) > 0
        OR
        -- O tiene facturas pendientes
        EXISTS (
            SELECT 1 FROM facturas f2 
            WHERE f2.cliente_id = c.id 
            AND f2.estado_pago IN ('pendiente', 'parcial')
        )
    )
    GROUP BY c.id, c.nombre, c.telefono, c.whatsapp, c.bloqueado_por_deuda, 
             c.limite_credito, c.saldo_cuenta_corriente, c.dias_gracia_mora, 
             c.porcentaje_mora_mensual, cc.limite_credito, cc.saldo
    ORDER BY dias_maximos_vencido DESC, total_deuda_facturas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar moras de facturas vencidas
CREATE OR REPLACE FUNCTION fn_actualizar_moras_facturas()
RETURNS JSONB AS $$
DECLARE
    v_facturas_actualizadas INTEGER := 0;
    v_total_mora DECIMAL(12,2) := 0;
    v_factura RECORD;
    v_dias_vencida INTEGER;
    v_dias_con_mora INTEGER;
    v_mora DECIMAL(12,2);
    v_porcentaje_mora DECIMAL(5,2);
    v_dias_gracia INTEGER;
BEGIN
    -- Recorrer facturas pendientes/parciales con fecha de vencimiento pasada
    FOR v_factura IN
        SELECT 
            f.id,
            f.saldo_pendiente,
            f.fecha_vencimiento,
            COALESCE(c.dias_gracia_mora, 7) as dias_gracia,
            COALESCE(c.porcentaje_mora_mensual, 0) as porcentaje_mora,
            COALESCE(c.mora_habilitada, FALSE) as mora_habilitada
        FROM facturas f
        JOIN clientes c ON c.id = f.cliente_id
        WHERE f.estado_pago IN ('pendiente', 'parcial')
        AND f.fecha_vencimiento IS NOT NULL
        AND f.fecha_vencimiento < CURRENT_DATE
        AND c.mora_habilitada = TRUE
        AND COALESCE(c.porcentaje_mora_mensual, 0) > 0
    LOOP
        -- Calcular días vencidos
        v_dias_vencida := CURRENT_DATE - v_factura.fecha_vencimiento;
        
        -- Días con mora (restando días de gracia)
        v_dias_con_mora := GREATEST(v_dias_vencida - v_factura.dias_gracia, 0);
        
        IF v_dias_con_mora > 0 THEN
            -- Calcular mora (porcentaje mensual prorrateado por día)
            -- Fórmula: saldo * (porcentaje_mensual / 100) * (días_con_mora / 30)
            v_mora := v_factura.saldo_pendiente * (v_factura.porcentaje_mora / 100) * (v_dias_con_mora::DECIMAL / 30);
            
            -- Actualizar factura
            UPDATE facturas
            SET dias_vencida = v_dias_vencida,
                mora_calculada = v_mora,
                updated_at = NOW()
            WHERE id = v_factura.id;
            
            v_facturas_actualizadas := v_facturas_actualizadas + 1;
            v_total_mora := v_total_mora + v_mora;
        ELSE
            -- Resetear mora si está dentro de días de gracia
            UPDATE facturas
            SET dias_vencida = v_dias_vencida,
                mora_calculada = 0,
                updated_at = NOW()
            WHERE id = v_factura.id
            AND (dias_vencida != v_dias_vencida OR mora_calculada != 0);
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'facturas_actualizadas', v_facturas_actualizadas,
        'total_mora_calculada', v_total_mora,
        'fecha_calculo', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener detalle de facturas vencidas de un cliente
CREATE OR REPLACE FUNCTION fn_obtener_facturas_vencidas_cliente(p_cliente_id UUID)
RETURNS TABLE (
    factura_id UUID,
    numero_factura TEXT,
    fecha_emision DATE,
    fecha_vencimiento DATE,
    total DECIMAL(12,2),
    monto_pagado DECIMAL(12,2),
    saldo_pendiente DECIMAL(12,2),
    dias_vencida INTEGER,
    mora_calculada DECIMAL(12,2),
    total_con_mora DECIMAL(12,2),
    estado_pago TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id AS factura_id,
        f.numero_factura::TEXT,
        f.fecha_emision::DATE,
        f.fecha_vencimiento::DATE,
        f.total::DECIMAL(12,2),
        COALESCE(f.monto_pagado, 0)::DECIMAL(12,2) AS monto_pagado,
        COALESCE(f.saldo_pendiente, f.total)::DECIMAL(12,2) AS saldo_pendiente,
        COALESCE(f.dias_vencida, 
            CASE 
                WHEN f.fecha_vencimiento IS NOT NULL AND f.fecha_vencimiento < CURRENT_DATE 
                THEN (CURRENT_DATE - f.fecha_vencimiento)::INTEGER 
                ELSE 0 
            END
        )::INTEGER AS dias_vencida,
        COALESCE(f.mora_calculada, 0)::DECIMAL(12,2) AS mora_calculada,
        (COALESCE(f.saldo_pendiente, f.total) + COALESCE(f.mora_calculada, 0))::DECIMAL(12,2) AS total_con_mora,
        f.estado_pago::TEXT
    FROM facturas f
    WHERE f.cliente_id = p_cliente_id
    AND f.estado_pago IN ('pendiente', 'parcial')
    ORDER BY 
        CASE WHEN f.fecha_vencimiento < CURRENT_DATE THEN 0 ELSE 1 END,
        f.fecha_vencimiento ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_obtener_clientes_morosos IS 
'Obtiene lista de clientes con deuda, ordenados por días de vencimiento.';

COMMENT ON FUNCTION fn_actualizar_moras_facturas IS 
'Calcula y actualiza moras en facturas vencidas según configuración del cliente.';

COMMENT ON FUNCTION fn_obtener_facturas_vencidas_cliente IS 
'Obtiene facturas pendientes/parciales de un cliente con moras calculadas.';

COMMIT;
