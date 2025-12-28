-- ===========================================
-- MIGRACIÓN: Sistema de Cuentas Corrientes Completo
-- Fecha: 27/12/2025
-- Descripción: Funciones para gestionar cuentas corrientes con saldo a favor
-- ===========================================

BEGIN;

-- 1. Función para obtener TODAS las cuentas corrientes con estado
CREATE OR REPLACE FUNCTION fn_obtener_todas_cuentas_corrientes()
RETURNS TABLE (
    cliente_id UUID,
    cliente_nombre TEXT,
    cliente_telefono TEXT,
    cliente_whatsapp TEXT,
    bloqueado_por_deuda BOOLEAN,
    limite_credito DECIMAL(12,2),
    saldo_cuenta_corriente DECIMAL(12,2),
    total_facturas_pendientes INTEGER,
    ultimo_movimiento_fecha TIMESTAMPTZ,
    estado_cuenta TEXT, -- 'deudor', 'favor', 'al_dia'
    dias_gracia INTEGER,
    porcentaje_mora DECIMAL(5,2)
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
        (SELECT COUNT(f.id)::INTEGER FROM facturas f WHERE f.cliente_id = c.id AND f.estado_pago IN ('pendiente', 'parcial')),
        cc.updated_at AS ultimo_movimiento_fecha,
        CASE
            WHEN COALESCE(cc.saldo, 0) > 0 THEN 'deudor'
            WHEN COALESCE(cc.saldo, 0) < 0 THEN 'favor'
            ELSE 'al_dia'
        END AS estado_cuenta,
        COALESCE(c.dias_gracia_mora, 7)::INTEGER AS dias_gracia,
        COALESCE(c.porcentaje_mora_mensual, 0)::DECIMAL(5,2) AS porcentaje_mora
    FROM clientes c
    LEFT JOIN cuentas_corrientes cc ON cc.cliente_id = c.id
    WHERE c.activo = TRUE
    AND (cc.saldo IS NOT NULL AND cc.saldo != 0 OR EXISTS (
        SELECT 1 FROM facturas f WHERE f.cliente_id = c.id AND f.estado_pago IN ('pendiente', 'parcial')
    ))
    ORDER BY 
        CASE 
            WHEN COALESCE(cc.saldo, 0) > 0 THEN 1 -- Primero Deudores
            WHEN COALESCE(cc.saldo, 0) < 0 THEN 2 -- Luego Saldo a Favor
            ELSE 3 -- Al final Al día
        END,
        ABS(COALESCE(cc.saldo, 0)) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Función para aplicar saldo a favor a una nueva compra (o deuda existente)
CREATE OR REPLACE FUNCTION fn_aplicar_saldo_favor(
    p_cliente_id UUID,
    p_monto_a_cubrir DECIMAL(12,2),
    p_descripcion TEXT DEFAULT 'Aplicación de saldo a favor',
    p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_cuenta_id UUID;
    v_saldo_actual DECIMAL(12,2);
    v_monto_aplicable DECIMAL(12,2);
    v_nuevo_saldo DECIMAL(12,2);
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_usuario_id, auth.uid());

    -- Obtener cuenta y saldo
    SELECT id, saldo INTO v_cuenta_id, v_saldo_actual
    FROM cuentas_corrientes
    WHERE cliente_id = p_cliente_id;

    IF v_cuenta_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente sin cuenta corriente');
    END IF;

    -- Verificar que tenga saldo a favor (saldo negativo)
    IF v_saldo_actual >= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El cliente no tiene saldo a favor');
    END IF;

    -- Calcular cuánto se puede aplicar (el mínimo entre lo que se necesita y lo que se tiene a favor)
    -- v_saldo_actual es negativo (ej: -500). Saldo disponible es ABS(-500) = 500.
    v_monto_aplicable := LEAST(p_monto_a_cubrir, ABS(v_saldo_actual));

    IF v_monto_aplicable <= 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'Monto aplicable inválido');
    END IF;

    -- Actualizar saldo (sumar el monto aplicado, acercándose a 0 o volviéndose positivo)
    -- Ej: Saldo -500, aplicamos 200. Nuevo saldo = -500 + 200 = -300.
    -- Ej: Saldo -500, aplicamos 600 (compra). Nuevo saldo = -500 + 600 = 100 (deuda).
    -- La función asume que "aplicar saldo" significa USAR ese crédito.
    -- El movimiento "cargo" aumenta el saldo (lo hace más positivo).
    
    UPDATE cuentas_corrientes
    SET saldo = saldo + v_monto_aplicable,
        updated_at = NOW()
    WHERE id = v_cuenta_id;

    -- Registrar movimiento
    INSERT INTO cuentas_movimientos (
        cuenta_corriente_id,
        tipo,
        monto,
        descripcion,
        metodo_pago,
        origen_tipo,
        usuario_id
    ) VALUES (
        v_cuenta_id,
        'cargo', -- Es un cargo porque "consume" el saldo a favor (aumenta el valor numérico en BD)
        v_monto_aplicable,
        p_descripcion,
        'saldo_favor',
        'ajuste',
        v_user_id
    );

    RETURN jsonb_build_object(
        'success', true, 
        'monto_aplicado', v_monto_aplicable,
        'nuevo_saldo', v_saldo_actual + v_monto_aplicable
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_obtener_todas_cuentas_corrientes IS 'Obtiene clientes con cuentas corrientes clasificadas por estado (deudor, favor, al_dia)';
COMMENT ON FUNCTION fn_aplicar_saldo_favor IS 'Utiliza el saldo a favor (negativo) para cubrir un monto, generando un movimiento de cargo';

COMMIT;
