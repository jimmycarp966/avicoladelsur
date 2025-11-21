-- ===========================================
-- Planificación semanal mejorada con historial y validaciones
-- Fecha: 2025-11-29
-- ===========================================

-- Agregar columna semana_inicio a plan_rutas_semanal
ALTER TABLE plan_rutas_semanal
    ADD COLUMN IF NOT EXISTS semana_inicio DATE;

-- Función para calcular el lunes de la semana (inicio de semana)
CREATE OR REPLACE FUNCTION fn_calcular_inicio_semana(fecha DATE)
RETURNS DATE AS $$
BEGIN
    -- PostgreSQL: DOW 0 = domingo, 1 = lunes, ..., 6 = sábado
    -- Necesitamos calcular el lunes de la semana
    -- Si es domingo (0), retrocedemos 6 días, si no retrocedemos (dow - 1) días
    RETURN fecha - (EXTRACT(DOW FROM fecha)::INTEGER + 6) % 7;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Actualizar semana_inicio para registros existentes
UPDATE plan_rutas_semanal
SET semana_inicio = fn_calcular_inicio_semana(created_at::DATE)
WHERE semana_inicio IS NULL;

-- Hacer semana_inicio NOT NULL después de actualizar
ALTER TABLE plan_rutas_semanal
    ALTER COLUMN semana_inicio SET NOT NULL;

-- Eliminar constraint UNIQUE anterior si existe
ALTER TABLE plan_rutas_semanal
    DROP CONSTRAINT IF EXISTS plan_rutas_semanal_zona_id_dia_semana_turno_key;

-- Crear nuevo constraint UNIQUE que incluye semana_inicio
ALTER TABLE plan_rutas_semanal
    ADD CONSTRAINT plan_rutas_semanal_zona_dia_turno_semana_unique
    UNIQUE(zona_id, dia_semana, turno, semana_inicio);

-- Crear índice en semana_inicio para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_plan_rutas_semana_inicio
    ON plan_rutas_semanal(semana_inicio);

