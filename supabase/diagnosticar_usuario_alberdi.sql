-- ===========================================
-- DIAGNÓSTICO Y CORRECCIÓN: Usuario alberdi@avicoladelsur.com
-- Fecha: 2025-01-01
-- Descripción: Verifica y corrige la asignación del usuario a la sucursal Alberdi
-- ===========================================

-- PASO 1: Verificar si el usuario existe en auth.users
-- ===========================================
SELECT 
    'Usuario en auth.users:' as tipo,
    id,
    email,
    created_at
FROM auth.users
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 2: Verificar si el usuario existe en tabla usuarios
-- ===========================================
SELECT 
    'Usuario en tabla usuarios:' as tipo,
    id,
    email,
    nombre,
    apellido,
    rol,
    activo
FROM usuarios
WHERE email = 'alberdi@avicoladelsur.com';

-- PASO 3: Verificar si existe un empleado vinculado
-- ===========================================
SELECT 
    'Empleado vinculado:' as tipo,
    e.id as empleado_id,
    e.usuario_id,
    e.sucursal_id,
    e.legajo,
    e.activo,
    s.nombre as sucursal_nombre,
    s.active as sucursal_activa
FROM rrhh_empleados e
LEFT JOIN sucursales s ON e.sucursal_id = s.id
WHERE e.usuario_id IN (
    SELECT id FROM usuarios WHERE email = 'alberdi@avicoladelsur.com'
);

-- PASO 4: Verificar sucursal "Alberdi"
-- ===========================================
SELECT 
    'Sucursal Alberdi:' as tipo,
    id,
    nombre,
    direccion,
    active
FROM sucursales
WHERE nombre ILIKE '%alberdi%'
ORDER BY nombre;

-- PASO 5: CORRECCIÓN AUTOMÁTICA
-- ===========================================
-- Este bloque corrige automáticamente la asignación
DO $$
DECLARE
    v_usuario_id UUID;
    v_sucursal_id UUID;
    v_empleado_id UUID;
    v_legajo TEXT;
BEGIN
    -- Obtener ID del usuario
    SELECT id INTO v_usuario_id
    FROM usuarios
    WHERE email = 'alberdi@avicoladelsur.com';
    
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario alberdi@avicoladelsur.com no encontrado en tabla usuarios. Ejecuta primero sincronizar_usuarios_existentes.sql';
    END IF;
    
    -- Obtener ID de la sucursal Alberdi
    SELECT id INTO v_sucursal_id
    FROM sucursales
    WHERE nombre ILIKE '%alberdi%'
    AND active = true
    ORDER BY nombre
    LIMIT 1;
    
    IF v_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Sucursal Alberdi no encontrada o no está activa';
    END IF;
    
    -- Verificar si ya existe un empleado con este usuario_id
    SELECT id INTO v_empleado_id
    FROM rrhh_empleados
    WHERE usuario_id = v_usuario_id;
    
    IF v_empleado_id IS NOT NULL THEN
        -- Actualizar el empleado existente con la sucursal correcta
        UPDATE rrhh_empleados
        SET 
            sucursal_id = v_sucursal_id,
            activo = true,
            updated_at = NOW()
        WHERE id = v_empleado_id;
        
        RAISE NOTICE 'Empleado existente actualizado: ID %, Sucursal asignada: %', v_empleado_id, v_sucursal_id;
    ELSE
        -- Crear un nuevo empleado para este usuario
        -- Generar legajo automático
        SELECT COALESCE(MAX(CAST(SUBSTRING(legajo FROM 4) AS INTEGER)), 0) + 1 INTO v_legajo
        FROM rrhh_empleados
        WHERE legajo ~ '^EMP[0-9]+$';
        
        v_legajo := 'EMP' || LPAD(v_legajo::TEXT, 3, '0');
        
        -- Insertar nuevo empleado
        INSERT INTO rrhh_empleados (
            usuario_id,
            sucursal_id,
            legajo,
            fecha_ingreso,
            activo,
            created_at,
            updated_at
        )
        VALUES (
            v_usuario_id,
            v_sucursal_id,
            v_legajo,
            CURRENT_DATE,
            true,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_empleado_id;
        
        RAISE NOTICE 'Nuevo empleado creado: ID %, Legajo: %, Sucursal: %', v_empleado_id, v_legajo, v_sucursal_id;
    END IF;
    
    -- Verificación final
    SELECT 
        e.id,
        e.usuario_id,
        e.sucursal_id,
        e.legajo,
        s.nombre as sucursal_nombre
    INTO v_empleado_id, v_usuario_id, v_sucursal_id, v_legajo, v_legajo
    FROM rrhh_empleados e
    JOIN sucursales s ON e.sucursal_id = s.id
    WHERE e.usuario_id = v_usuario_id;
    
    RAISE NOTICE '✅ CORRECCIÓN COMPLETADA: Usuario alberdi@avicoladelsur.com asignado a sucursal Alberdi';
END $$;

-- PASO 6: Verificación final
-- ===========================================
SELECT 
    'VERIFICACIÓN FINAL:' as tipo,
    u.email,
    u.nombre,
    u.rol,
    e.legajo,
    s.nombre as sucursal_nombre,
    s.active as sucursal_activa,
    e.activo as empleado_activo
FROM usuarios u
LEFT JOIN rrhh_empleados e ON u.id = e.usuario_id
LEFT JOIN sucursales s ON e.sucursal_id = s.id
WHERE u.email = 'alberdi@avicoladelsur.com';

