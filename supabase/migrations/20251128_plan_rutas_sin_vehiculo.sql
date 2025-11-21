-- ===========================================
-- Planificación semanal sin vehículo fijo
-- Fecha: 2025-11-28
-- ===========================================

-- Permitir que los planes no definan vehículo y eliminar capacidad manual
ALTER TABLE plan_rutas_semanal
    ALTER COLUMN vehiculo_id DROP NOT NULL;

UPDATE plan_rutas_semanal
SET vehiculo_id = NULL;

ALTER TABLE plan_rutas_semanal
    DROP COLUMN IF EXISTS max_peso_kg;

-- Función de asignación automática sin dependencia de vehículo planificado
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

