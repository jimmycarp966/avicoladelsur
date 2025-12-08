-- ===========================================
-- FIX: Permitir que usuarios lean su propio registro en rrhh_empleados
-- Fecha: 2025-01-01
-- Problema: Los usuarios no-admin no pueden leer su propio registro para obtener sucursal_id
-- Solución: Agregar política que permite SELECT del propio registro
-- ===========================================

-- Eliminar política antigua si existe
DROP POLICY IF EXISTS "Admin full access on rrhh_empleados" ON rrhh_empleados;
DROP POLICY IF EXISTS "admin_rrhh_empleados_full" ON rrhh_empleados;

-- Crear política para admins (acceso completo)
CREATE POLICY "admin_rrhh_empleados_full" 
    ON rrhh_empleados FOR ALL 
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

-- Crear política para usuarios no-admin (solo pueden leer su propio registro)
CREATE POLICY "empleados_read_own" 
    ON rrhh_empleados FOR SELECT 
    USING (
        usuario_id = auth.uid()
    );

-- Comentarios
COMMENT ON POLICY "admin_rrhh_empleados_full" ON rrhh_empleados IS 'Admins tienen acceso completo a todos los empleados';
COMMENT ON POLICY "empleados_read_own" ON rrhh_empleados IS 'Usuarios no-admin pueden leer solo su propio registro para obtener sucursal_id';