-- Función para validar un plan de ruta individual
CREATE OR REPLACE FUNCTION fn_validar_plan_ruta(
    p_zona_id UUID,
    p_dia_semana SMALLINT,
    p_turno VARCHAR(20),
    p_semana_inicio DATE,
    p_repartidor_id UUID DEFAULT NULL,
    p_excluir_plan_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_zona_existe BOOLEAN;
    v_zona_activa BOOLEAN;
    v_repartidor_existe BOOLEAN;
    v_repartidor_activo BOOLEAN;
    v_repartidor_rol BOOLEAN;
    v_conflicto_repartidor BOOLEAN;
    v_errores TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Validar que la zona existe
    SELECT EXISTS(SELECT 1 FROM zonas WHERE id = p_zona_id)
    INTO v_zona_existe;
    
    IF NOT v_zona_existe THEN
        v_errores := array_append(v_errores, 'La zona especificada no existe');
    ELSE
        -- Validar que la zona está activa
        SELECT activo INTO v_zona_activa
        FROM zonas
        WHERE id = p_zona_id;
        
        IF NOT v_zona_activa THEN
            v_errores := array_append(v_errores, 'La zona especificada no está activa');
        END IF;
    END IF;
    
    -- Validar repartidor si está asignado
    IF p_repartidor_id IS NOT NULL THEN
        -- Validar que el repartidor existe
        SELECT EXISTS(SELECT 1 FROM usuarios WHERE id = p_repartidor_id)
        INTO v_repartidor_existe;
        
        IF NOT v_repartidor_existe THEN
            v_errores := array_append(v_errores, 'El repartidor especificado no existe');
        ELSE
            -- Validar que es repartidor y está activo
            SELECT 
                rol = 'repartidor',
                activo
            INTO 
                v_repartidor_rol,
                v_repartidor_activo
            FROM usuarios
            WHERE id = p_repartidor_id;
            
            IF NOT v_repartidor_rol THEN
                v_errores := array_append(v_errores, 'El usuario especificado no es un repartidor');
            END IF;
            
            IF NOT v_repartidor_activo THEN
                v_errores := array_append(v_errores, 'El repartidor especificado no está activo');
            END IF;
            
            -- Validar conflictos de repartidor (mismo repartidor en dos zonas al mismo día/turno)
            SELECT EXISTS(
                SELECT 1 
                FROM plan_rutas_semanal prs
                WHERE prs.repartidor_id = p_repartidor_id
                  AND prs.dia_semana = p_dia_semana
                  AND prs.turno = p_turno
                  AND prs.semana_inicio = p_semana_inicio
                  AND prs.activo = true
                  AND (p_excluir_plan_id IS NULL OR prs.id != p_excluir_plan_id)
            )
            INTO v_conflicto_repartidor;
            
            IF v_conflicto_repartidor THEN
                v_errores := array_append(v_errores, 'El repartidor ya está asignado a otra zona en el mismo día y turno');
            END IF;
        END IF;
    END IF;
    
    -- Retornar resultado
    IF array_length(v_errores, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'errores', v_errores
        );
    ELSE
        RETURN jsonb_build_object('success', true);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar semana completa
CREATE OR REPLACE FUNCTION fn_validar_semana_completa(p_semana_inicio DATE)
RETURNS JSONB AS $$
DECLARE
    v_zona RECORD;
    v_dia_semana SMALLINT;
    v_turno TEXT;
    v_total_zonas INTEGER;
    v_total_planes INTEGER;
    v_planes_faltantes INTEGER;
    v_repartidor RECORD;
    v_conflictos JSONB := '[]'::JSONB;
    v_repartidores_inactivos JSONB := '[]'::JSONB;
    v_errores JSONB := '[]'::JSONB;
    v_advertencias JSONB := '[]'::JSONB;
BEGIN
    -- Contar zonas activas
    SELECT COUNT(*) INTO v_total_zonas
    FROM zonas
    WHERE activo = true;
    
    -- Contar planes activos para esta semana
    SELECT COUNT(*) INTO v_total_planes
    FROM plan_rutas_semanal
    WHERE semana_inicio = p_semana_inicio
      AND activo = true;
    
    -- Calcular planes esperados (zonas activas × 7 días × 2 turnos)
    v_planes_faltantes := (v_total_zonas * 7 * 2) - v_total_planes;
    
    -- Verificar planes faltantes por zona/día/turno
    FOR v_zona IN 
        SELECT id, nombre
        FROM zonas
        WHERE activo = true
    LOOP
        FOR v_dia_semana IN 0..6 LOOP
            FOR v_turno IN SELECT unnest(ARRAY['mañana', 'tarde']) LOOP
                IF NOT EXISTS(
                    SELECT 1
                    FROM plan_rutas_semanal
                    WHERE zona_id = v_zona.id
                      AND dia_semana = v_dia_semana
                      AND turno = v_turno
                      AND semana_inicio = p_semana_inicio
                      AND activo = true
                ) THEN
                    v_advertencias := v_advertencias || jsonb_build_object(
                        'tipo', 'plan_faltante',
                        'zona', v_zona.nombre,
                        'dia', v_dia_semana,
                        'turno', v_turno
                    );
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
    
    -- Verificar conflictos de repartidor (mismo repartidor en dos zonas al mismo día/turno)
    FOR v_repartidor IN
        SELECT DISTINCT repartidor_id
        FROM plan_rutas_semanal
        WHERE semana_inicio = p_semana_inicio
          AND activo = true
          AND repartidor_id IS NOT NULL
    LOOP
        FOR v_dia_semana IN 0..6 LOOP
            FOR v_turno IN SELECT unnest(ARRAY['mañana', 'tarde']) LOOP
                IF (
                    SELECT COUNT(DISTINCT zona_id)
                    FROM plan_rutas_semanal
                    WHERE repartidor_id = v_repartidor.repartidor_id
                      AND dia_semana = v_dia_semana
                      AND turno = v_turno
                      AND semana_inicio = p_semana_inicio
                      AND activo = true
                ) > 1 THEN
                    v_conflictos := v_conflictos || jsonb_build_object(
                        'tipo', 'conflicto_repartidor',
                        'repartidor_id', v_repartidor.repartidor_id,
                        'dia', v_dia_semana,
                        'turno', v_turno
                    );
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
    
    -- Verificar repartidores inactivos
    FOR v_repartidor IN
        SELECT DISTINCT prs.repartidor_id
        FROM plan_rutas_semanal prs
        WHERE prs.semana_inicio = p_semana_inicio
          AND prs.activo = true
          AND prs.repartidor_id IS NOT NULL
          AND EXISTS(
              SELECT 1 FROM usuarios u
              WHERE u.id = prs.repartidor_id
                AND (u.rol != 'repartidor' OR u.activo = false)
          )
    LOOP
        v_repartidores_inactivos := v_repartidores_inactivos || jsonb_build_object(
            'repartidor_id', v_repartidor.repartidor_id
        );
    END LOOP;
    
    -- Construir respuesta
    RETURN jsonb_build_object(
        'success', jsonb_array_length(v_errores) = 0 AND jsonb_array_length(v_conflictos) = 0,
        'total_zonas', v_total_zonas,
        'total_planes', v_total_planes,
        'planes_esperados', v_total_zonas * 7 * 2,
        'planes_faltantes', v_planes_faltantes,
        'advertencias', v_advertencias,
        'conflictos', v_conflictos,
        'repartidores_inactivos', v_repartidores_inactivos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vista para agrupar planes por semana con estadísticas
CREATE OR REPLACE VIEW v_semanas_planificadas AS
SELECT 
    semana_inicio,
    semana_inicio + INTERVAL '6 days' AS semana_fin,
    COUNT(*) AS total_planes,
    COUNT(DISTINCT zona_id) AS zonas_cubiertas,
    COUNT(DISTINCT repartidor_id) FILTER (WHERE repartidor_id IS NOT NULL) AS repartidores_asignados,
    COUNT(DISTINCT dia_semana) AS dias_cubiertos,
    MIN(created_at) AS primera_planificacion,
    MAX(updated_at) AS ultima_actualizacion
FROM plan_rutas_semanal
WHERE activo = true
GROUP BY semana_inicio
ORDER BY semana_inicio DESC;

-- Actualizar función fn_asignar_pedido_a_ruta para usar semana_inicio y validaciones mejoradas
CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta(
    p_pedido_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_plan RECORD;
    v_dia_semana SMALLINT;
    v_semana_inicio DATE;
    v_ruta RECORD;
    v_ruta_id UUID;
    v_numero_ruta TEXT;
    v_peso_pedido NUMERIC(12,3) := 0;
    v_peso_actual NUMERIC(12,3) := 0;
    v_capacidad_max NUMERIC(12,3);
    v_repartidor_id UUID;
    v_vehiculo RECORD;
    v_detalle_id UUID;
    v_fecha_actual DATE;
BEGIN
    -- Obtener fecha actual
    v_fecha_actual := CURRENT_DATE;
    
    -- Obtener información del pedido
    SELECT
        p.id,
        COALESCE(p.fecha_entrega_estimada::DATE, CURRENT_DATE) AS fecha_ruta,
        COALESCE(p.turno, 'mañana') AS turno,
        p.zona_id
    INTO v_pedido
    FROM pedidos p
    WHERE p.id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
    END IF;

    IF v_pedido.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El pedido no tiene zona asignada');
    END IF;
    
    -- Validar que la fecha no sea en el pasado
    IF v_pedido.fecha_ruta < v_fecha_actual THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La fecha de entrega no puede ser en el pasado'
        );
    END IF;
    
    -- Validar que la fecha no sea más de 30 días en el futuro
    IF v_pedido.fecha_ruta > v_fecha_actual + INTERVAL '30 days' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La fecha de entrega no puede ser más de 30 días en el futuro'
        );
    END IF;
    
    -- Calcular día de la semana y semana de inicio
    v_dia_semana := EXTRACT(DOW FROM v_pedido.fecha_ruta)::SMALLINT;
    v_semana_inicio := fn_calcular_inicio_semana(v_pedido.fecha_ruta);

    -- Buscar plan activo para la zona/turno/día/semana
    SELECT
        prs.id,
        prs.repartidor_id
    INTO v_plan
    FROM plan_rutas_semanal prs
    WHERE prs.zona_id = v_pedido.zona_id
      AND prs.turno = v_pedido.turno
      AND prs.dia_semana = v_dia_semana
      AND prs.semana_inicio = v_semana_inicio
      AND prs.activo = true
    ORDER BY prs.created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No hay ruta planificada para la zona/turno/día seleccionado'
        );
    END IF;
    
    -- Validar que el repartidor del plan esté activo (si está asignado)
    IF v_plan.repartidor_id IS NOT NULL THEN
        IF NOT EXISTS(
            SELECT 1
            FROM usuarios u
            WHERE u.id = v_plan.repartidor_id
              AND u.rol = 'repartidor'
              AND u.activo = true
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'El repartidor asignado a la ruta no está activo'
            );
        END IF;
    END IF;
    
    -- Validar que la zona esté activa
    IF NOT EXISTS(
        SELECT 1
        FROM zonas z
        WHERE z.id = v_pedido.zona_id
          AND z.activo = true
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La zona del pedido no está activa'
        );
    END IF;

    v_repartidor_id := v_plan.repartidor_id;

    -- Calcular peso del pedido
    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_pedido
    FROM detalles_pedido dp
    WHERE dp.pedido_id = p_pedido_id;

    -- Buscar o crear ruta
    SELECT
        rr.id,
        rr.vehiculo_id,
        veh.capacidad_kg AS veh_capacidad
    INTO v_ruta
    FROM rutas_reparto rr
    LEFT JOIN vehiculos veh ON veh.id = rr.vehiculo_id
    WHERE rr.fecha_ruta = v_pedido.fecha_ruta
      AND rr.plan_ruta_id = v_plan.id
    ORDER BY rr.created_at ASC
    LIMIT 1;

    IF v_ruta.id IS NULL THEN
        -- Seleccionar vehículo adecuado
        SELECT v.id, v.capacidad_kg
        INTO v_vehiculo
        FROM vehiculos v
        WHERE v.activo = true
          AND v.capacidad_kg IS NOT NULL
          AND v.capacidad_kg >= GREATEST(v_peso_pedido, 0)
        ORDER BY v.capacidad_kg ASC
        LIMIT 1;

        IF v_vehiculo.id IS NULL THEN
            SELECT v.id, v.capacidad_kg
            INTO v_vehiculo
            FROM vehiculos v
            WHERE v.activo = true
            ORDER BY v.capacidad_kg DESC NULLS LAST
            LIMIT 1;
        END IF;

        IF v_vehiculo.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No hay vehículos activos disponibles');
        END IF;

        IF v_repartidor_id IS NULL THEN
            SELECT u.id
            INTO v_repartidor_id
            FROM usuarios u
            WHERE u.rol = 'repartidor'
              AND u.activo = true
            ORDER BY u.created_at ASC
            LIMIT 1;
        END IF;

        IF v_repartidor_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No hay repartidores activos disponibles');
        END IF;

        v_numero_ruta := 'RUT-' || TO_CHAR(v_pedido.fecha_ruta, 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

        INSERT INTO rutas_reparto (
            numero_ruta,
            vehiculo_id,
            repartidor_id,
            fecha_ruta,
            estado,
            turno,
            zona_id,
            plan_ruta_id
        ) VALUES (
            v_numero_ruta,
            v_vehiculo.id,
            v_repartidor_id,
            v_pedido.fecha_ruta,
            'planificada',
            v_pedido.turno,
            v_pedido.zona_id,
            v_plan.id
        )
        RETURNING id INTO v_ruta_id;

        v_capacidad_max := v_vehiculo.capacidad_kg;
    ELSE
        v_ruta_id := v_ruta.id;
        v_capacidad_max := v_ruta.veh_capacidad;
    END IF;

    -- Calcular peso actual de la ruta
    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_actual
    FROM detalles_ruta dr
    JOIN detalles_pedido dp ON dp.pedido_id = dr.pedido_id
    WHERE dr.ruta_id = v_ruta_id;

    -- Validar capacidad
    IF v_capacidad_max IS NOT NULL
       AND v_capacidad_max > 0
       AND v_peso_actual + v_peso_pedido > v_capacidad_max THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La ruta planificada no tiene capacidad disponible para este pedido'
        );
    END IF;

    -- Insertar o actualizar detalle de ruta
    SELECT id INTO v_detalle_id
    FROM detalles_ruta
    WHERE pedido_id = p_pedido_id;

    IF v_detalle_id IS NULL THEN
        INSERT INTO detalles_ruta (
            ruta_id,
            pedido_id,
            orden_entrega
        ) VALUES (
            v_ruta_id,
            p_pedido_id,
            COALESCE(
                (SELECT MAX(orden_entrega) + 1 FROM detalles_ruta WHERE ruta_id = v_ruta_id),
                1
            )
        )
        RETURNING id INTO v_detalle_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'ruta_id', v_ruta_id,
        'detalle_ruta_id', v_detalle_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

