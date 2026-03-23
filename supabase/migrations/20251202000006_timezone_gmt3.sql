-- ===========================================
-- MIGRACIÓN: Estandarizar timezone GMT-3 en todo el sistema
-- Fecha: 02/12/2025
-- Objetivo: Crear funciones helper para timezone de Argentina y actualizar
--           todas las funciones que usan NOW() o CURRENT_DATE sin timezone
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIONES HELPER PARA TIMEZONE ARGENTINA
-- ===========================================

-- Función que retorna la fecha/hora actual en timezone de Argentina
CREATE OR REPLACE FUNCTION fn_now_argentina()
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN timezone('America/Argentina/Buenos_Aires', NOW());
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función que retorna la fecha de hoy en timezone de Argentina
CREATE OR REPLACE FUNCTION fn_today_argentina()
RETURNS DATE AS $$
BEGIN
    RETURN DATE(timezone('America/Argentina/Buenos_Aires', NOW()));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================
-- ACTUALIZAR FUNCIONES QUE USAN CURRENT_DATE
-- ===========================================

-- Actualizar fn_asignar_pedido_a_ruta (versión en 20251128_plan_rutas_sin_vehiculo.sql)
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

-- Actualizar fn_asignar_pedido_a_ruta (versión mejorada en 20251129_planificacion_semanal_mejorada.sql)
-- Esta función también usa CURRENT_DATE, necesitamos actualizarla
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

-- Actualizar funciones de stock que usan CURRENT_DATE
CREATE OR REPLACE FUNCTION calcular_stock_disponible(p_producto_id UUID)
RETURNS DECIMAL(10,3) AS $$
DECLARE
    v_stock_total DECIMAL(10,3) := 0;
    v_stock_reservado DECIMAL(10,3) := 0;
