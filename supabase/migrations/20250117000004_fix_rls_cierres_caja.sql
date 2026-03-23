-- ===========================================
-- Fix RLS policies para cierres_caja
-- Fecha: 17/01/2025
-- Objetivo: Permitir INSERT y UPDATE de cierres_caja para admin y vendedor
-- ===========================================

BEGIN;

-- Eliminar políticas existentes si existen
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cierres_caja') THEN
        -- Eliminar políticas antiguas
        DROP POLICY IF EXISTS "admin_cierres_caja_full" ON cierres_caja;
        DROP POLICY IF EXISTS "tesorero_cierres_caja_read" ON cierres_caja;
        DROP POLICY IF EXISTS "vendedor_cierres_caja_insert" ON cierres_caja;
        DROP POLICY IF EXISTS "vendedor_cierres_caja_update" ON cierres_caja;
        DROP POLICY IF EXISTS "sucursal_cierres_caja_access" ON cierres_caja;
        
        -- Política para admin: acceso completo
        CREATE POLICY "admin_cierres_caja_full" ON cierres_caja
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM usuarios 
                WHERE usuarios.id = auth.uid() 
                AND usuarios.rol = 'admin' 
                AND usuarios.activo = true
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM usuarios 
                WHERE usuarios.id = auth.uid() 
                AND usuarios.rol = 'admin' 
                AND usuarios.activo = true
            )
        );

        -- Política para vendedor: puede leer, insertar y actualizar cierres de cajas de su sucursal
        CREATE POLICY "vendedor_cierres_caja_select" ON cierres_caja
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM usuarios 
                WHERE usuarios.id = auth.uid() 
                AND usuarios.rol IN ('admin', 'vendedor') 
                AND usuarios.activo = true
            )
        );

        CREATE POLICY "vendedor_cierres_caja_insert" ON cierres_caja
        FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM usuarios 
                WHERE usuarios.id = auth.uid() 
                AND usuarios.rol IN ('admin', 'vendedor') 
                AND usuarios.activo = true
            )
        );

        CREATE POLICY "vendedor_cierres_caja_update" ON cierres_caja
        FOR UPDATE
        USING (
            EXISTS (
                SELECT 1 FROM usuarios 
                WHERE usuarios.id = auth.uid() 
                AND usuarios.rol IN ('admin', 'vendedor') 
                AND usuarios.activo = true
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM usuarios 
                WHERE usuarios.id = auth.uid() 
                AND usuarios.rol IN ('admin', 'vendedor') 
                AND usuarios.activo = true
            )
        );
    END IF;
END $$;

COMMIT;

