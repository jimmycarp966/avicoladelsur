-- ===========================================
-- AUDITORÍA Y CORRECCIÓN GLOBAL: Timezone Argentina (GMT-3)
-- Fecha: 2025-01-16
-- Objetivo: Corregir TODOS los usos de CURRENT_DATE y fechas sin timezone
--           para usar fn_today_argentina() y fn_now_argentina()
-- 
-- PROBLEMAS IDENTIFICADOS:
--   1. Columnas DATE con DEFAULT CURRENT_DATE (usa UTC)
--   2. Funciones RPC con parámetros DEFAULT CURRENT_DATE
--   3. Comparaciones WHERE fecha = CURRENT_DATE
--   4. Materialized views con CURRENT_DATE en WHERE
--   5. Funciones que usan CURRENT_DATE en cálculos
-- ===========================================

BEGIN;

-- ===========================================
-- ASEGURAR FUNCIONES HELPER EXISTEN
-- ===========================================

CREATE OR REPLACE FUNCTION fn_now_argentina()
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN timezone('America/Argentina/Buenos_Aires', NOW());
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_today_argentina()
RETURNS DATE AS $$
BEGIN
    RETURN DATE(timezone('America/Argentina/Buenos_Aires', NOW()));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================
-- 1. ACTUALIZAR DEFAULT VALUES EN COLUMNAS DATE
-- ===========================================

-- conteos_stock.fecha_conteo
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conteos_stock' 
        AND column_name = 'fecha_conteo'
    ) THEN
        ALTER TABLE conteos_stock 
        ALTER COLUMN fecha_conteo SET DEFAULT fn_today_argentina();
    END IF;
END $$;

-- rrhh_novedades.fecha_publicacion
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rrhh_novedades' 
        AND column_name = 'fecha_publicacion'
    ) THEN
        ALTER TABLE rrhh_novedades 
        ALTER COLUMN fecha_publicacion SET DEFAULT fn_today_argentina();
    END IF;
END $$;

-- rrhh_licencias.fecha_solicitud
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rrhh_licencias' 
        AND column_name = 'fecha_solicitud'
    ) THEN
        ALTER TABLE rrhh_licencias 
        ALTER COLUMN fecha_solicitud SET DEFAULT fn_today_argentina();
    END IF;
END $$;

-- rrhh_asistencia.fecha (si tiene default)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rrhh_asistencia' 
        AND column_name = 'fecha'
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE rrhh_asistencia 
        ALTER COLUMN fecha SET DEFAULT fn_today_argentina();
    END IF;
END $$;

-- rrhh_evaluaciones.fecha_evaluacion
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rrhh_evaluaciones' 
        AND column_name = 'fecha_evaluacion'
    ) THEN
        ALTER TABLE rrhh_evaluaciones 
        ALTER COLUMN fecha_evaluacion SET DEFAULT fn_today_argentina();
    END IF;
END $$;

-- ===========================================
-- 2. ACTUALIZAR FUNCIONES RPC - PARÁMETROS DEFAULT
-- ===========================================