BEGIN
    -- Stock total de lotes disponibles
    SELECT COALESCE(SUM(l.cantidad_disponible), 0)
    INTO v_stock_total
    FROM lotes l
    WHERE l.producto_id = p_producto_id
        AND l.estado = 'disponible'
        AND l.cantidad_disponible > 0
        AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= fn_today_argentina());
    
    -- Stock reservado en reservas preventivas activas
    SELECT COALESCE(SUM(sr.cantidad), 0)
    INTO v_stock_reservado
    FROM stock_reservations sr
    INNER JOIN lotes l ON sr.lote_id = l.id
    WHERE sr.producto_id = p_producto_id
        AND sr.estado = 'activa'
        AND sr.expires_at > fn_now_argentina()
        AND l.estado = 'disponible';
    
    RETURN GREATEST(v_stock_total - v_stock_reservado, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Actualizar fn_obtener_stock_disponible_real
CREATE OR REPLACE FUNCTION fn_obtener_stock_disponible_real(
    p_producto_id UUID DEFAULT NULL
) RETURNS TABLE (
    producto_id UUID,
    producto_codigo VARCHAR,
    producto_nombre VARCHAR,
    stock_total_lotes DECIMAL(10,3),
    stock_reservado DECIMAL(10,3),
    stock_disponible_real DECIMAL(10,3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS producto_id,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        COALESCE(SUM(l.cantidad_disponible), 0) AS stock_total_lotes,
        COALESCE(SUM(
            CASE 
                WHEN sr.estado = 'activa' 
                AND sr.expires_at > fn_now_argentina() 
                THEN sr.cantidad 
                ELSE 0 
            END
        ), 0) AS stock_reservado,
        calcular_stock_disponible(p.id) AS stock_disponible_real
    FROM productos p
    LEFT JOIN lotes l ON l.producto_id = p.id
        AND l.estado = 'disponible'
        AND l.cantidad_disponible > 0
        AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= fn_today_argentina())
    LEFT JOIN stock_reservations sr ON sr.lote_id = l.id
        AND sr.producto_id = p.id
    WHERE (p_producto_id IS NULL OR p.id = p_producto_id)
        AND p.activo = true
    GROUP BY p.id, p.codigo, p.nombre
    HAVING calcular_stock_disponible(p.id) > 0
    ORDER BY p.codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar fn_registrar_gasto para usar fn_today_argentina() en lugar de CURRENT_DATE
-- Nota: Esta función está definida dinámicamente, así que necesitamos actualizarla
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gastos') THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION fn_registrar_gasto(
      p_sucursal_id UUID,
      p_categoria_id UUID,
      p_monto NUMERIC,
      p_creado_por UUID,
      p_comprobante_url TEXT DEFAULT NULL,
      p_descripcion TEXT DEFAULT NULL,
      p_fecha DATE DEFAULT NULL,
      p_afectar_caja BOOLEAN DEFAULT false,
      p_caja_id UUID DEFAULT NULL,
      p_metodo_pago VARCHAR(30) DEFAULT ''efectivo''
    ) RETURNS JSONB AS $func$
    DECLARE
      v_gasto_id UUID;
      v_movimiento JSONB;
      v_movimiento_id UUID;
      v_metodo_pago_val VARCHAR(30);
      v_fecha_final DATE;
    BEGIN
      v_metodo_pago_val := COALESCE(p_metodo_pago, ''efectivo'');
      v_fecha_final := COALESCE(p_fecha, fn_today_argentina());
      
      -- Insertar gasto (manejar caso donde la columna metodo_pago puede no existir aún)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = ''gastos'' AND column_name = ''metodo_pago''
      ) THEN
        INSERT INTO gastos (
          sucursal_id, categoria_id, monto, comprobante_url,
          descripcion, fecha, creado_por, afecta_caja, caja_id, metodo_pago
        ) VALUES (
          p_sucursal_id, p_categoria_id, p_monto, p_comprobante_url,
          p_descripcion, v_fecha_final, p_creado_por, p_afectar_caja, p_caja_id, v_metodo_pago_val
        ) RETURNING id INTO v_gasto_id;
      ELSE
        -- Si la columna no existe aún, insertar sin ella
        INSERT INTO gastos (
          sucursal_id, categoria_id, monto, comprobante_url,
          descripcion, fecha, creado_por, afecta_caja, caja_id
        ) VALUES (
          p_sucursal_id, p_categoria_id, p_monto, p_comprobante_url,
          p_descripcion, v_fecha_final, p_creado_por, p_afectar_caja, p_caja_id
        ) RETURNING id INTO v_gasto_id;
      END IF;

      -- Si afecta caja y hay caja_id, crear movimiento de caja
      IF p_afectar_caja AND p_caja_id IS NOT NULL THEN
        v_movimiento := fn_crear_movimiento_caja(
          p_caja_id,
          ''egreso'',
          p_monto,
          COALESCE(p_descripcion, ''Registro de gasto''),
          ''gasto'',
          v_gasto_id,
          p_creado_por,
          v_metodo_pago_val
        );

        IF (v_movimiento->>''success'')::BOOLEAN IS TRUE THEN
          v_movimiento_id := (v_movimiento->>''movimiento_id'')::UUID;
          UPDATE gastos
          SET caja_movimiento_id = v_movimiento_id
          WHERE id = v_gasto_id;
        ELSE
          RAISE EXCEPTION ''No se pudo registrar movimiento de caja para gasto %'', v_gasto_id;
        END IF;
      END IF;

      -- Si el método de pago es transferencia, registrar en tesoro (solo si la tabla existe)
      IF v_metodo_pago_val = ''transferencia'' THEN
        -- Verificar que la tabla tesoro existe antes de insertar
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = ''tesoro'') THEN
          INSERT INTO tesoro (
            tipo,
            monto,
            descripcion,
            origen_tipo,
            origen_id
          ) VALUES (
            ''transferencia'',
            -p_monto, -- Negativo porque es un egreso del tesoro
            COALESCE(p_descripcion, ''Gasto pagado por transferencia''),
            ''gasto'',
            v_gasto_id
          );
        END IF;
      END IF;

      RETURN jsonb_build_object(
        ''success'', true,
        ''gasto_id'', v_gasto_id
      );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    ';
  END IF;
END $$;

-- Nota: Las funciones que ya usan timezone('America/Argentina/Buenos_Aires', NOW()) están correctas
-- y no necesitan cambios. Solo se actualizan las que usan NOW() o CURRENT_DATE sin timezone.

COMMIT;

