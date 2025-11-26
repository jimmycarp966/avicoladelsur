-- ===========================================
-- CORREGIR POLÍTICAS RLS PARA RRHH_EMPLEADOS
-- Fecha: 2025-11-26
-- ===========================================
-- Corrige las políticas RLS para que funcionen correctamente
-- usando la tabla usuarios en lugar de auth.jwt()

-- Eliminar políticas existentes que usan auth.jwt()
DROP POLICY IF EXISTS "Admin full access on rrhh_empleados" ON rrhh_empleados;
DROP POLICY IF EXISTS "admin_rrhh_empleados_full" ON rrhh_empleados;

-- Crear política correcta que verifica el rol desde la tabla usuarios
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

-- También corregir políticas de categorías y sucursales si usan auth.jwt()
DROP POLICY IF EXISTS "Admin full access on rrhh_categorias" ON rrhh_categorias;
CREATE POLICY "admin_rrhh_categorias_full" 
    ON rrhh_categorias FOR ALL 
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

DROP POLICY IF EXISTS "Admin full access on sucursales" ON sucursales;
CREATE POLICY "admin_sucursales_full" 
    ON sucursales FOR ALL 
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

-- Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('rrhh_empleados', 'rrhh_categorias', 'sucursales')
ORDER BY tablename, policyname;

