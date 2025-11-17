-- =====================================================
-- CORREGIR POLÍTICAS RLS PARA TABLA USUARIOS
-- =====================================================

-- Este script crea las políticas necesarias para que los usuarios
-- puedan leer sus propios datos después de autenticarse

-- OPCIÓN 1: Crear políticas RLS apropiadas (RECOMENDADO)
-- =====================================================

-- Permitir que los usuarios autenticados lean sus propios datos
CREATE POLICY "users_read_own_data" ON usuarios 
FOR SELECT 
USING (auth.uid() = id);

-- Permitir que los admins lean todos los usuarios
CREATE POLICY "admins_read_all_users" ON usuarios 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

-- Permitir que los admins actualicen usuarios
CREATE POLICY "admins_update_users" ON usuarios 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

-- Permitir que los admins inserten usuarios
CREATE POLICY "admins_insert_users" ON usuarios 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

-- Permitir que los admins eliminen usuarios
CREATE POLICY "admins_delete_users" ON usuarios 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

-- Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'usuarios';

-- =====================================================
-- OPCIÓN 2: Desactivar RLS temporalmente (SOLO DESARROLLO)
-- =====================================================
-- Si prefieres desactivar RLS por ahora para desarrollo rápido:
-- ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Reactiva RLS antes de producción:
-- ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

