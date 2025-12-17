-- ===========================================
-- MIGRACIÓN: Fix fn_crear_movimiento_caja
-- Fecha: 17/12/2025
-- Objetivo: Asegurar que la función fn_crear_movimiento_caja existe
-- ===========================================

-- Eliminar versiones previas
DROP FUNCTION IF EXISTS fn_crear_movimiento_caja(UUID, VARCHAR, NUMERIC, TEXT, VARCHAR, UUID, UUID, VARCHAR);

-- Crear función con firma correcta
CREATE OR REPLACE FUNCTION fn_crear_movimiento_caja(
  p_caja_id UUID,
  p_tipo VARCHAR,
  p_monto NUMERIC,
  p_descripcion TEXT DEFAULT NULL,
  p_origen_tipo VARCHAR DEFAULT NULL,
  p_origen_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_metodo_pago VARCHAR DEFAULT 'efectivo'
) RETURNS JSONB AS $$
DECLARE
  v_caja RECORD;
  v_movimiento_id UUID;
  v_nuevo_saldo NUMERIC;
  v_user UUID;
BEGIN
  IF p_tipo NOT IN ('ingreso', 'egreso') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
  END IF;

  SELECT * INTO v_caja FROM tesoreria_cajas WHERE id = p_caja_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada';
  END IF;

  v_nuevo_saldo := CASE
    WHEN p_tipo = 'ingreso' THEN v_caja.saldo_actual + p_monto
    ELSE v_caja.saldo_actual - p_monto
  END;

  v_user := COALESCE(
    p_user_id,
    (SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY created_at ASC LIMIT 1)
  );

  INSERT INTO tesoreria_movimientos (
    caja_id, tipo, monto, descripcion, origen_tipo, origen_id, user_id, metodo_pago
  ) VALUES (
    p_caja_id, p_tipo, p_monto, p_descripcion, p_origen_tipo, p_origen_id, v_user, p_metodo_pago
  ) RETURNING id INTO v_movimiento_id;

  UPDATE tesoreria_cajas
  SET saldo_actual = v_nuevo_saldo,
      updated_at = NOW()
  WHERE id = p_caja_id;

  RETURN jsonb_build_object(
    'success', true,
    'movimiento_id', v_movimiento_id,
    'saldo_actual', v_nuevo_saldo
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_crear_movimiento_caja IS 'Crea un movimiento de caja (ingreso o egreso) y actualiza el saldo atómicamente';

-- Permisos
GRANT EXECUTE ON FUNCTION fn_crear_movimiento_caja(UUID, VARCHAR, NUMERIC, TEXT, VARCHAR, UUID, UUID, VARCHAR) TO authenticated;
