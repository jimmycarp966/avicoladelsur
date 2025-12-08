-- ===========================================
-- SINCRONIZACIÓN AUTOMÁTICA: auth.users <-> usuarios
-- Fecha: 2025-01-01
-- Descripción: Trigger que sincroniza automáticamente usuarios entre auth.users y tabla usuarios
-- ===========================================

-- Función para sincronizar usuario cuando se crea en auth.users
CREATE OR REPLACE FUNCTION sync_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar o actualizar en tabla usuarios cuando se crea/actualiza en auth.users
    INSERT INTO usuarios (
        id,
        email,
        nombre,
        apellido,
        rol,
        activo,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'apellido',
        COALESCE(NEW.raw_user_meta_data->>'rol', 'vendedor'),
        COALESCE((NEW.raw_user_meta_data->>'activo')::boolean, true),
        NEW.created_at,
        NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        nombre = COALESCE(EXCLUDED.nombre, usuarios.nombre),
        apellido = COALESCE(EXCLUDED.apellido, usuarios.apellido),
        updated_at = EXCLUDED.updated_at;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta cuando se crea un usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_from_auth();

-- Trigger que se ejecuta cuando se actualiza un usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION sync_user_from_auth();

-- Función para verificar si un usuario tiene cuenta de autenticación
CREATE OR REPLACE FUNCTION usuario_tiene_auth(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users WHERE id = p_usuario_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON FUNCTION sync_user_from_auth() IS 'Sincroniza automáticamente usuarios desde auth.users a la tabla usuarios';
COMMENT ON FUNCTION usuario_tiene_auth(UUID) IS 'Verifica si un usuario tiene cuenta de autenticación en auth.users';

