-- ===========================================
-- MIGRACIÓN: Corregir pagos cuenta corriente para acreditar en caja
-- Fecha: 21/12/2025
-- Descripción: Los pagos de cuenta corriente deben crear ingreso en Caja Central
-- ===========================================

BEGIN;

-- Recrear función para registrar pago a cuenta corriente CON movimiento de caja
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
    v_caja_central_id UUID;
    v_movimiento_caja_id UUID;
    v_cliente_nombre TEXT;
    v_user_id UUID;
BEGIN
    -- Obtener usuario actual
    v_user_id := COALESCE(p_usuario_id, auth.uid());
    
    -- Verificar que el cliente existe
    SELECT nombre INTO v_cliente_nombre
    FROM clientes WHERE id = p_cliente_id;
    
    IF v_cliente_nombre IS NULL THEN
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
    
    -- ========================================
    -- CREAR INGRESO EN CAJA CENTRAL
    -- ========================================
    
    -- Obtener caja central activa (Casa Central)
    SELECT c.id INTO v_caja_central_id
    FROM cajas c
    JOIN sucursales s ON s.id = c.sucursal_id
    WHERE s.nombre ILIKE '%casa central%'
      AND c.estado = 'abierta'
    ORDER BY c.fecha_apertura DESC
    LIMIT 1;
    
    -- Si no hay caja abierta de Casa Central, buscar cualquier caja central activa
    IF v_caja_central_id IS NULL THEN
        SELECT c.id INTO v_caja_central_id
        FROM cajas c
        JOIN sucursales s ON s.id = c.sucursal_id
        WHERE s.es_central = TRUE
          AND c.estado = 'abierta'
        ORDER BY c.fecha_apertura DESC
        LIMIT 1;
    END IF;
    
    -- Si encontramos caja, crear movimiento de ingreso
    IF v_caja_central_id IS NOT NULL THEN
        INSERT INTO movimientos_caja (
            caja_id,
            tipo,
            monto,
            descripcion,
            metodo_pago,
            referencia_tipo,
            referencia_id,
            usuario_id
        ) VALUES (
            v_caja_central_id,
            'ingreso',
            p_monto,
            'Pago cuenta corriente - ' || v_cliente_nombre,
            p_metodo_pago,
            'pago_cuenta_corriente',
            v_movimiento_id,
            v_user_id
        )
        RETURNING id INTO v_movimiento_caja_id;
        
        -- Actualizar saldo de la caja
        UPDATE cajas
        SET saldo_actual = COALESCE(saldo_actual, 0) + p_monto,
            updated_at = NOW()
        WHERE id = v_caja_central_id;
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
        'movimiento_caja_id', v_movimiento_caja_id,
        'caja_id', v_caja_central_id,
        'saldo_anterior', v_saldo_anterior,
        'saldo_nuevo', v_saldo_nuevo,
        'monto_registrado', p_monto,
        'cliente_nombre', v_cliente_nombre,
        'acreditado_en_caja', v_caja_central_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_registrar_pago_cuenta_corriente IS 
'Registra un pago a la cuenta corriente de un cliente.
- Actualiza saldo de cuenta corriente
- Registra movimiento en cuentas_movimientos
- CREA INGRESO EN CAJA CENTRAL
- Opcionalmente actualiza factura asociada
- Desbloquea cliente si corresponde';

COMMIT;
