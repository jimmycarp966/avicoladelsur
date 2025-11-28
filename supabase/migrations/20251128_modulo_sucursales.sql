-- Migración: Módulo de Sucursales
-- Fecha: 2025-11-28
-- Descripción: Agrega soporte completo para sucursales con gestión de inventario, ventas y tesorería por sucursal

-- Tabla sucursales ya existe del módulo RRHH
-- Agregar columnas faltantes para el módulo de sucursales
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Renombrar 'activo' a 'active' si existe (compatibilidad)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'activo') THEN
        ALTER TABLE sucursales RENAME COLUMN activo TO active;
    END IF;
END $$;

-- Configuración por sucursal (umbrales de stock bajo)
CREATE TABLE sucursal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id uuid UNIQUE REFERENCES sucursales(id) ON DELETE CASCADE,
  low_stock_threshold_default numeric DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- Alertas de stock bajo
CREATE TABLE alertas_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id uuid REFERENCES sucursales(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES productos(id) ON DELETE CASCADE,
  cantidad_actual numeric NOT NULL,
  umbral numeric NOT NULL,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_transito', 'resuelto')),
  created_at timestamptz DEFAULT now()
);

-- Índices para optimización
CREATE INDEX ON alertas_stock(sucursal_id, estado);
CREATE INDEX ON alertas_stock(producto_id);
CREATE INDEX ON alertas_stock(created_at DESC);

-- Agregar sucursal_id a tablas existentes
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE stock_reservations ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE tesoreria_cajas ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE tesoreria_movimientos ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES sucursales(id);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS is_central_catalog boolean DEFAULT true;

-- Actualizar productos existentes como catálogo central
UPDATE productos SET is_central_catalog = true WHERE is_central_catalog IS NULL;

-- Políticas RLS para sucursales (actualizar existentes)
DROP POLICY IF EXISTS "Admin full access on sucursales" ON sucursales;
DROP POLICY IF EXISTS "admin_full_access_sucursales" ON sucursales;
DROP POLICY IF EXISTS "sucursal_access_own" ON sucursales;

-- Admin ve todo
CREATE POLICY "admin_full_access_sucursales" ON sucursales
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

-- Sucursales ven su propia información
CREATE POLICY "sucursal_access_own" ON sucursales
  USING ( id = (current_setting('jwt.claims.sucursal_id', true))::uuid );

-- Políticas RLS para sucursal_settings
ALTER TABLE sucursal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_sucursal_settings" ON sucursal_settings
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

CREATE POLICY "sucursal_access_settings" ON sucursal_settings
  USING ( sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::uuid );

-- Políticas RLS para alertas_stock
ALTER TABLE alertas_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_alertas_stock" ON alertas_stock
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

CREATE POLICY "sucursal_access_alertas" ON alertas_stock
  USING ( sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::uuid );

-- Políticas RLS para lotes (actualizar existente)
DROP POLICY IF EXISTS "admin_full_access" ON lotes;
DROP POLICY IF EXISTS "sucursal_access" ON lotes;

CREATE POLICY "admin_full_access_lotes" ON lotes
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

CREATE POLICY "sucursal_access_lotes" ON lotes
  USING (
    sucursal_id IS NOT NULL AND
    sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::uuid
  );

-- Políticas RLS para pedidos
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_pedidos" ON pedidos
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

CREATE POLICY "sucursal_access_pedidos" ON pedidos
  USING (
    sucursal_id IS NOT NULL AND
    sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::uuid
  );

-- Políticas RLS para tesoreria_cajas
ALTER TABLE tesoreria_cajas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_tesoreria_cajas" ON tesoreria_cajas
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

CREATE POLICY "sucursal_access_cajas" ON tesoreria_cajas
  USING (
    sucursal_id IS NOT NULL AND
    sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::uuid
  );

-- Políticas RLS para tesoreria_movimientos
ALTER TABLE tesoreria_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_tesoreria_movimientos" ON tesoreria_movimientos
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

CREATE POLICY "sucursal_access_movimientos" ON tesoreria_movimientos
  USING (
    sucursal_id IS NOT NULL AND
    sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::uuid
  );

-- Políticas RLS para stock_reservations
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_stock_reservations" ON stock_reservations
  USING ( current_setting('jwt.claims.role', true) = 'admin' );

CREATE POLICY "sucursal_access_reservations" ON stock_reservations
  USING (
    sucursal_id IS NOT NULL AND
    sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::uuid
  );

