-- Asegurar que la extensión uuid-ossp existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla notificaciones si no existe
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'info',
    leida BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actualizar tabla notificaciones existente si ya fue creada (Defensivo)
DO $$
BEGIN
    -- Agregar columnas faltantes si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notificaciones' AND column_name = 'usuario_id') THEN
        ALTER TABLE notificaciones ADD COLUMN usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notificaciones' AND column_name = 'titulo') THEN
        ALTER TABLE notificaciones ADD COLUMN titulo TEXT DEFAULT 'Notificación';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notificaciones' AND column_name = 'mensaje') THEN
        ALTER TABLE notificaciones ADD COLUMN mensaje TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notificaciones' AND column_name = 'tipo') THEN
        ALTER TABLE notificaciones ADD COLUMN tipo VARCHAR(50) DEFAULT 'info';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notificaciones' AND column_name = 'leida') THEN
        ALTER TABLE notificaciones ADD COLUMN leida BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notificaciones' AND column_name = 'metadata') THEN
        ALTER TABLE notificaciones ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida ON notificaciones(usuario_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida) WHERE leida = false;
CREATE INDEX IF NOT EXISTS idx_notificaciones_created_at ON notificaciones(created_at DESC);

-- RLS para notificaciones
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios ven sus propias notificaciones y las globales (usuario_id IS NULL)
DROP POLICY IF EXISTS "users_read_own_notifications" ON notificaciones;
CREATE POLICY "users_read_own_notifications" ON notificaciones
    FOR SELECT
    USING (
        usuario_id = (SELECT auth.uid()) OR
        usuario_id IS NULL
    );

-- Política: Solo admins pueden insertar notificaciones
DROP POLICY IF EXISTS "admins_insert_notifications" ON notificaciones;
CREATE POLICY "admins_insert_notifications" ON notificaciones
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE id = (SELECT auth.uid())
            AND rol = 'admin'
        )
    );

-- Política: Usuarios pueden actualizar sus propias notificaciones (marcar como leída)
DROP POLICY IF EXISTS "users_update_own_notifications" ON notificaciones;
CREATE POLICY "users_update_own_notifications" ON notificaciones
    FOR UPDATE
    USING (
        usuario_id = (SELECT auth.uid()) OR
        usuario_id IS NULL
    );

-- Comentarios
COMMENT ON TABLE notificaciones IS 'Notificaciones del sistema para usuarios del panel administrativo';
COMMENT ON COLUMN notificaciones.leida IS 'Indica si la notificación fue leída por el usuario';
COMMENT ON COLUMN notificaciones.metadata IS 'Datos adicionales en formato JSON para referencias o acciones';
