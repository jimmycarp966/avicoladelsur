-- ===========================================
-- MIGRACIÓN: Crear tabla cuentas_corrientes y función fn_asegurar_cuenta_corriente
-- Fecha: 01/12/2025
-- Objetivo: Asegurar que la tabla cuentas_corrientes exista y la función fn_asegurar_cuenta_corriente funcione
--           Esta función es usada por múltiples funciones SQL y acciones del sistema
-- ===========================================

BEGIN;

-- Crear tabla cuentas_corrientes si no existe
CREATE TABLE IF NOT EXISTS cuentas_corrientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID UNIQUE NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
  limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear tabla cuentas_movimientos si no existe (depende de cuentas_corrientes)
CREATE TABLE IF NOT EXISTS cuentas_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_corriente_id UUID NOT NULL REFERENCES cuentas_corrientes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cargo', 'pago')),
  monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
  descripcion TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origen_tipo VARCHAR(50),
  origen_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_cuentas_corrientes_cliente_id ON cuentas_corrientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_movimientos_cuenta_id ON cuentas_movimientos(cuenta_corriente_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_movimientos_origen ON cuentas_movimientos(origen_tipo, origen_id);

-- Crear o reemplazar la función fn_asegurar_cuenta_corriente
-- Esta función busca si existe una cuenta corriente para un cliente,
-- y si no existe, la crea con saldo 0 y el límite de crédito del cliente
CREATE OR REPLACE FUNCTION fn_asegurar_cuenta_corriente(p_cliente_id UUID)
RETURNS UUID AS $$
DECLARE
  v_cuenta_id UUID;
  v_limite NUMERIC;
BEGIN

  -- Buscar cuenta corriente existente
  SELECT id INTO v_cuenta_id 
  FROM cuentas_corrientes 
  WHERE cliente_id = p_cliente_id;
  
  -- Si existe, retornar el ID
  IF v_cuenta_id IS NOT NULL THEN
    RETURN v_cuenta_id;
  END IF;

  -- Si no existe, obtener el límite de crédito del cliente
  SELECT COALESCE(limite_credito, 0) INTO v_limite 
  FROM clientes 
  WHERE id = p_cliente_id;

  -- Si el cliente no existe, lanzar error
  IF v_limite IS NULL THEN
    RAISE EXCEPTION 'Cliente con ID % no encontrado', p_cliente_id;
  END IF;

  -- Crear nueva cuenta corriente
  INSERT INTO cuentas_corrientes (cliente_id, saldo, limite_credito)
  VALUES (p_cliente_id, 0, v_limite)
  RETURNING id INTO v_cuenta_id;

  RETURN v_cuenta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agregar comentario para documentar
COMMENT ON FUNCTION fn_asegurar_cuenta_corriente(UUID) IS 
'Busca una cuenta corriente para un cliente. Si no existe, la crea con saldo 0 y el límite de crédito del cliente. Retorna el UUID de la cuenta corriente.';

COMMIT;

