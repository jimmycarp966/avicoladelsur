-- ===========================================
-- FIX: Permisos RLS para Repartidor en Checklist de Vehículos
-- Ejecutar en Supabase SQL Editor
-- ===========================================

BEGIN;

-- 1. Permitir que repartidores inserten en checklists_vehiculos
DROP POLICY IF EXISTS "repartidor_insert_checklist" ON checklists_vehiculos;
CREATE POLICY "repartidor_insert_checklist" ON checklists_vehiculos
    FOR INSERT
    WITH CHECK (
        auth.uid() = usuario_id
        AND EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'repartidor', 'almacenista')
            AND activo = true
        )
    );

-- 2. Permitir que repartidores lean sus propios checklists
DROP POLICY IF EXISTS "repartidor_select_checklist" ON checklists_vehiculos;
CREATE POLICY "repartidor_select_checklist" ON checklists_vehiculos
    FOR SELECT
    USING (
        usuario_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol = 'admin'
            AND activo = true
        )
    );

-- 3. Permitir que repartidores actualicen sus propios checklists
DROP POLICY IF EXISTS "repartidor_update_checklist" ON checklists_vehiculos;
CREATE POLICY "repartidor_update_checklist" ON checklists_vehiculos
    FOR UPDATE
    USING (
        usuario_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'repartidor')
            AND activo = true
        )
    );

-- 4. IMPORTANTE: Verificar que RLS está habilitado
ALTER TABLE checklists_vehiculos ENABLE ROW LEVEL SECURITY;

-- 5. Verificar que existe la política general de admin
DROP POLICY IF EXISTS "admin_all_checklist" ON checklists_vehiculos;
CREATE POLICY "admin_all_checklist" ON checklists_vehiculos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol = 'admin'
            AND activo = true
        )
    );

COMMIT;

-- Verificar que las políticas se crearon
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'checklists_vehiculos';
