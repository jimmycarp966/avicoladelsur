-- =====================================================
-- VINCULAR USUARIO REPARTIDOR DE AUTENTICACIÓN CON TABLA USUARIOS
-- =====================================================
-- Este script vincula el usuario repartidor de Supabase Auth con la tabla usuarios
-- Ejecuta este script en el SQL Editor de Supabase después de crear el usuario en Auth

-- PASO 1: Temporalmente desactivar RLS para poder insertar
-- =====================================================
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- PASO 2: Insertar o actualizar usuario repartidor con el ID del usuario de autenticación
-- =====================================================
-- Esta query inserta o actualiza el usuario vinculándolo con auth.users
INSERT INTO usuarios (id, email, nombre, apellido, telefono, rol, activo, created_at, updated_at)
SELECT 
    au.id,
    'repartidor@avicoladelsur.com' as email,
    'Carlos' as nombre,
    'García' as apellido,
    NULL as telefono,
    'repartidor' as rol,
    true as activo,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'repartidor@avicoladelsur.com'
ON CONFLICT (email) DO UPDATE 
SET 
    id = EXCLUDED.id,
    nombre = COALESCE(EXCLUDED.nombre, usuarios.nombre),
    apellido = COALESCE(EXCLUDED.apellido, usuarios.apellido),
    rol = EXCLUDED.rol,
    activo = EXCLUDED.activo,
    updated_at = NOW();

-- PASO 3: Asignar vehículo al repartidor (opcional - solo si hay vehículos disponibles)
-- =====================================================
-- Si tienes vehículos en la tabla, asigna uno al repartidor
-- Puedes cambiar la patente o usar el primer vehículo disponible
UPDATE usuarios 
SET vehiculo_asignado = (
    SELECT id FROM vehiculos 
    WHERE activo = true 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE email = 'repartidor@avicoladelsur.com'
  AND vehiculo_asignado IS NULL;

-- PASO 4: Verificar que el usuario se creó correctamente
-- =====================================================
SELECT 
    u.id, 
    u.email, 
    u.nombre, 
    u.apellido, 
    u.rol, 
    u.activo,
    u.vehiculo_asignado,
    v.patente as vehiculo_patente,
    v.marca as vehiculo_marca,
    v.modelo as vehiculo_modelo
FROM usuarios u
LEFT JOIN vehiculos v ON u.vehiculo_asignado = v.id
WHERE u.email = 'repartidor@avicoladelsur.com';

-- PASO 5: Reactivar RLS
-- =====================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- NOTA: Si el script anterior no funciona por limitaciones de permisos,
-- usa esta alternativa manual:
-- =====================================================
-- 1. Primero, obtén el ID del usuario de autenticación ejecutando:
--    SELECT id FROM auth.users WHERE email = 'repartidor@avicoladelsur.com';
--
-- 2. Copia el UUID que te devuelve (ejemplo: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
--
-- 3. Ejecuta este INSERT reemplazando 'TU-UUID-AQUI' con el UUID copiado:
--    INSERT INTO usuarios (id, email, nombre, apellido, rol, activo)
--    VALUES (
--        'TU-UUID-AQUI',
--        'repartidor@avicoladelsur.com',
--        'Carlos',
--        'García',
--        'repartidor',
--        true
--    )
--    ON CONFLICT (email) DO UPDATE 
--    SET id = EXCLUDED.id, rol = 'repartidor', activo = true;
--
-- 4. Para asignar un vehículo (opcional):
--    UPDATE usuarios 
--    SET vehiculo_asignado = (SELECT id FROM vehiculos WHERE patente = 'ABC123' LIMIT 1)
--    WHERE email = 'repartidor@avicoladelsur.com';





