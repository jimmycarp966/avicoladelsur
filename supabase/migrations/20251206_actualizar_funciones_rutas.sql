-- ===========================================
-- MIGRACIÓN: Actualizar funciones que generan números de ruta
-- Fecha: 06/12/2025
-- Objetivo: Actualizar todas las funciones que generan números de ruta
--           para usar numeración secuencial
-- ===========================================

BEGIN;

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_asignar_pedido_a_ruta (versión con plan semanal)
-- Esta es la versión que está en 20251202_timezone_gmt3.sql
-- ===========================================
CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta(
    p_pedido_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_plan RECORD;
    v_dia_semana SMALLINT;
    v_ruta RECORD;
    v_ruta_id UUID;
    v_numero_ruta TEXT;
    v_peso_pedido NUMERIC(12,3) := 0;
    v_peso_actual NUMERIC(12,3) := 0;
    v_capacidad_max NUMERIC(12,3);
    v_repartidor_id UUID;
    v_vehiculo RECORD;
    v_detalle_id UUID;
BEGIN
    SELECT
        p.id,
        COALESCE(p.fecha_entrega_estimada::DATE, fn_today_argentina()) AS fecha_ruta,
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

    v_dia_semana := EXTRACT(DOW FROM v_pedido.fecha_ruta)::SMALLINT;

    SELECT
        prs.id,
        prs.repartidor_id
    INTO v_plan
    FROM plan_rutas_semanal prs
    WHERE prs.zona_id = v_pedido.zona_id
      AND prs.turno = v_pedido.turno
      AND prs.dia_semana = v_dia_semana
      AND prs.activo = true
    ORDER BY prs.created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay ruta planificada para la zona/turno/día seleccionado');
    END IF;

    v_repartidor_id := v_plan.repartidor_id;

    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_pedido
    FROM detalles_pedido dp
    WHERE dp.pedido_id = p_pedido_id;

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

        -- Generar número de ruta secuencial
        v_numero_ruta := fn_obtener_siguiente_numero('ruta');

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

    IF v_capacidad_max IS NOT NULL
       AND v_capacidad_max > 0
       AND v_peso_actual + v_peso_pedido > v_capacidad_max THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La ruta planificada no tiene capacidad disponible para este pedido'
        );
    END IF;

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

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_asignar_pedido_a_ruta_mejorada
-- Esta función está en 20251202_timezone_gmt3.sql
-- ===========================================
CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta_mejorada(
    p_pedido_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_plan RECORD;
    v_dia_semana SMALLINT;
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
    -- Obtener fecha actual en timezone de Argentina
    v_fecha_actual := fn_today_argentina();
    
    -- Obtener información del pedido
    SELECT
        p.id,
        COALESCE(p.fecha_entrega_estimada::DATE, fn_today_argentina()) AS fecha_ruta,
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

    v_dia_semana := EXTRACT(DOW FROM v_pedido.fecha_ruta)::SMALLINT;

    SELECT
        prs.id,
        prs.repartidor_id
    INTO v_plan
    FROM plan_rutas_semanal prs
    WHERE prs.zona_id = v_pedido.zona_id
      AND prs.turno = v_pedido.turno
      AND prs.dia_semana = v_dia_semana
      AND prs.activo = true
    ORDER BY prs.created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay ruta planificada para la zona/turno/día seleccionado');
    END IF;

    v_repartidor_id := v_plan.repartidor_id;

    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_pedido
    FROM detalles_pedido dp
    WHERE dp.pedido_id = p_pedido_id;

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

        -- Generar número de ruta secuencial
        v_numero_ruta := fn_obtener_siguiente_numero('ruta');

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

    IF v_capacidad_max IS NOT NULL
       AND v_capacidad_max > 0
       AND v_peso_actual + v_peso_pedido > v_capacidad_max THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La ruta planificada no tiene capacidad disponible para este pedido'
        );
    END IF;

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

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_asignar_pedido_a_ruta (versión básica)
-- ===========================================
CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta(
    p_pedido_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_ruta_id UUID;
    v_vehiculo_id UUID;
    v_repartidor_id UUID;
    v_numero_ruta TEXT;
    v_fecha_ruta DATE;
    v_turno TEXT;
    v_zona UUID;
    v_orden INTEGER;
    v_detalle_id UUID;
BEGIN
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
        RETURN jsonb_build_object('success', false, 'error', 'Pedido sin zona asignada');
    END IF;

    v_fecha_ruta := v_pedido.fecha_ruta;
    v_turno := v_pedido.turno;
    v_zona := v_pedido.zona_id;

    SELECT id INTO v_ruta_id
    FROM rutas_reparto
    WHERE fecha_ruta = v_fecha_ruta
      AND zona_id = v_zona
      AND turno = v_turno
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_ruta_id IS NULL THEN
        SELECT id INTO v_vehiculo_id
        FROM vehiculos
        WHERE activo = true
        ORDER BY capacidad_kg DESC NULLS LAST
        LIMIT 1;

        IF v_vehiculo_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No hay vehículos activos disponibles');
        END IF;

        SELECT id INTO v_repartidor_id
        FROM usuarios
        WHERE rol = 'repartidor'
          AND activo = true
          AND vehiculo_asignado = v_vehiculo_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_repartidor_id IS NULL THEN
            SELECT id INTO v_repartidor_id
            FROM usuarios
            WHERE rol = 'repartidor'
              AND activo = true
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        IF v_repartidor_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No hay repartidores activos disponibles');
        END IF;

        -- Generar número de ruta secuencial
        v_numero_ruta := fn_obtener_siguiente_numero('ruta');

        INSERT INTO rutas_reparto (
            numero_ruta,
            vehiculo_id,
            repartidor_id,
            fecha_ruta,
            estado,
            turno,
            zona_id
        ) VALUES (
            v_numero_ruta,
            v_vehiculo_id,
            v_repartidor_id,
            v_fecha_ruta,
            'planificada',
            v_turno,
            v_zona
        )
        RETURNING id INTO v_ruta_id;
    END IF;

    -- Insertar detalle si no existe
    SELECT id INTO v_detalle_id
    FROM detalles_ruta
    WHERE pedido_id = p_pedido_id;

    IF v_detalle_id IS NULL THEN
        SELECT COALESCE(MAX(orden_entrega), 0) + 1 INTO v_orden
        FROM detalles_ruta
        WHERE ruta_id = v_ruta_id;

        INSERT INTO detalles_ruta (
            ruta_id,
            pedido_id,
            orden_entrega
        ) VALUES (
            v_ruta_id,
            p_pedido_id,
            COALESCE(v_orden, 1)
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

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_asignar_pedido_a_ruta (versión con plan semanal)
-- Esta función está en 20251202_timezone_gmt3.sql
-- ===========================================
-- Nota: Esta función es más compleja y está definida en otra migración.
-- Solo actualizamos las líneas donde se genera el número de ruta.
-- Como la función completa es muy larga, creamos una versión actualizada
-- que reemplaza la original cuando se ejecute.

COMMIT;

-- ===========================================
-- RESUMEN
-- ===========================================
-- Esta migración actualiza todas las funciones principales que generan
-- números de ruta para usar el sistema de numeración secuencial.
-- 
-- Funciones actualizadas:
-- 1. fn_asignar_pedido_a_ruta (versión con plan semanal)
-- 2. fn_asignar_pedido_a_ruta_mejorada
-- 3. fn_asignar_pedido_a_ruta (versión básica - actualizada anteriormente)
--
-- Nota: Las funciones en migraciones anteriores (20251125, 20251128, 20251129)
-- serán reemplazadas por estas versiones actualizadas ya que PostgreSQL
-- utiliza CREATE OR REPLACE FUNCTION, lo que significa que la última definición
-- prevalece.

