-- ===========================================
-- MIGRACIÓN: Eliminar dependencia del Plan Semanal
-- Fecha: 19/12/2025
-- Objetivo: Simplificar el flujo de asignación de pedidos a rutas
--           eliminando la necesidad de configurar planes semanales.
-- 
-- Cambios:
-- 1. Redefine fn_asignar_pedido_a_ruta para funcionar sin plan semanal
-- 2. Asigna vehículos y repartidores automáticamente
-- 3. Mantiene la tabla plan_rutas_semanal por compatibilidad pero ya no es requerida
-- ===========================================

BEGIN;

-- ===========================================
-- NUEVA VERSIÓN: fn_asignar_pedido_a_ruta
-- Ya NO requiere plan semanal previo
-- ===========================================
CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta(
    p_pedido_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pedido RECORD;
    v_ruta_id UUID;
    v_vehiculo_id UUID;
    v_vehiculo_capacidad NUMERIC(12,3);
    v_repartidor_id UUID;
    v_numero_ruta TEXT;
    v_fecha_ruta DATE;
    v_turno TEXT;
    v_zona_id UUID;
    v_orden INTEGER;
    v_detalle_id UUID;
    v_peso_pedido NUMERIC(12,3) := 0;
    v_peso_actual NUMERIC(12,3) := 0;
BEGIN
    -- Obtener información del pedido
    SELECT
        p.id,
        COALESCE(p.fecha_entrega_estimada::DATE, fn_today_argentina()) AS fecha_ruta,
        COALESCE(p.turno, 'mañana') AS turno,
        p.zona_id,
        p.estado
    INTO v_pedido
    FROM pedidos p
    WHERE p.id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
    END IF;

    -- Validar estado del pedido
    IF v_pedido.estado NOT IN ('preparando', 'enviado') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden enviar a ruta pedidos en estado preparando o enviado');
    END IF;

    IF v_pedido.zona_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El pedido no tiene zona asignada');
    END IF;

    v_fecha_ruta := v_pedido.fecha_ruta;
    v_turno := v_pedido.turno;
    v_zona_id := v_pedido.zona_id;

    -- Calcular peso total del pedido
    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_pedido
    FROM detalles_pedido dp
    WHERE dp.pedido_id = p_pedido_id;

    -- Buscar ruta existente para la misma fecha/zona/turno
    SELECT rr.id, rr.vehiculo_id, v.capacidad_kg
    INTO v_ruta_id, v_vehiculo_id, v_vehiculo_capacidad
    FROM rutas_reparto rr
    LEFT JOIN vehiculos v ON v.id = rr.vehiculo_id
    WHERE rr.fecha_ruta = v_fecha_ruta
      AND rr.zona_id = v_zona_id
      AND rr.turno = v_turno
      AND rr.estado IN ('planificada', 'en_curso')
    ORDER BY rr.created_at ASC
    LIMIT 1;

    -- Si existe ruta, verificar capacidad
    IF v_ruta_id IS NOT NULL THEN
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

        -- Verificar si hay capacidad (solo si el vehículo tiene capacidad definida)
        IF v_vehiculo_capacidad IS NOT NULL 
           AND v_vehiculo_capacidad > 0 
           AND v_peso_actual + v_peso_pedido > v_vehiculo_capacidad THEN
            -- No hay capacidad, crear nueva ruta
            v_ruta_id := NULL;
        END IF;
    END IF;

    -- Si no hay ruta existente con capacidad, crear una nueva
    IF v_ruta_id IS NULL THEN
        -- Buscar vehículo activo con capacidad suficiente
        SELECT id, capacidad_kg
        INTO v_vehiculo_id, v_vehiculo_capacidad
        FROM vehiculos
        WHERE activo = true
          AND capacidad_kg IS NOT NULL
          AND capacidad_kg >= GREATEST(v_peso_pedido, 0)
        ORDER BY capacidad_kg ASC
        LIMIT 1;

        -- Si no hay vehículo con capacidad exacta, usar el de mayor capacidad
        IF v_vehiculo_id IS NULL THEN
            SELECT id, capacidad_kg
            INTO v_vehiculo_id, v_vehiculo_capacidad
            FROM vehiculos
            WHERE activo = true
            ORDER BY capacidad_kg DESC NULLS LAST
            LIMIT 1;
        END IF;

        IF v_vehiculo_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No hay vehículos activos disponibles');
        END IF;

        -- Buscar repartidor asignado a ese vehículo primero
        SELECT id
        INTO v_repartidor_id
        FROM usuarios
        WHERE rol = 'repartidor'
          AND activo = true
          AND vehiculo_asignado = v_vehiculo_id
        ORDER BY created_at ASC
        LIMIT 1;

        -- Si no hay repartidor asignado al vehículo, buscar cualquier repartidor activo
        IF v_repartidor_id IS NULL THEN
            SELECT id
            INTO v_repartidor_id
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

        -- Crear la ruta
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
            v_zona_id
        )
        RETURNING id INTO v_ruta_id;
    END IF;

    -- Verificar si el pedido ya está en la ruta
    SELECT id INTO v_detalle_id
    FROM detalles_ruta
    WHERE pedido_id = p_pedido_id;

    -- Si no existe, insertar el detalle
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

    -- Actualizar estado del pedido a 'enviado'
    UPDATE pedidos
    SET estado = 'enviado',
        updated_at = NOW()
    WHERE id = p_pedido_id
      AND estado = 'preparando';

    RETURN jsonb_build_object(
        'success', true,
        'ruta_id', v_ruta_id,
        'detalle_ruta_id', v_detalle_id,
        'message', 'Pedido asignado a ruta exitosamente'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_asignar_pedido_a_ruta IS 
'Asigna un pedido a una ruta de reparto. NO requiere plan semanal previo.
Crea automáticamente la ruta si no existe, asignando vehículo y repartidor disponibles.
La lógica es:
1. Busca ruta existente para la misma fecha/zona/turno con capacidad disponible
2. Si no hay, crea una nueva ruta con vehículo y repartidor automáticos
3. Agrega el pedido a la ruta y actualiza su estado a "enviado"';

-- ===========================================
-- También actualizar fn_asignar_pedido_a_ruta_mejorada para consistencia
-- ===========================================
CREATE OR REPLACE FUNCTION fn_asignar_pedido_a_ruta_mejorada(
    p_pedido_id UUID
) RETURNS JSONB AS $$
BEGIN
    -- Esta función ahora es un alias de fn_asignar_pedido_a_ruta
    RETURN fn_asignar_pedido_a_ruta(p_pedido_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_asignar_pedido_a_ruta_mejorada IS 
'Alias de fn_asignar_pedido_a_ruta para compatibilidad con código existente.';

COMMIT;

-- ===========================================
-- RESUMEN DE CAMBIOS
-- ===========================================
-- Esta migración simplifica el sistema de rutas:
--
-- ANTES:
-- - Requería configurar plan_rutas_semanal para cada zona/día/turno
-- - Error "No hay ruta planificada" si no existía el plan
-- - Flujo: Crear Plan Semanal → Presupuesto → Pedido → Ruta
--
-- AHORA:
-- - NO requiere plan semanal previo
-- - Asigna vehículo/repartidor automáticamente
-- - Reutiliza rutas existentes con capacidad disponible
-- - Flujo simplificado: Presupuesto → Pedido → Ruta (automático)
--
-- La tabla plan_rutas_semanal se mantiene por compatibilidad pero ya no se consulta.