-- Función RPC para crear movimiento de caja con sucursal
CREATE OR REPLACE FUNCTION fn_crear_movimiento_caja_sucursal(
  p_caja_id uuid,
  p_tipo text,
  p_monto numeric,
  p_descripcion text DEFAULT NULL,
  p_origen_tipo text DEFAULT NULL,
  p_origen_id uuid DEFAULT NULL,
  p_comprobante_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movimiento_id uuid;
  v_saldo_anterior numeric;
  v_saldo_nuevo numeric;
BEGIN
  -- Obtener saldo anterior
  SELECT saldo_actual INTO v_saldo_anterior
  FROM tesoreria_cajas
  WHERE id = p_caja_id;

  -- Calcular nuevo saldo
  IF p_tipo = 'ingreso' THEN
    v_saldo_nuevo := v_saldo_anterior + p_monto;
  ELSIF p_tipo = 'egreso' THEN
    v_saldo_nuevo := v_saldo_anterior - p_monto;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
  END IF;

  -- Crear movimiento
  INSERT INTO tesoreria_movimientos (
    caja_id,
    tipo,
    monto,
    descripcion,
    saldo_anterior,
    saldo_nuevo,
    origen_tipo,
    origen_id,
    comprobante_url
  ) VALUES (
    p_caja_id,
    p_tipo,
    p_monto,
    p_descripcion,
    v_saldo_anterior,
    v_saldo_nuevo,
    p_origen_tipo,
    p_origen_id,
    p_comprobante_url
  ) RETURNING id INTO v_movimiento_id;

  -- Actualizar saldo de caja
  UPDATE tesoreria_cajas
  SET saldo_actual = v_saldo_nuevo,
      updated_at = now()
  WHERE id = p_caja_id;

  RETURN v_movimiento_id;
END;
$$;

-- Función para evaluar stock bajo y crear alertas
CREATE OR REPLACE FUNCTION fn_evaluar_stock_bajo_sucursal(
  p_sucursal_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_umbral numeric;
  v_alerta_count integer := 0;
  v_lote record;
BEGIN
  -- Obtener umbral de la sucursal
  SELECT low_stock_threshold_default INTO v_umbral
  FROM sucursal_settings
  WHERE sucursal_id = p_sucursal_id;

  -- Si no hay configuración, usar umbral por defecto
  IF v_umbral IS NULL THEN
    v_umbral := 5;
  END IF;

  -- Evaluar cada lote de la sucursal
  FOR v_lote IN
    SELECT l.producto_id, SUM(l.cantidad_disponible) as stock_total
    FROM lotes l
    WHERE l.sucursal_id = p_sucursal_id
      AND l.cantidad_disponible > 0
    GROUP BY l.producto_id
    HAVING SUM(l.cantidad_disponible) <= v_umbral
  LOOP
    -- Verificar si ya existe alerta pendiente
    IF NOT EXISTS (
      SELECT 1 FROM alertas_stock
      WHERE sucursal_id = p_sucursal_id
        AND producto_id = v_lote.producto_id
        AND estado = 'pendiente'
    ) THEN
      -- Crear nueva alerta
      INSERT INTO alertas_stock (
        sucursal_id,
        producto_id,
        cantidad_actual,
        umbral,
        estado
      ) VALUES (
        p_sucursal_id,
        v_lote.producto_id,
        v_lote.stock_total,
        v_umbral,
        'pendiente'
      );

      v_alerta_count := v_alerta_count + 1;
    END IF;
  END LOOP;

  RETURN v_alerta_count;
END;
$$;

-- Insertar sucursal central por defecto (si no existe)
INSERT INTO sucursales (id, nombre, direccion, telefono, active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Casa Central', 'Dirección Principal', '381-000-0000', true)
ON CONFLICT (id) DO NOTHING;

-- Configurar settings para casa central
INSERT INTO sucursal_settings (sucursal_id, low_stock_threshold_default) VALUES
('00000000-0000-0000-0000-000000000001', 5);

-- Asignar todos los lotes existentes a casa central (sucursal por defecto)
UPDATE lotes SET sucursal_id = '00000000-0000-0000-0000-000000000001' WHERE sucursal_id IS NULL;

-- Asignar cajas existentes a casa central
UPDATE tesoreria_cajas SET sucursal_id = '00000000-0000-0000-0000-000000000001' WHERE sucursal_id IS NULL;

-- Comentarios para documentación
COMMENT ON TABLE sucursales IS 'Sucursales del sistema con información básica';
COMMENT ON TABLE sucursal_settings IS 'Configuración específica por sucursal (umbrales de stock)';
COMMENT ON TABLE alertas_stock IS 'Alertas automáticas de stock bajo por sucursal';
COMMENT ON FUNCTION fn_crear_movimiento_caja_sucursal IS 'Crea movimientos de caja con soporte para sucursales';
COMMENT ON FUNCTION fn_evaluar_stock_bajo_sucursal IS 'Evalúa stock de sucursal y crea alertas automáticas';
