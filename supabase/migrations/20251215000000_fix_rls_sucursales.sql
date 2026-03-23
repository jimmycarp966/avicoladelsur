-- ===========================================
-- FIX: Corregir políticas RLS de sucursales
-- Fecha: 2025-12-15
-- Problema: Las políticas usan jwt.claims.role que no está configurado
-- Solución: Usar auth.uid() y consultar tabla usuarios directamente
-- ===========================================

-- Función helper para obtener rol del usuario
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT rol FROM usuarios WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función helper para obtener sucursal_id del usuario
CREATE OR REPLACE FUNCTION get_user_sucursal_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT e.sucursal_id 
    FROM rrhh_empleados e 
    WHERE e.usuario_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar políticas antiguas de sucursales
DROP POLICY IF EXISTS "admin_full_access_sucursales" ON sucursales;
DROP POLICY IF EXISTS "sucursal_access_own" ON sucursales;
DROP POLICY IF EXISTS "Admin full access on sucursales" ON sucursales;

-- Crear nuevas políticas para sucursales
CREATE POLICY "admin_full_access_sucursales" ON sucursales
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_own" ON sucursales
  FOR SELECT
  USING (
    id = get_user_sucursal_id() OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de sucursal_settings
DROP POLICY IF EXISTS "admin_full_access_sucursal_settings" ON sucursal_settings;
DROP POLICY IF EXISTS "sucursal_access_settings" ON sucursal_settings;

CREATE POLICY "admin_full_access_sucursal_settings" ON sucursal_settings
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_settings" ON sucursal_settings
  FOR SELECT
  USING (
    sucursal_id = get_user_sucursal_id() OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de alertas_stock
DROP POLICY IF EXISTS "admin_full_access_alertas_stock" ON alertas_stock;
DROP POLICY IF EXISTS "sucursal_access_alertas" ON alertas_stock;

CREATE POLICY "admin_full_access_alertas_stock" ON alertas_stock
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_alertas" ON alertas_stock
  FOR SELECT
  USING (
    sucursal_id = get_user_sucursal_id() OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de lotes
DROP POLICY IF EXISTS "admin_full_access_lotes" ON lotes;
DROP POLICY IF EXISTS "sucursal_access_lotes" ON lotes;

CREATE POLICY "admin_full_access_lotes" ON lotes
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_lotes" ON lotes
  FOR SELECT
  USING (
    (sucursal_id IS NOT NULL AND sucursal_id = get_user_sucursal_id()) OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de pedidos
DROP POLICY IF EXISTS "admin_full_access_pedidos" ON pedidos;
DROP POLICY IF EXISTS "sucursal_access_pedidos" ON pedidos;

CREATE POLICY "admin_full_access_pedidos" ON pedidos
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_pedidos" ON pedidos
  FOR SELECT
  USING (
    (sucursal_id IS NOT NULL AND sucursal_id = get_user_sucursal_id()) OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de tesoreria_cajas
DROP POLICY IF EXISTS "admin_full_access_tesoreria_cajas" ON tesoreria_cajas;
DROP POLICY IF EXISTS "sucursal_access_cajas" ON tesoreria_cajas;

CREATE POLICY "admin_full_access_tesoreria_cajas" ON tesoreria_cajas
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_cajas" ON tesoreria_cajas
  FOR SELECT
  USING (
    (sucursal_id IS NOT NULL AND sucursal_id = get_user_sucursal_id()) OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de tesoreria_movimientos
DROP POLICY IF EXISTS "admin_full_access_tesoreria_movimientos" ON tesoreria_movimientos;
DROP POLICY IF EXISTS "sucursal_access_movimientos" ON tesoreria_movimientos;

CREATE POLICY "admin_full_access_tesoreria_movimientos" ON tesoreria_movimientos
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_movimientos" ON tesoreria_movimientos
  FOR SELECT
  USING (
    (sucursal_id IS NOT NULL AND sucursal_id = get_user_sucursal_id()) OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de stock_reservations
DROP POLICY IF EXISTS "admin_full_access_stock_reservations" ON stock_reservations;
DROP POLICY IF EXISTS "sucursal_access_reservations" ON stock_reservations;

CREATE POLICY "admin_full_access_stock_reservations" ON stock_reservations
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_reservations" ON stock_reservations
  FOR SELECT
  USING (
    (sucursal_id IS NOT NULL AND sucursal_id = get_user_sucursal_id()) OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de transferencias_stock
DROP POLICY IF EXISTS "admin_full_access_transferencias" ON transferencias_stock;
DROP POLICY IF EXISTS "sucursal_access_transferencias" ON transferencias_stock;

CREATE POLICY "admin_full_access_transferencias" ON transferencias_stock
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_transferencias" ON transferencias_stock
  FOR SELECT
  USING (
    sucursal_origen_id = get_user_sucursal_id() OR
    sucursal_destino_id = get_user_sucursal_id() OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de transferencia_items
DROP POLICY IF EXISTS "admin_full_access_transferencia_items" ON transferencia_items;
DROP POLICY IF EXISTS "sucursal_access_items" ON transferencia_items;

CREATE POLICY "admin_full_access_transferencia_items" ON transferencia_items
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_items" ON transferencia_items
  FOR SELECT
  USING (
    transferencia_id IN (
      SELECT id FROM transferencias_stock
      WHERE sucursal_origen_id = get_user_sucursal_id()
         OR sucursal_destino_id = get_user_sucursal_id()
         OR get_user_role() = 'admin'
    )
  );

-- Comentarios
COMMENT ON FUNCTION get_user_role() IS 'Obtiene el rol del usuario autenticado desde la tabla usuarios';
COMMENT ON FUNCTION get_user_sucursal_id() IS 'Obtiene la sucursal_id del usuario autenticado desde rrhh_empleados';

