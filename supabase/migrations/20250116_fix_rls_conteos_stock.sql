-- ===========================================
-- FIX: Corregir políticas RLS de conteos_stock
-- Fecha: 2025-01-16
-- Problema: Las políticas usan jwt.claims.sucursal_id que no está configurado
-- Solución: Usar funciones helper get_user_role() y get_user_sucursal_id()
-- ===========================================

-- Actualizar políticas de conteos_stock
DROP POLICY IF EXISTS "admin_full_access_conteos" ON conteos_stock;
DROP POLICY IF EXISTS "sucursal_access_conteos" ON conteos_stock;

CREATE POLICY "admin_full_access_conteos" ON conteos_stock
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_conteos" ON conteos_stock
  FOR SELECT
  USING (
    sucursal_id = get_user_sucursal_id() OR
    get_user_role() = 'admin'
  );

-- Actualizar políticas de conteo_stock_items
DROP POLICY IF EXISTS "admin_full_access_conteo_items" ON conteo_stock_items;
DROP POLICY IF EXISTS "sucursal_access_conteo_items" ON conteo_stock_items;

CREATE POLICY "admin_full_access_conteo_items" ON conteo_stock_items
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_conteo_items" ON conteo_stock_items
  FOR SELECT
  USING (
    conteo_id IN (
      SELECT id FROM conteos_stock
      WHERE sucursal_id = get_user_sucursal_id()
         OR get_user_role() = 'admin'
    )
  );

-- Actualizar políticas de ajustes_stock
DROP POLICY IF EXISTS "admin_full_access_ajustes" ON ajustes_stock;
DROP POLICY IF EXISTS "sucursal_access_ajustes" ON ajustes_stock;

CREATE POLICY "admin_full_access_ajustes" ON ajustes_stock
  FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY "sucursal_access_ajustes" ON ajustes_stock
  FOR SELECT
  USING (
    sucursal_id = get_user_sucursal_id() OR
    get_user_role() = 'admin'
  );

-- ===========================================
-- FUNCIÓN RPC: Obtener conteo de stock completo
-- ===========================================
-- Esta función bypasea RLS y valida permisos manualmente
CREATE OR REPLACE FUNCTION fn_obtener_conteo_stock(p_conteo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_conteo RECORD;
    v_usuario_sucursal UUID;
    v_usuario_rol TEXT;
    v_items JSONB;
    v_resultado JSONB;
BEGIN
    -- Obtener rol y sucursal del usuario
    v_usuario_rol := get_user_role();
    v_usuario_sucursal := get_user_sucursal_id();

    -- Obtener conteo
    SELECT * INTO v_conteo
    FROM conteos_stock
    WHERE id = p_conteo_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Conteo no encontrado'
        );
    END IF;

    -- Validar permisos
    IF v_usuario_rol != 'admin' AND v_conteo.sucursal_id != v_usuario_sucursal THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No tienes permisos para ver este conteo'
        );
    END IF;

    -- Obtener items del conteo
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', csi.id,
            'producto_id', csi.producto_id,
            'producto_nombre', p.nombre,
            'cantidad_teorica', csi.cantidad_teorica,
            'cantidad_contada', csi.cantidad_contada,
            'diferencia', csi.diferencia,
            'costo_unitario_promedio', csi.costo_unitario_promedio,
            'valor_diferencia', csi.valor_diferencia,
            'motivo_diferencia', csi.motivo_diferencia,
            'observaciones', csi.observaciones
        ) ORDER BY p.nombre
    ) INTO v_items
    FROM conteo_stock_items csi
    INNER JOIN productos p ON p.id = csi.producto_id
    WHERE csi.conteo_id = p_conteo_id;

    -- Construir resultado
    v_resultado := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'id', v_conteo.id,
            'sucursal_id', v_conteo.sucursal_id,
            'fecha_conteo', v_conteo.fecha_conteo,
            'estado', v_conteo.estado,
            'realizado_por', v_conteo.realizado_por,
            'aprobado_por', v_conteo.aprobado_por,
            'fecha_aprobacion', v_conteo.fecha_aprobacion,
            'observaciones', v_conteo.observaciones,
            'total_diferencias', v_conteo.total_diferencias,
            'total_merma_valor', v_conteo.total_merma_valor,
            'items', COALESCE(v_items, '[]'::jsonb)
        )
    );

    RETURN v_resultado;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

