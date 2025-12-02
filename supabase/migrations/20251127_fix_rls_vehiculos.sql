-- ===========================================
-- FIX RLS: Políticas para tabla vehiculos
-- Fecha: 2025-11-27
-- ===========================================
-- Problema: RLS habilitado pero sin políticas = bloquea todo
-- Solución: Crear políticas para admins y otros roles según necesidad

-- Eliminar políticas existentes si las hay (por si acaso)
DROP POLICY IF EXISTS "admin_vehiculos_full" ON vehiculos;
DROP POLICY IF EXISTS "admin_vehiculos_read" ON vehiculos;
DROP POLICY IF EXISTS "admin_vehiculos_insert" ON vehiculos;
DROP POLICY IF EXISTS "admin_vehiculos_update" ON vehiculos;
DROP POLICY IF EXISTS "admin_vehiculos_delete" ON vehiculos;
DROP POLICY IF EXISTS "logistica_vehiculos_read" ON vehiculos;
DROP POLICY IF EXISTS "repartidor_vehiculos_read" ON vehiculos;

-- Política 1: Admin tiene acceso completo (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "admin_vehiculos_full"
    ON vehiculos FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol = 'admin' 
            AND activo = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol = 'admin' 
            AND activo = true
        )
    );

-- Política 2: Almacenista puede leer vehículos (para asignación de rutas)
CREATE POLICY "logistica_vehiculos_read"
    ON vehiculos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- Política 3: Repartidor puede leer vehículos asignados
CREATE POLICY "repartidor_vehiculos_read"
    ON vehiculos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'repartidor') 
            AND activo = true
        )
    );

-- Comentarios
COMMENT ON POLICY "admin_vehiculos_full" ON vehiculos IS 'Admin tiene acceso completo (CRUD) a vehículos';
COMMENT ON POLICY "logistica_vehiculos_read" ON vehiculos IS 'Almacenista puede leer vehículos para asignación de rutas';
COMMENT ON POLICY "repartidor_vehiculos_read" ON vehiculos IS 'Repartidor puede leer vehículos (incluido el asignado)';




























