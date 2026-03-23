-- ===========================================
-- FUNCION: fn_asignar_pedido_a_ruta
-- Fecha: 2025-11-25
-- Descripción:
--   - Busca o crea ruta diaria (fecha/zona/turno)
--   - Inserta pedido en detalles_ruta si no existe
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

        v_numero_ruta := 'RUT-' || TO_CHAR(v_fecha_ruta, 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

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

