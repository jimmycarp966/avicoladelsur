-- ===========================================
-- ASIGNACIÓN DE USUARIOS A EMPLEADOS
-- Fecha: 2025-12-16
-- ===========================================
-- Asigna usuarios de Supabase Auth a empleados existentes
-- para que puedan acceder a las funcionalidades de sucursal

DO $$
DECLARE
    v_empleado_record RECORD;
    v_usuario_id UUID;
BEGIN
    -- Buscar empleados sin usuario_id asignado
    FOR v_empleado_record IN
        SELECT id, nombre, apellido, legajo
        FROM rrhh_empleados
        WHERE usuario_id IS NULL
        AND activo = true
        ORDER BY fecha_ingreso DESC
        LIMIT 5  -- Solo asignar a los primeros 5 para evitar conflictos
    LOOP
        -- Aquí puedes mapear empleados específicos a usuarios conocidos
        -- Por ejemplo, si sabes el email de un usuario, puedes buscarlo

        -- Para este ejemplo, vamos a asignar el primer empleado encontrado
        -- al primer usuario admin que encontremos (ajusta según tus necesidades)

        -- Buscar un usuario admin existente
        SELECT id INTO v_usuario_id
        FROM usuarios
        WHERE email LIKE '%admin%' OR email LIKE '%test%'
        LIMIT 1;

        IF v_usuario_id IS NOT NULL THEN
            -- Asignar el usuario al empleado
            UPDATE rrhh_empleados
            SET usuario_id = v_usuario_id
            WHERE id = v_empleado_record.id;

            RAISE NOTICE 'Asignado usuario % al empleado % % (Legajo: %)',
                v_usuario_id, v_empleado_record.nombre, v_empleado_record.apellido, v_empleado_record.legajo;
        ELSE
            RAISE NOTICE 'No se encontró usuario para asignar al empleado % % (Legajo: %)',
                v_empleado_record.nombre, v_empleado_record.apellido, v_empleado_record.legajo;
        END IF;
    END LOOP;

    RAISE NOTICE 'Proceso de asignación completado.';
END $$;




