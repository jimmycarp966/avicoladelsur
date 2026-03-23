-- MIGRACIÓN: Función atómica para acreditación de pagos conciliados
-- Fecha: 11/01/2026
-- Descripción: Garantiza que la actualización de saldo de CC, inserción de movimiento 
--              y actualización de caja ocurran en una sola transacción.

CREATE OR REPLACE FUNCTION fn_acreditar_saldo_cliente_v2(
    p_cliente_id UUID,
    p_monto DECIMAL(12,2),
    p_referencia TEXT,
    p_sesion_id UUID,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_cuenta_id UUID;
    v_saldo_actual DECIMAL(12,2);
    v_nuevo_saldo DECIMAL(12,2);
    v_movimiento_id UUID;
    v_caja_id UUID;
    v_caja_saldo DECIMAL(12,2);
BEGIN
    -- 1. Obtener o crear cuenta corriente
    -- Usamos FOR UPDATE para bloquear la fila y evitar que otro proceso modifique el saldo simultáneamente
    SELECT id, saldo INTO v_cuenta_id, v_saldo_actual
    FROM cuentas_corrientes
    WHERE cliente_id = p_cliente_id
    FOR UPDATE;

    IF v_cuenta_id IS NULL THEN
        -- Si no existe, la creamos atómicamente
        INSERT INTO cuentas_corrientes (cliente_id, saldo, limite_credito)
        VALUES (p_cliente_id, 0, 0)
        RETURNING id, saldo INTO v_cuenta_id, v_saldo_actual;
    END IF;

    -- 2. Registrar movimiento en cuenta corriente (abono reduce deuda)
    INSERT INTO cuentas_movimientos (
        cuenta_corriente_id,
        tipo,
        monto,
        fecha,
        descripcion,
        referencia,
        notas
    ) VALUES (
        v_cuenta_id,
        'abono',
        p_monto,
        CURRENT_DATE,
        'Pago conciliado - ' || COALESCE(p_referencia, 'Sin referencia'),
        'CONC-' || LEFT(p_sesion_id::text, 8),
        COALESCE(p_notas, 'Acreditado automáticamente por conciliación bancaria')
    ) RETURNING id INTO v_movimiento_id;

    -- 3. Actualizar saldo de cuenta corriente
    v_nuevo_saldo := v_saldo_actual - p_monto;
    UPDATE cuentas_corrientes
    SET saldo = v_nuevo_saldo,
        updated_at = NOW()
    WHERE id = v_cuenta_id;

    -- 4. Registrar en caja (activa la primera que encuentre)
    SELECT id, saldo INTO v_caja_id, v_caja_saldo
    FROM cajas
    WHERE activa = TRUE
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_caja_id IS NOT NULL THEN
        INSERT INTO movimientos_caja (
            caja_id,
            tipo,
            monto,
            metodo_pago,
            descripcion,
            referencia,
            fecha
        ) VALUES (
            v_caja_id,
            'ingreso',
            p_monto,
            'transferencia',
            'Pago conciliado - Cliente ID: ' || p_cliente_id,
            COALESCE(p_referencia, 'CONC-' || LEFT(p_sesion_id::text, 8)),
            NOW()::text -- El campo fecha en movimientos_caja parece ser TEXT en el código original
        );

        UPDATE cajas
        SET saldo = v_caja_saldo + p_monto,
            updated_at = NOW()
        WHERE id = v_caja_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'movimiento_id', v_movimiento_id,
        'nuevo_saldo', v_nuevo_saldo,
        'caja_id', v_caja_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;
