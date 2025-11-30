-- Agregar tabla de notificaciones si no existe (de la migración anterior)
-- Esta migración actualiza la estructura de notificaciones para incluir todo lo necesario

-- Actualizar tabla notificaciones existente si ya fue creada
DO $$
BEGIN
    -- Agregar columnas faltantes si no existen
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
COMMENT ON COLUMN notificaciones.leida IS 'Indica si la notificación fue leída por el usuario';
COMMENT ON COLUMN notificaciones.metadata IS 'Datos adicionales en formato JSON para referencias o acciones';
