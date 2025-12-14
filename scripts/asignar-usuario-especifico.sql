-- ===========================================
-- ASIGNACIÓN MANUAL DE USUARIO A EMPLEADO
-- Fecha: 2025-12-16
-- ===========================================

-- Para asignar un usuario específico a un empleado específico,
-- reemplaza los valores abajo y ejecuta este script

DO $$
DECLARE
    v_usuario_email TEXT := 'tu-email@ejemplo.com';  -- ← CAMBIA ESTO por el email del usuario
    v_empleado_legajo TEXT := 'EMP001';             -- ← CAMBIA ESTO por el legajo del empleado
    v_usuario_id UUID;
    v_empleado_id UUID;
BEGIN
    -- Buscar el usuario por email
    SELECT id INTO v_usuario_id
    FROM usuarios
    WHERE email = v_usuario_email;

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario con email % no encontrado', v_usuario_email;
    END IF;

    -- Buscar el empleado por legajo
    SELECT id INTO v_empleado_id
    FROM rrhh_empleados
    WHERE legajo = v_empleado_legajo;

    IF v_empleado_id IS NULL THEN
        RAISE EXCEPTION 'Empleado con legajo % no encontrado', v_empleado_legajo;
    END IF;

    -- Verificar si el empleado ya tiene usuario asignado
    IF EXISTS (SELECT 1 FROM rrhh_empleados WHERE id = v_empleado_id AND usuario_id IS NOT NULL) THEN
        RAISE EXCEPTION 'El empleado % ya tiene un usuario asignado', v_empleado_legajo;
    END IF;

    -- Verificar si el usuario ya está asignado a otro empleado
    IF EXISTS (SELECT 1 FROM rrhh_empleados WHERE usuario_id = v_usuario_id) THEN
        RAISE EXCEPTION 'El usuario % ya está asignado a otro empleado', v_usuario_email;
    END IF;

    -- Asignar el usuario al empleado
    UPDATE rrhh_empleados
    SET usuario_id = v_usuario_id
    WHERE id = v_empleado_id;

    RAISE NOTICE 'Usuario % asignado exitosamente al empleado %', v_usuario_email, v_empleado_legajo;
END $$;




































