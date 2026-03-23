-- ===========================================
-- MIGRACIÓN: Corregir Políticas RLS de Listas de Precios
-- Fecha: 03/12/2025
-- ===========================================

BEGIN;

-- ===========================================
-- CORRECCIÓN DE POLÍTICAS RLS
-- ===========================================

-- Eliminar TODAS las políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Admins pueden ver todas las listas" ON listas_precios;
DROP POLICY IF EXISTS "Vendedores pueden ver listas activas" ON listas_precios;
DROP POLICY IF EXISTS "Usuarios pueden ver listas" ON listas_precios;
DROP POLICY IF EXISTS "Solo admins pueden modificar listas" ON listas_precios;

DROP POLICY IF EXISTS "Admins pueden ver todos los precios" ON precios_productos;
DROP POLICY IF EXISTS "Vendedores pueden ver precios de listas activas" ON precios_productos;
DROP POLICY IF EXISTS "Usuarios pueden ver precios" ON precios_productos;
DROP POLICY IF EXISTS "Solo admins pueden modificar precios" ON precios_productos;

DROP POLICY IF EXISTS "Admins pueden ver todas las asignaciones" ON clientes_listas_precios;
DROP POLICY IF EXISTS "Vendedores pueden ver asignaciones de clientes" ON clientes_listas_precios;
DROP POLICY IF EXISTS "Usuarios pueden ver asignaciones" ON clientes_listas_precios;
DROP POLICY IF EXISTS "Solo admins pueden modificar asignaciones" ON clientes_listas_precios;

-- Nueva política simplificada para listas_precios - SELECT
CREATE POLICY "listas_precios_select_policy"
ON listas_precios FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol IN ('admin', 'vendedor')
    )
);

-- Nueva política para listas_precios - ALL (solo admins)
CREATE POLICY "listas_precios_all_policy"
ON listas_precios FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- Nueva política simplificada para precios_productos - SELECT
CREATE POLICY "precios_productos_select_policy"
ON precios_productos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol IN ('admin', 'vendedor')
    )
);

-- Nueva política para precios_productos - ALL (solo admins)
CREATE POLICY "precios_productos_all_policy"
ON precios_productos FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- Nueva política simplificada para clientes_listas_precios - SELECT
CREATE POLICY "clientes_listas_precios_select_policy"
ON clientes_listas_precios FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol IN ('admin', 'vendedor')
    )
);

-- Nueva política para clientes_listas_precios - ALL (solo admins)
CREATE POLICY "clientes_listas_precios_all_policy"
ON clientes_listas_precios FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

COMMIT;
