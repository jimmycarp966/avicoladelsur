-- ===========================================
-- MIGRACIÓN: Permitir que usuarios de sucursal vean listas de precios activas
-- Fecha: 11/12/2024
-- Descripción: Actualizar políticas RLS para permitir que usuarios con rol 'sucursal' o 'cajero' puedan ver listas activas
-- ===========================================

BEGIN;

-- Actualizar política de SELECT para listas_precios para incluir roles de sucursal
DROP POLICY IF EXISTS "listas_precios_select_policy" ON listas_precios;

CREATE POLICY "listas_precios_select_policy"
ON listas_precios FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol IN ('admin', 'vendedor', 'sucursal', 'cajero', 'encargado_sucursal')
        AND activo = true
    )
);

-- Actualizar política de SELECT para precios_productos para incluir roles de sucursal
DROP POLICY IF EXISTS "precios_productos_select_policy" ON precios_productos;

CREATE POLICY "precios_productos_select_policy"
ON precios_productos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol IN ('admin', 'vendedor', 'sucursal', 'cajero', 'encargado_sucursal')
        AND activo = true
    )
    AND activo = true  -- Solo permitir ver precios activos
);

COMMIT;

