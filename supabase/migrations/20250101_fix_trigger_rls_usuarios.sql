-- ===========================================
-- FIX: Permitir que trigger sincronice usuarios sin RLS
-- Fecha: 2025-01-01
-- Descripción: Crea política RLS que permite al trigger insertar usuarios
-- ===========================================

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "trigger_sync_user_from_auth" ON usuarios;
DROP POLICY IF EXISTS "trigger_sync_user_from_auth_update" ON usuarios;

-- Política especial para permitir que el trigger sync_user_from_auth() inserte usuarios
-- Permite inserción cuando el ID existe en auth.users (el usuario que se está creando)
CREATE POLICY "trigger_sync_user_from_auth" ON usuarios
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = usuarios.id
        )
    );

-- También necesitamos permitir actualización desde el trigger
CREATE POLICY "trigger_sync_user_from_auth_update" ON usuarios
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = usuarios.id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = usuarios.id
        )
    );