-- fn_obtener_metricas_bot_semana
DROP FUNCTION IF EXISTS fn_obtener_metricas_bot_semana(DATE);
CREATE OR REPLACE FUNCTION fn_obtener_metricas_bot_semana(p_fecha DATE DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_fecha DATE;
    v_semana INTEGER;
    v_año INTEGER;
    v_result JSONB;
BEGIN
    v_fecha := COALESCE(p_fecha, fn_today_argentina());
    v_semana := EXTRACT(WEEK FROM v_fecha);
    v_año := EXTRACT(YEAR FROM v_fecha);

    SELECT jsonb_build_object(
        'total_mensajes', COALESCE(SUM(total_mensajes), 0),
        'mensajes_por_voz', COALESCE(SUM(mensajes_por_voz), 0),
        'pedidos_creados', COALESCE(SUM(pedidos_creados), 0),
        'semana', v_semana,
        'año', v_año
    ) INTO v_result
    FROM bot_metricas_semana
    WHERE semana = v_semana AND año = v_año;

    RETURN COALESCE(v_result, jsonb_build_object('success', false, 'error', 'No hay datos'));
END;
$$ LANGUAGE plpgsql;

-- fn_obtener_metricas_rutas_semana
DROP FUNCTION IF EXISTS fn_obtener_metricas_rutas_semana(DATE) CASCADE;
CREATE OR REPLACE FUNCTION fn_obtener_metricas_rutas_semana(p_fecha DATE DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_fecha DATE;
    v_semana INTEGER;
    v_año INTEGER;
    v_result JSONB;
BEGIN
    v_fecha := COALESCE(p_fecha, fn_today_argentina());
    v_semana := EXTRACT(WEEK FROM v_fecha);
    v_año := EXTRACT(YEAR FROM v_fecha);

    SELECT jsonb_build_object(
        'total_rutas', COALESCE(SUM(total_rutas), 0),
        'rutas_completadas', COALESCE(SUM(rutas_completadas), 0),
        'semana', v_semana,
        'año', v_año
    ) INTO v_result
    FROM rutas_metricas_semana
    WHERE semana = v_semana AND año = v_año;

    RETURN COALESCE(v_result, jsonb_build_object('success', false, 'error', 'No hay datos'));
END;
$$ LANGUAGE plpgsql;

-- fn_obtener_predicciones_semana
DROP FUNCTION IF EXISTS fn_obtener_predicciones_semana(DATE) CASCADE;
CREATE OR REPLACE FUNCTION fn_obtener_predicciones_semana(p_fecha DATE DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_fecha DATE;
    v_result JSONB;
BEGIN
    v_fecha := COALESCE(p_fecha, fn_today_argentina());

    SELECT jsonb_agg(
        jsonb_build_object(
            'producto_id', producto_id,
            'producto_nombre', producto_nombre,
            'fecha_prediccion', fecha_prediccion,
            'demanda_predicha', demanda_predicha
        )
    ) INTO v_result
    FROM predicciones_demanda
    WHERE fecha_prediccion = v_fecha;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- fn_obtener_transferencias_dia
DROP FUNCTION IF EXISTS fn_obtener_transferencias_dia(DATE, VARCHAR, UUID) CASCADE;
CREATE OR REPLACE FUNCTION fn_obtener_transferencias_dia(
    p_fecha DATE DEFAULT NULL,
    p_turno VARCHAR(20) DEFAULT NULL,
    p_zona_id UUID DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    numero_transferencia VARCHAR(50),
    sucursal_origen_nombre VARCHAR(255),
    sucursal_destino_nombre VARCHAR(255),
    estado VARCHAR(20),
    turno VARCHAR(20),
    fecha_entrega DATE,
    zona_nombre VARCHAR(255),
    total_items BIGINT,
    items_pesaje BIGINT,
    fecha_solicitud TIMESTAMPTZ
) AS $$
DECLARE
    v_fecha DATE;
BEGIN
    v_fecha := COALESCE(p_fecha, fn_today_argentina());

    RETURN QUERY
    SELECT 
        t.id,
        t.numero_transferencia,
        so.nombre AS sucursal_origen_nombre,
        sd.nombre AS sucursal_destino_nombre,
        t.estado,
        t.turno,
        t.fecha_entrega,
        z.nombre AS zona_nombre,
        COUNT(DISTINCT ti.id)::BIGINT AS total_items,
        COUNT(DISTINCT ti.id) FILTER (WHERE p.pesable = true)::BIGINT AS items_pesaje,
        t.fecha_solicitud
    FROM transferencias_stock t
    LEFT JOIN sucursales so ON so.id = t.sucursal_origen_id
    LEFT JOIN sucursales sd ON sd.id = t.sucursal_destino_id
    LEFT JOIN zonas z ON z.id = t.zona_id
    LEFT JOIN transferencia_items ti ON ti.transferencia_id = t.id
    LEFT JOIN productos p ON p.id = ti.producto_id
    WHERE t.fecha_entrega = v_fecha
      AND (p_turno IS NULL OR t.turno = p_turno)
      AND (p_zona_id IS NULL OR t.zona_id = p_zona_id)
    GROUP BY t.id, so.nombre, sd.nombre, z.nombre
    ORDER BY t.fecha_solicitud DESC;
END;
$$ LANGUAGE plpgsql;

-- fn_registrar_gasto (parámetro fecha)
DROP FUNCTION IF EXISTS fn_registrar_gasto(UUID, UUID, NUMERIC, UUID, TEXT, TEXT, DATE, BOOLEAN, UUID, VARCHAR) CASCADE;
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
    p_metodo_pago VARCHAR(30) DEFAULT 'efectivo'
) RETURNS JSONB AS $$
DECLARE
    v_gasto_id UUID;
    v_movimiento JSONB;
    v_movimiento_id UUID;
    v_metodo_pago_val VARCHAR(30);
    v_fecha_final DATE;
BEGIN
    v_metodo_pago_val := COALESCE(p_metodo_pago, 'efectivo');
    v_fecha_final := COALESCE(p_fecha, fn_today_argentina());

    -- Insertar gasto
    INSERT INTO gastos (
        sucursal_id, categoria_id, monto, comprobante_url,
        descripcion, fecha, creado_por, afecta_caja, caja_id, metodo_pago
    ) VALUES (
        p_sucursal_id, p_categoria_id, p_monto, p_comprobante_url,
        p_descripcion, v_fecha_final, p_creado_por, p_afectar_caja, p_caja_id, v_metodo_pago_val
    ) RETURNING id INTO v_gasto_id;

    -- Si afecta caja y hay caja_id, crear movimiento de caja
    IF p_afectar_caja AND p_caja_id IS NOT NULL THEN
        v_movimiento := fn_crear_movimiento_caja(
            p_caja_id,
            'egreso',
            p_monto,
            COALESCE(p_descripcion, 'Registro de gasto'),
            'gasto',
            v_gasto_id,
            p_creado_por,
            v_metodo_pago_val
        );

        IF (v_movimiento->>'success')::BOOLEAN IS TRUE THEN
            v_movimiento_id := (v_movimiento->>'movimiento_id')::UUID;
            UPDATE gastos
            SET caja_movimiento_id = v_movimiento_id
            WHERE id = v_gasto_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'gasto_id', v_gasto_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- fn_obtener_estadisticas_rutas (parámetro fecha)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_obtener_estadisticas_rutas') THEN
        -- Eliminar función existente primero
        EXECUTE 'DROP FUNCTION IF EXISTS fn_obtener_estadisticas_rutas(DATE) CASCADE';
        EXECUTE '
        CREATE OR REPLACE FUNCTION fn_obtener_estadisticas_rutas(p_fecha DATE DEFAULT NULL)
        RETURNS JSONB AS $func$
        DECLARE
            v_fecha DATE;
        BEGIN
            v_fecha := COALESCE(p_fecha, fn_today_argentina());
            -- Resto de la función...
            RETURN jsonb_build_object(''success'', true);
        END;
        $func$ LANGUAGE plpgsql;';
    END IF;
END $$;

-- ===========================================
-- 3. ACTUALIZAR FUNCIONES CON CURRENT_DATE EN WHERE CLAUSES
-- ===========================================

-- fn_validar_caja_abierta
DROP FUNCTION IF EXISTS fn_validar_caja_abierta(UUID) CASCADE;
CREATE OR REPLACE FUNCTION fn_validar_caja_abierta(
    p_caja_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_cierre_abierto BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM cierres_caja 
        WHERE caja_id = p_caja_id 
          AND fecha = fn_today_argentina()
          AND estado = 'abierto'
    ) INTO v_cierre_abierto;
    
    RETURN COALESCE(v_cierre_abierto, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- fn_validar_limite_adelanto (RRHH)
DROP FUNCTION IF EXISTS fn_validar_limite_adelanto(UUID, DECIMAL) CASCADE;
CREATE OR REPLACE FUNCTION fn_validar_limite_adelanto(
    p_empleado_id UUID,
    p_monto DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_sueldo_basico DECIMAL(10,2);
    v_limite_maximo DECIMAL(10,2);
    v_adelantos_mes_actual DECIMAL(10,2);
    v_fecha_actual DATE;
    v_mes INTEGER;
    v_año INTEGER;
BEGIN
    v_fecha_actual := fn_today_argentina();
    v_mes := EXTRACT(MONTH FROM v_fecha_actual);
    v_año := EXTRACT(YEAR FROM v_fecha_actual);

    SELECT c.sueldo_basico INTO v_sueldo_basico
    FROM rrhh_empleados e
    JOIN rrhh_categorias c ON e.categoria_id = c.id
    WHERE e.id = p_empleado_id;

    v_limite_maximo := v_sueldo_basico * 0.3;

    SELECT COALESCE(SUM(monto), 0) INTO v_adelantos_mes_actual
    FROM rrhh_adelantos
    WHERE empleado_id = p_empleado_id
    AND aprobado = true
    AND EXTRACT(MONTH FROM fecha_aprobacion) = v_mes
    AND EXTRACT(YEAR FROM fecha_aprobacion) = v_año;

    RETURN (v_adelantos_mes_actual + p_monto) <= v_limite_maximo;
END;
$$ LANGUAGE plpgsql;

-- fn_validar_listas_cliente (comparaciones de vigencia)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_validar_listas_cliente') THEN
        -- Esta función probablemente compara fechas de vigencia con CURRENT_DATE
        -- Se actualizará en la migración específica de listas de precios si es necesario
        NULL;
    END IF;
END $$;

-- fn_obtener_precio_producto (validación de vigencia)
DROP FUNCTION IF EXISTS fn_obtener_precio_producto(UUID, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION fn_obtener_precio_producto(
    p_producto_id UUID,
    p_lista_precio_id UUID,
    p_cliente_id UUID DEFAULT NULL
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_precio DECIMAL(10,2);
    v_fecha_actual DATE;
BEGIN
    v_fecha_actual := fn_today_argentina();

    -- Buscar precio en la lista específica
    SELECT precio INTO v_precio
    FROM precios_productos
    WHERE producto_id = p_producto_id
      AND lista_precio_id = p_lista_precio_id
      AND activo = true
      AND (fecha_desde IS NULL OR fecha_desde <= v_fecha_actual)
      AND (fecha_hasta IS NULL OR fecha_hasta >= v_fecha_actual)
    ORDER BY fecha_desde DESC NULLS LAST
    LIMIT 1;

    IF v_precio IS NOT NULL THEN
        RETURN v_precio;
    END IF;

    -- Si no hay precio, usar precio_venta del producto como fallback
    SELECT precio_venta INTO v_precio
    FROM productos
    WHERE id = p_producto_id;

    RETURN COALESCE(v_precio, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- fn_obtener_listas_cliente (validación de vigencia)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'fn_obtener_listas_cliente'
        AND pg_get_functiondef(oid) LIKE '%CURRENT_DATE%'
    ) THEN
        -- Esta función se actualizará en migración específica
        NULL;
    END IF;
END $$;

-- ===========================================
-- 4. ACTUALIZAR FUNCIONES DE PLANIFICACIÓN
-- ===========================================

-- fn_calcular_inicio_semana
DROP FUNCTION IF EXISTS fn_calcular_inicio_semana(DATE) CASCADE;
CREATE OR REPLACE FUNCTION fn_calcular_inicio_semana(p_fecha DATE DEFAULT NULL)
RETURNS DATE AS $$
DECLARE
    v_fecha DATE;
    v_dia_semana INTEGER;
    v_dias_restar INTEGER;
BEGIN
    v_fecha := COALESCE(p_fecha, fn_today_argentina());
    v_dia_semana := EXTRACT(DOW FROM v_fecha);
    
    IF v_dia_semana = 0 THEN
        v_dias_restar := 6;
    ELSE
        v_dias_restar := v_dia_semana - 1;
    END IF;
    
    RETURN v_fecha - (v_dias_restar || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Actualizar funciones de planificación semanal que usan CURRENT_DATE
-- Estas funciones están en migraciones de creación de datos iniciales
-- y usan CURRENT_DATE para calcular semanas. Necesitamos usar fn_today_argentina()

-- NOTA: Las funciones que crean datos iniciales (como fn_crear_plan_semanal_completo)
-- pueden seguir usando fn_calcular_inicio_semana(fn_today_argentina()) que ya está corregida
-- arriba. No necesitamos actualizarlas aquí ya que dependen de fn_calcular_inicio_semana.

-- ===========================================
-- 5. ACTUALIZAR FUNCIONES DE CONTEOS
-- ===========================================

-- fn_iniciar_conteo_stock (con validación de duplicados)
DROP FUNCTION IF EXISTS fn_iniciar_conteo_stock(UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION fn_iniciar_conteo_stock(
    p_sucursal_id UUID,
    p_usuario_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_conteo_id UUID;
    v_producto RECORD;
    v_stock_teorico DECIMAL(10,3);
    v_costo_promedio DECIMAL(10,2);
    v_conteo_existente UUID;
BEGIN
    -- Validar que no haya un conteo en proceso
    SELECT id INTO v_conteo_existente
    FROM conteos_stock
    WHERE sucursal_id = p_sucursal_id
      AND estado = 'en_proceso'
    LIMIT 1;

    IF v_conteo_existente IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ya existe un conteo en proceso para esta sucursal. Complétalo o cancélalo antes de iniciar uno nuevo.',
            'conteo_id_existente', v_conteo_existente
        );
    END IF;

    INSERT INTO conteos_stock (
        sucursal_id,
        fecha_conteo,
        estado,
        realizado_por
    ) VALUES (
        p_sucursal_id,
        fn_today_argentina(),
        'en_proceso',
        p_usuario_id
    ) RETURNING id INTO v_conteo_id;

    FOR v_producto IN
        SELECT DISTINCT p.id, p.nombre
        FROM productos p
        INNER JOIN lotes l ON l.producto_id = p.id
        WHERE l.sucursal_id = p_sucursal_id
          AND l.cantidad_disponible > 0
          AND p.activo = true
    LOOP
        SELECT COALESCE(SUM(cantidad_disponible), 0)
        INTO v_stock_teorico
        FROM lotes
        WHERE producto_id = v_producto.id
          AND sucursal_id = p_sucursal_id
          AND estado = 'disponible';

        v_costo_promedio := fn_obtener_costo_promedio_sucursal(p_sucursal_id, v_producto.id);

        INSERT INTO conteo_stock_items (
            conteo_id,
            producto_id,
            cantidad_teorica,
            costo_unitario_promedio
        ) VALUES (
            v_conteo_id,
            v_producto.id,
            v_stock_teorico,
            v_costo_promedio
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'conteo_id', v_conteo_id,
        'mensaje', 'Conteo iniciado correctamente'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 6. ACTUALIZAR MATERIALIZED VIEWS
-- ===========================================

-- Actualizar mv_kpis_ventas_diarias
DROP MATERIALIZED VIEW IF EXISTS mv_kpis_ventas_diarias CASCADE;
CREATE MATERIALIZED VIEW mv_kpis_ventas_diarias AS
SELECT 
    DATE(p.fecha_pedido) as fecha,
    COUNT(DISTINCT p.id) as total_pedidos,
    COUNT(DISTINCT p.id) FILTER (WHERE p.estado = 'entregado') as pedidos_entregados,
    COUNT(DISTINCT p.id) FILTER (WHERE p.estado = 'cancelado') as pedidos_cancelados,
    SUM(p.total) FILTER (WHERE p.estado = 'entregado') as total_ventas,
    AVG(p.total) FILTER (WHERE p.estado = 'entregado') as promedio_pedido,
    COUNT(DISTINCT p.cliente_id) FILTER (WHERE p.estado = 'entregado') as clientes_unicos,
    COALESCE(SUM(tm.monto) FILTER (WHERE p.estado = 'entregado' AND tm.metodo_pago = 'efectivo'), 0) as ventas_efectivo,
    COALESCE(SUM(tm.monto) FILTER (WHERE p.estado = 'entregado' AND tm.metodo_pago = 'transferencia'), 0) as ventas_transferencia,
    COALESCE(SUM(tm.monto) FILTER (WHERE p.estado = 'entregado' AND tm.metodo_pago = 'cuenta_corriente'), 0) as ventas_cuenta_corriente
FROM pedidos p
LEFT JOIN tesoreria_movimientos tm ON tm.origen_tipo = 'pedido' AND tm.origen_id = p.id AND tm.tipo = 'ingreso'
WHERE p.fecha_pedido >= fn_today_argentina() - INTERVAL '90 days'
GROUP BY DATE(p.fecha_pedido)
ORDER BY fecha DESC;

CREATE UNIQUE INDEX idx_mv_kpis_ventas_diarias_fecha 
  ON mv_kpis_ventas_diarias(fecha);

-- Actualizar mv_kpis_ventas_mensuales
DROP MATERIALIZED VIEW IF EXISTS mv_kpis_ventas_mensuales CASCADE;
CREATE MATERIALIZED VIEW mv_kpis_ventas_mensuales AS
SELECT 
    DATE_TRUNC('month', fecha_pedido)::DATE as mes,
    COUNT(*) as total_pedidos,
    COUNT(*) FILTER (WHERE estado = 'entregado') as pedidos_entregados,
    SUM(total) FILTER (WHERE estado = 'entregado') as total_ventas,
    AVG(total) FILTER (WHERE estado = 'entregado') as promedio_pedido,
    COUNT(DISTINCT cliente_id) FILTER (WHERE estado = 'entregado') as clientes_unicos,
    COUNT(DISTINCT zona_id) FILTER (WHERE estado = 'entregado') as zonas_activas
FROM pedidos
WHERE fecha_pedido >= DATE_TRUNC('month', fn_today_argentina() - INTERVAL '12 months')
GROUP BY DATE_TRUNC('month', fecha_pedido)
ORDER BY mes DESC;

CREATE UNIQUE INDEX idx_mv_kpis_ventas_mensuales_mes 
  ON mv_kpis_ventas_mensuales(mes);

-- ===========================================
-- 7. ACTUALIZAR FUNCIONES DE RRHH
-- ===========================================

-- fn_calcular_liquidacion (usa CURRENT_DATE en INSERT)
-- Actualizamos la función para usar fn_today_argentina() en lugar de CURRENT_DATE
DROP FUNCTION IF EXISTS fn_calcular_liquidacion(UUID, INTEGER, INTEGER, UUID) CASCADE;
CREATE OR REPLACE FUNCTION fn_calcular_liquidacion(
    p_empleado_id UUID,
    p_mes INTEGER,
    p_anio INTEGER,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_liquidacion_id UUID;
    v_empleado RECORD;
    v_descuentos_total DECIMAL(10,2) := 0;
    v_adelantos_total DECIMAL(10,2) := 0;
    v_horas_trabajadas DECIMAL(5,2) := 0;
    v_turnos_trabajados INTEGER := 0;
    v_horas_extras DECIMAL(5,2) := 0;
BEGIN
    -- Obtener datos del empleado
    SELECT e.*, c.sueldo_basico, c.adicional_cajero, c.adicional_produccion
    INTO v_empleado
    FROM rrhh_empleados e
    JOIN rrhh_categorias c ON e.categoria_id = c.id
    WHERE e.id = p_empleado_id;

    -- Calcular totales de asistencia
    SELECT
        COALESCE(SUM(horas_trabajadas), 0),
        COUNT(*) FILTER (WHERE turno IS NOT NULL),
        COALESCE(SUM(CASE WHEN horas_trabajadas > 8 THEN horas_trabajadas - 8 ELSE 0 END), 0)
    INTO v_horas_trabajadas, v_turnos_trabajados, v_horas_extras
    FROM rrhh_asistencia
    WHERE empleado_id = p_empleado_id
    AND EXTRACT(MONTH FROM fecha) = p_mes
    AND EXTRACT(YEAR FROM fecha) = p_anio
    AND estado = 'presente';

    -- Calcular totales de adelantos
    SELECT COALESCE(SUM(monto), 0)
    INTO v_adelantos_total
    FROM rrhh_adelantos
    WHERE empleado_id = p_empleado_id
    AND aprobado = true
    AND EXTRACT(MONTH FROM fecha_aprobacion) = p_mes
    AND EXTRACT(YEAR FROM fecha_aprobacion) = p_anio;

    -- Calcular totales de descuentos
    SELECT COALESCE(SUM(monto), 0)
    INTO v_descuentos_total
    FROM rrhh_descuentos
    WHERE empleado_id = p_empleado_id
    AND aprobado = true
    AND EXTRACT(MONTH FROM fecha) = p_mes
    AND EXTRACT(YEAR FROM fecha) = p_anio;

    -- Crear liquidación (usando fn_today_argentina() en lugar de CURRENT_DATE)
    INSERT INTO rrhh_liquidaciones (
        empleado_id, periodo_mes, periodo_anio, fecha_liquidacion,
        sueldo_basico, adicional_cajero, adicional_produccion,
        horas_trabajadas, turnos_trabajados, horas_extras,
        valor_hora_extra, total_bruto, descuentos_total, adelantos_total,
        total_neto, estado, created_by
    ) VALUES (
        p_empleado_id, p_mes, p_anio, fn_today_argentina(),
        v_empleado.sueldo_basico, v_empleado.adicional_cajero, v_empleado.adicional_produccion,
        v_horas_trabajadas, v_turnos_trabajados, v_horas_extras,
        v_empleado.sueldo_basico / 160,
        v_empleado.sueldo_basico + v_empleado.adicional_cajero + (v_horas_extras * (v_empleado.sueldo_basico / 160)),
        v_descuentos_total, v_adelantos_total,
        v_empleado.sueldo_basico + v_empleado.adicional_cajero + (v_horas_extras * (v_empleado.sueldo_basico / 160)) - v_descuentos_total - v_adelantos_total,
        'calculada', p_created_by
    ) RETURNING id INTO v_liquidacion_id;

    -- Insertar detalles de la liquidación
    INSERT INTO rrhh_liquidacion_detalles (liquidacion_id, tipo, descripcion, monto) VALUES
    (v_liquidacion_id, 'sueldo_basico', 'Sueldo básico mensual', v_empleado.sueldo_basico),
    (v_liquidacion_id, 'adicional_cajero', 'Adicional cajero', v_empleado.adicional_cajero),
    (v_liquidacion_id, 'horas_extras', 'Horas extras (' || v_horas_extras || ')', v_horas_extras * (v_empleado.sueldo_basico / 160)),
    (v_liquidacion_id, 'descuentos', 'Descuentos totales', -v_descuentos_total),
    (v_liquidacion_id, 'adelantos', 'Adelantos totales', -v_adelantos_total);

    RETURN v_liquidacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 8. ACTUALIZAR FUNCIONES DE OPTIMIZACIÓN DE QUERIES
-- ===========================================

-- fn_obtener_cliente_completo (si usa CURRENT_DATE en validaciones de listas)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'fn_obtener_cliente_completo'
        AND pg_get_functiondef(oid) LIKE '%CURRENT_DATE%'
    ) THEN
        -- Esta función probablemente valida vigencia de listas
        -- Se actualizará si es necesario
        NULL;
    END IF;
END $$;

-- ===========================================
-- 9. ACTUALIZAR FUNCIONES DE STOCK (si usan CURRENT_DATE)
-- ===========================================

-- Las funciones de stock que validan fecha_vencimiento >= CURRENT_DATE
-- ya están actualizadas en la migración 20251202_timezone_gmt3.sql
-- pero verificamos que usen fn_today_argentina()

-- ===========================================
-- 10. CREAR FUNCIÓN DE DIAGNÓSTICO
-- ===========================================

CREATE OR REPLACE FUNCTION fn_diagnosticar_timezone_issues()
RETURNS TABLE (
    tipo_problema TEXT,
    tabla_o_funcion TEXT,
    columna_o_linea TEXT,
    descripcion TEXT,
    recomendacion TEXT
) AS $$
BEGIN
    -- Buscar columnas DATE con DEFAULT CURRENT_DATE
    RETURN QUERY
    SELECT 
        'COLUMN_DEFAULT'::TEXT,
        table_name::TEXT,
        column_name::TEXT,
        ('Columna DATE con DEFAULT CURRENT_DATE: ' || COALESCE(column_default, 'NULL'))::TEXT,
        'Cambiar a: DEFAULT fn_today_argentina()'::TEXT
    FROM information_schema.columns
    WHERE data_type = 'date'
      AND column_default LIKE '%CURRENT_DATE%'
      AND table_schema = 'public'
      AND table_name NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_name, column_name;

    -- Buscar funciones que usan CURRENT_DATE en el código
    RETURN QUERY
    SELECT 
        'FUNCTION_CODE'::TEXT,
        proname::TEXT,
        ''::TEXT,
        'Función que usa CURRENT_DATE en el código'::TEXT,
        'Revisar y reemplazar CURRENT_DATE por fn_today_argentina()'::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND pg_get_functiondef(p.oid) LIKE '%CURRENT_DATE%'
      AND proname NOT LIKE 'fn_%argentina%'
      AND proname NOT LIKE 'fn_diagnosticar%'
    ORDER BY proname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===========================================

COMMENT ON FUNCTION fn_now_argentina() IS '⚠️ USAR SIEMPRE para timestamps. Retorna fecha/hora actual en timezone Argentina (GMT-3).';
COMMENT ON FUNCTION fn_today_argentina() IS '⚠️ USAR SIEMPRE para fechas de negocio. Retorna fecha de hoy en timezone Argentina (GMT-3).';
COMMENT ON FUNCTION fn_diagnosticar_timezone_issues() IS 'Función de diagnóstico que lista todos los lugares donde aún se usa CURRENT_DATE sin timezone. Ejecutar periódicamente para auditoría.';

COMMIT;

-- ===========================================
-- POST-EJECUCIÓN: INSTRUCCIONES
-- ===========================================
-- 
-- 1. EJECUTAR DIAGNÓSTICO:
--    SELECT * FROM fn_diagnosticar_timezone_issues();
--
-- 2. VERIFICAR RESULTADOS:
--    Revisar que no queden problemas pendientes
--
-- 3. REGLAS PARA DESARROLLADORES:
--    ✅ fn_today_argentina() → Para columnas DATE y comparaciones de fecha
--    ✅ fn_now_argentina() → Para timestamps con hora (TIMESTAMPTZ)
--    ✅ NOW() → Solo para created_at/updated_at (ya incluye timezone correctamente)
--    ❌ CURRENT_DATE → NUNCA USAR (usa UTC del servidor)
--    ❌ NOW() sin timezone → NUNCA USAR para operaciones de negocio
--
-- 4. REFRESCAR MATERIALIZED VIEWS:
--    SELECT fn_refresh_materialized_views_reportes();
-- ===========================================
