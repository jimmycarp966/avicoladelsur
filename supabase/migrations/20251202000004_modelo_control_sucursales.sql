-- ===========================================
-- MIGRACIÓN: Modelo de Control para Sucursales
-- Fecha: 2025-12-02
-- Descripción: Implementa el modelo de control de precios mayorista/minorista,
--              cálculo de costo y margen, conteos físicos y auditoría de uso de listas.
-- ===========================================

BEGIN;

-- ===========================================
-- 1. AGREGAR CAMPOS DE COSTO Y MARGEN A VENTAS DE SUCURSAL
-- ===========================================

-- Agregar campos de costo y lista de precio a detalles de pedido
ALTER TABLE detalles_pedido ADD COLUMN IF NOT EXISTS costo_unitario DECIMAL(10,2);
ALTER TABLE detalles_pedido ADD COLUMN IF NOT EXISTS margen_bruto DECIMAL(10,2);
ALTER TABLE detalles_pedido ADD COLUMN IF NOT EXISTS lista_precio_id UUID REFERENCES listas_precios(id);
ALTER TABLE detalles_pedido ADD COLUMN IF NOT EXISTS tipo_lista VARCHAR(50);

-- Agregar campos de totales de costo y margen a pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costo_total DECIMAL(10,2);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS margen_bruto_total DECIMAL(10,2);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_cajero_id UUID REFERENCES usuarios(id);

-- ===========================================
-- 2. TABLA DE CONTEOS FÍSICOS DE STOCK
-- ===========================================

CREATE TABLE IF NOT EXISTS conteos_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id),
    fecha_conteo DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(20) DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'completado', 'aprobado', 'rechazado')),
    realizado_por UUID NOT NULL REFERENCES usuarios(id),
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMPTZ,
    observaciones TEXT,
    total_diferencias INTEGER DEFAULT 0,
    total_merma_valor DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detalle de conteo por producto
CREATE TABLE IF NOT EXISTS conteo_stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conteo_id UUID NOT NULL REFERENCES conteos_stock(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad_teorica DECIMAL(10,3) NOT NULL,
    cantidad_contada DECIMAL(10,3),
    diferencia DECIMAL(10,3) GENERATED ALWAYS AS (COALESCE(cantidad_contada, 0) - cantidad_teorica) STORED,
    costo_unitario_promedio DECIMAL(10,2),
    valor_diferencia DECIMAL(12,2) GENERATED ALWAYS AS (
        (COALESCE(cantidad_contada, 0) - cantidad_teorica) * COALESCE(costo_unitario_promedio, 0)
    ) STORED,
    motivo_diferencia VARCHAR(100),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 3. TABLA DE AJUSTES DE STOCK
-- ===========================================

CREATE TABLE IF NOT EXISTS ajustes_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id),
    conteo_id UUID REFERENCES conteos_stock(id),
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_id UUID REFERENCES lotes(id),
    tipo_ajuste VARCHAR(20) NOT NULL CHECK (tipo_ajuste IN ('merma', 'sobrante', 'vencimiento', 'rotura', 'otro')),
    cantidad DECIMAL(10,3) NOT NULL,
    costo_unitario DECIMAL(10,2),
    valor_ajuste DECIMAL(12,2),
    motivo TEXT NOT NULL,
    aprobado BOOLEAN DEFAULT false,
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMPTZ,
    realizado_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 4. TABLA DE AUDITORÍA DE USO DE LISTAS DE PRECIO
-- ===========================================

CREATE TABLE IF NOT EXISTS auditoria_listas_precios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID REFERENCES sucursales(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    pedido_id UUID REFERENCES pedidos(id),
    lista_precio_id UUID NOT NULL REFERENCES listas_precios(id),
    tipo_lista VARCHAR(50) NOT NULL,
    cantidad_total DECIMAL(10,3),
    monto_total DECIMAL(12,2),
    fecha_venta TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 5. VISTA MATERIALIZADA: Resumen de uso de listas por sucursal
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_listas_sucursal AS
SELECT 
    a.sucursal_id,
    s.nombre as sucursal_nombre,
    a.usuario_id,
    u.nombre as usuario_nombre,
    a.tipo_lista,
    DATE_TRUNC('day', a.fecha_venta) as fecha,
    COUNT(*) as cantidad_ventas,
    SUM(a.cantidad_total) as kg_totales,
    SUM(a.monto_total) as monto_total,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY a.sucursal_id, DATE_TRUNC('day', a.fecha_venta)), 2) as porcentaje_del_dia
FROM auditoria_listas_precios a
LEFT JOIN sucursales s ON a.sucursal_id = s.id
LEFT JOIN usuarios u ON a.usuario_id = u.id
GROUP BY a.sucursal_id, s.nombre, a.usuario_id, u.nombre, a.tipo_lista, DATE_TRUNC('day', a.fecha_venta);

-- Índice único para refresh concurrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_resumen_listas_pk 
ON mv_resumen_listas_sucursal(sucursal_id, usuario_id, tipo_lista, fecha);

-- ===========================================
-- 6. ÍNDICES PARA OPTIMIZACIÓN
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_conteos_stock_sucursal ON conteos_stock(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_fecha ON conteos_stock(fecha_conteo DESC);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_estado ON conteos_stock(estado);
CREATE INDEX IF NOT EXISTS idx_conteo_items_conteo ON conteo_stock_items(conteo_id);
CREATE INDEX IF NOT EXISTS idx_conteo_items_producto ON conteo_stock_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_stock_sucursal ON ajustes_stock(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_stock_producto ON ajustes_stock(producto_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_stock_conteo ON ajustes_stock(conteo_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_listas_sucursal ON auditoria_listas_precios(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_listas_usuario ON auditoria_listas_precios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_listas_fecha ON auditoria_listas_precios(fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_listas_tipo ON auditoria_listas_precios(tipo_lista);
CREATE INDEX IF NOT EXISTS idx_detalles_pedido_lista ON detalles_pedido(lista_precio_id);

-- ===========================================
-- 7. FUNCIÓN: Obtener costo promedio ponderado por producto y sucursal
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_costo_promedio_sucursal(
    p_sucursal_id UUID,
    p_producto_id UUID
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_costo_promedio DECIMAL(10,2);
BEGIN
    -- Calcular costo promedio ponderado de los lotes disponibles
    SELECT 
        CASE 
            WHEN SUM(cantidad_disponible) > 0 THEN
                SUM(cantidad_disponible * COALESCE(costo_unitario, 0)) / SUM(cantidad_disponible)
            ELSE 0
        END
    INTO v_costo_promedio
    FROM lotes
    WHERE sucursal_id = p_sucursal_id
      AND producto_id = p_producto_id
      AND estado = 'disponible'
      AND cantidad_disponible > 0;

    -- Si no hay lotes en la sucursal, usar precio_costo del producto
    IF v_costo_promedio IS NULL OR v_costo_promedio = 0 THEN
        SELECT precio_costo INTO v_costo_promedio
        FROM productos
        WHERE id = p_producto_id;
    END IF;

    RETURN COALESCE(v_costo_promedio, 0);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 8. FUNCIÓN: Registrar venta de sucursal con control de precios
-- ===========================================

CREATE OR REPLACE FUNCTION fn_registrar_venta_sucursal(
    p_sucursal_id UUID,
    p_cliente_id UUID,
    p_usuario_id UUID,
    p_lista_precio_id UUID,
    p_items JSONB,
    p_pago JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(60);
    v_item JSONB;
    v_producto RECORD;
    v_cantidad DECIMAL(10,3);
    v_precio_unitario DECIMAL(10,2);
    v_costo_unitario DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_total DECIMAL(10,2) := 0;
    v_costo_total DECIMAL(10,2) := 0;
    v_margen_total DECIMAL(10,2) := 0;
    v_lista_tipo VARCHAR(50);
    v_lote RECORD;
    v_pendiente DECIMAL(10,3);
    v_utiliza DECIMAL(10,3);
    v_cantidad_total DECIMAL(10,3) := 0;
BEGIN
    -- Validar parámetros
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'La venta debe tener items');
    END IF;

    -- Obtener tipo de lista
    SELECT tipo INTO v_lista_tipo
    FROM listas_precios
    WHERE id = p_lista_precio_id;

    IF v_lista_tipo IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lista de precios no encontrada');
    END IF;

    -- Generar número de pedido
    v_numero_pedido := 'VTA-SUC-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido
    INSERT INTO pedidos (
        numero_pedido,
        cliente_id,
        sucursal_id,
        usuario_vendedor,
        usuario_cajero_id,
        lista_precio_id,
        estado,
        tipo_pedido,
        origen,
        subtotal,
        total,
        pago_estado,
        fecha_pedido
    ) VALUES (
        v_numero_pedido,
        p_cliente_id,
        p_sucursal_id,
        p_usuario_id,
        p_usuario_id,
        p_lista_precio_id,
        'completado',
        'venta',
        'sucursal',
        0,
        0,
        COALESCE(p_pago->>'estado', 'pendiente'),
        NOW()
    ) RETURNING id INTO v_pedido_id;

    -- Procesar cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Obtener producto
        SELECT * INTO v_producto
        FROM productos
        WHERE id = (v_item->>'producto_id')::UUID;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'producto_id';
        END IF;

        v_cantidad := (v_item->>'cantidad')::DECIMAL;
        
        -- Obtener precio de la lista
        v_precio_unitario := COALESCE(
            (v_item->>'precio_unitario')::DECIMAL,
            fn_obtener_precio_producto(p_lista_precio_id, v_producto.id)
        );

        -- Obtener costo promedio
        v_costo_unitario := fn_obtener_costo_promedio_sucursal(p_sucursal_id, v_producto.id);

        v_subtotal := v_cantidad * v_precio_unitario;
        v_total := v_total + v_subtotal;
        v_costo_total := v_costo_total + (v_cantidad * v_costo_unitario);
        v_cantidad_total := v_cantidad_total + v_cantidad;

        -- Descontar stock FIFO
        v_pendiente := v_cantidad;
        FOR v_lote IN
            SELECT * FROM lotes
            WHERE producto_id = v_producto.id
              AND sucursal_id = p_sucursal_id
              AND estado = 'disponible'
              AND cantidad_disponible > 0
            ORDER BY fecha_vencimiento NULLS LAST, fecha_ingreso
            FOR UPDATE
        LOOP
            EXIT WHEN v_pendiente <= 0;

            v_utiliza := LEAST(v_lote.cantidad_disponible, v_pendiente);

            UPDATE lotes
            SET cantidad_disponible = cantidad_disponible - v_utiliza,
                updated_at = NOW()
            WHERE id = v_lote.id;

            -- Registrar movimiento de stock
            INSERT INTO movimientos_stock (
                lote_id,
                tipo_movimiento,
                cantidad,
                motivo,
                usuario_id,
                pedido_id
            ) VALUES (
                v_lote.id,
                'salida',
                v_utiliza,
                'Venta sucursal ' || v_numero_pedido,
                p_usuario_id,
                v_pedido_id
            );

            -- Insertar detalle del pedido
            INSERT INTO detalles_pedido (
                pedido_id,
                producto_id,
                lote_id,
                cantidad,
                precio_unitario,
                subtotal,
                costo_unitario,
                margen_bruto,
                lista_precio_id,
                tipo_lista
            ) VALUES (
                v_pedido_id,
                v_producto.id,
                v_lote.id,
                v_utiliza,
                v_precio_unitario,
                v_utiliza * v_precio_unitario,
                COALESCE(v_lote.costo_unitario, v_costo_unitario),
                (v_precio_unitario - COALESCE(v_lote.costo_unitario, v_costo_unitario)) * v_utiliza,
                p_lista_precio_id,
                v_lista_tipo
            );

            v_pendiente := v_pendiente - v_utiliza;
        END LOOP;

        IF v_pendiente > 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %', v_producto.nombre;
        END IF;
    END LOOP;

    -- Calcular margen total
    v_margen_total := v_total - v_costo_total;

    -- Actualizar totales del pedido
    UPDATE pedidos
    SET subtotal = v_total,
        total = v_total,
        costo_total = v_costo_total,
        margen_bruto_total = v_margen_total,
        updated_at = NOW()
    WHERE id = v_pedido_id;

    -- Registrar en auditoría de listas de precios
    INSERT INTO auditoria_listas_precios (
        sucursal_id,
        usuario_id,
        cliente_id,
        pedido_id,
        lista_precio_id,
        tipo_lista,
        cantidad_total,
        monto_total,
        fecha_venta
    ) VALUES (
        p_sucursal_id,
        p_usuario_id,
        p_cliente_id,
        v_pedido_id,
        p_lista_precio_id,
        v_lista_tipo,
        v_cantidad_total,
        v_total,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total,
        'costo_total', v_costo_total,
        'margen_bruto', v_margen_total,
        'tipo_lista', v_lista_tipo
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
-- 9. FUNCIÓN: Iniciar conteo de stock
-- ===========================================

CREATE OR REPLACE FUNCTION fn_iniciar_conteo_stock(
    p_sucursal_id UUID,
    p_usuario_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_conteo_id UUID;
    v_producto RECORD;
    v_stock_teorico DECIMAL(10,3);
    v_costo_promedio DECIMAL(10,2);
BEGIN
    -- Crear registro de conteo
    INSERT INTO conteos_stock (
        sucursal_id,
        fecha_conteo,
        estado,
        realizado_por
    ) VALUES (
        p_sucursal_id,
        CURRENT_DATE,
        'en_proceso',
        p_usuario_id
    ) RETURNING id INTO v_conteo_id;

    -- Crear items para cada producto con stock en la sucursal
    FOR v_producto IN
        SELECT DISTINCT p.id, p.nombre
        FROM productos p
        INNER JOIN lotes l ON l.producto_id = p.id
        WHERE l.sucursal_id = p_sucursal_id
          AND l.cantidad_disponible > 0
          AND p.activo = true
    LOOP
        -- Calcular stock teórico
        SELECT COALESCE(SUM(cantidad_disponible), 0)
        INTO v_stock_teorico
        FROM lotes
        WHERE producto_id = v_producto.id
          AND sucursal_id = p_sucursal_id
          AND estado = 'disponible';

        -- Obtener costo promedio
        v_costo_promedio := fn_obtener_costo_promedio_sucursal(p_sucursal_id, v_producto.id);

        -- Insertar item de conteo
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
-- 10. FUNCIÓN: Completar conteo y generar ajustes
-- ===========================================

CREATE OR REPLACE FUNCTION fn_completar_conteo_stock(
    p_conteo_id UUID,
    p_usuario_id UUID,
    p_tolerancia_porcentaje DECIMAL(5,2) DEFAULT 2.0
) RETURNS JSONB AS $$
DECLARE
    v_conteo RECORD;
    v_item RECORD;
    v_diferencias INTEGER := 0;
    v_merma_total DECIMAL(12,2) := 0;
BEGIN
    -- Obtener conteo
    SELECT * INTO v_conteo
    FROM conteos_stock
    WHERE id = p_conteo_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Conteo no encontrado');
    END IF;

    IF v_conteo.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El conteo no está en proceso');
    END IF;

    -- Procesar diferencias y crear ajustes
    FOR v_item IN
        SELECT * FROM conteo_stock_items
        WHERE conteo_id = p_conteo_id
          AND cantidad_contada IS NOT NULL
          AND diferencia != 0
    LOOP
        v_diferencias := v_diferencias + 1;

        -- Calcular porcentaje de diferencia
        DECLARE
            v_porcentaje_dif DECIMAL(5,2);
            v_tipo_ajuste VARCHAR(20);
            v_aprobado_auto BOOLEAN := false;
        BEGIN
            IF v_item.cantidad_teorica > 0 THEN
                v_porcentaje_dif := ABS(v_item.diferencia) * 100.0 / v_item.cantidad_teorica;
            ELSE
                v_porcentaje_dif := 100;
            END IF;

            -- Determinar tipo de ajuste
            IF v_item.diferencia < 0 THEN
                v_tipo_ajuste := 'merma';
                v_merma_total := v_merma_total + ABS(v_item.valor_diferencia);
            ELSE
                v_tipo_ajuste := 'sobrante';
            END IF;

            -- Auto-aprobar si está dentro de la tolerancia
            IF v_porcentaje_dif <= p_tolerancia_porcentaje THEN
                v_aprobado_auto := true;
            END IF;

            -- Crear ajuste de stock
            INSERT INTO ajustes_stock (
                sucursal_id,
                conteo_id,
                producto_id,
                tipo_ajuste,
                cantidad,
                costo_unitario,
                valor_ajuste,
                motivo,
                aprobado,
                aprobado_por,
                fecha_aprobacion,
                realizado_por
            ) VALUES (
                v_conteo.sucursal_id,
                p_conteo_id,
                v_item.producto_id,
                v_tipo_ajuste,
                ABS(v_item.diferencia),
                v_item.costo_unitario_promedio,
                ABS(v_item.valor_diferencia),
                CASE 
                    WHEN v_aprobado_auto THEN 'Merma normal (dentro de tolerancia ' || p_tolerancia_porcentaje || '%)'
                    ELSE 'Diferencia detectada en conteo físico - Requiere revisión'
                END,
                v_aprobado_auto,
                CASE WHEN v_aprobado_auto THEN p_usuario_id ELSE NULL END,
                CASE WHEN v_aprobado_auto THEN NOW() ELSE NULL END,
                p_usuario_id
            );

            -- Si es merma aprobada automáticamente, aplicar ajuste al stock
            IF v_aprobado_auto AND v_item.diferencia < 0 THEN
                -- Descontar de lotes (FIFO)
                DECLARE
                    v_pendiente_ajuste DECIMAL(10,3) := ABS(v_item.diferencia);
                    v_lote_ajuste RECORD;
                    v_utiliza_ajuste DECIMAL(10,3);
                BEGIN
                    FOR v_lote_ajuste IN
                        SELECT * FROM lotes
                        WHERE producto_id = v_item.producto_id
                          AND sucursal_id = v_conteo.sucursal_id
                          AND estado = 'disponible'
                          AND cantidad_disponible > 0
                        ORDER BY fecha_vencimiento NULLS LAST, fecha_ingreso
                        FOR UPDATE
                    LOOP
                        EXIT WHEN v_pendiente_ajuste <= 0;

                        v_utiliza_ajuste := LEAST(v_lote_ajuste.cantidad_disponible, v_pendiente_ajuste);

                        UPDATE lotes
                        SET cantidad_disponible = cantidad_disponible - v_utiliza_ajuste,
                            updated_at = NOW()
                        WHERE id = v_lote_ajuste.id;

                        INSERT INTO movimientos_stock (
                            lote_id,
                            tipo_movimiento,
                            cantidad,
                            motivo,
                            usuario_id
                        ) VALUES (
                            v_lote_ajuste.id,
                            'ajuste',
                            v_utiliza_ajuste,
                            'Ajuste por conteo físico - Merma normal',
                            p_usuario_id
                        );

                        v_pendiente_ajuste := v_pendiente_ajuste - v_utiliza_ajuste;
                    END LOOP;
                END;
            END IF;
        END;
    END LOOP;

    -- Actualizar conteo
    UPDATE conteos_stock
    SET estado = 'completado',
        total_diferencias = v_diferencias,
        total_merma_valor = v_merma_total,
        updated_at = NOW()
    WHERE id = p_conteo_id;

    RETURN jsonb_build_object(
        'success', true,
        'mensaje', 'Conteo completado',
        'total_diferencias', v_diferencias,
        'total_merma_valor', v_merma_total
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
-- 11. FUNCIÓN: Reporte de uso de listas de precio por sucursal
-- ===========================================

CREATE OR REPLACE FUNCTION fn_reporte_uso_listas_sucursal(
    p_sucursal_id UUID,
    p_fecha_desde DATE DEFAULT NULL,
    p_fecha_hasta DATE DEFAULT NULL
) RETURNS TABLE (
    usuario_id UUID,
    usuario_nombre VARCHAR,
    tipo_lista VARCHAR,
    cantidad_ventas BIGINT,
    kg_totales DECIMAL,
    monto_total DECIMAL,
    porcentaje_ventas DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH totales AS (
        SELECT 
            a.usuario_id,
            u.nombre as usuario_nombre,
            a.tipo_lista,
            COUNT(*) as cant_ventas,
            SUM(a.cantidad_total) as kg_tot,
            SUM(a.monto_total) as monto_tot
        FROM auditoria_listas_precios a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.sucursal_id = p_sucursal_id
          AND (p_fecha_desde IS NULL OR a.fecha_venta >= p_fecha_desde)
          AND (p_fecha_hasta IS NULL OR a.fecha_venta < p_fecha_hasta + INTERVAL '1 day')
        GROUP BY a.usuario_id, u.nombre, a.tipo_lista
    ),
    total_sucursal AS (
        SELECT SUM(cant_ventas) as total_ventas
        FROM totales
    )
    SELECT 
        t.usuario_id,
        t.usuario_nombre,
        t.tipo_lista,
        t.cant_ventas,
        t.kg_tot,
        t.monto_tot,
        ROUND(t.cant_ventas * 100.0 / NULLIF(ts.total_ventas, 0), 2) as porcentaje
    FROM totales t
    CROSS JOIN total_sucursal ts
    ORDER BY t.usuario_nombre, t.tipo_lista;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 12. FUNCIÓN: Reporte de márgenes por sucursal
-- ===========================================

CREATE OR REPLACE FUNCTION fn_reporte_margenes_sucursal(
    p_sucursal_id UUID,
    p_fecha_desde DATE DEFAULT NULL,
    p_fecha_hasta DATE DEFAULT NULL
) RETURNS TABLE (
    fecha DATE,
    tipo_lista VARCHAR,
    cantidad_ventas BIGINT,
    venta_total DECIMAL,
    costo_total DECIMAL,
    margen_bruto DECIMAL,
    porcentaje_margen DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(p.fecha_pedido) as fecha,
        COALESCE(lp.tipo, 'sin_lista')::VARCHAR as tipo_lista,
        COUNT(DISTINCT p.id) as cantidad_ventas,
        SUM(p.total) as venta_total,
        SUM(p.costo_total) as costo_total,
        SUM(p.margen_bruto_total) as margen_bruto,
        ROUND(
            SUM(p.margen_bruto_total) * 100.0 / NULLIF(SUM(p.total), 0),
            2
        ) as porcentaje_margen
    FROM pedidos p
    LEFT JOIN listas_precios lp ON p.lista_precio_id = lp.id
    WHERE p.sucursal_id = p_sucursal_id
      AND p.estado = 'completado'
      AND (p_fecha_desde IS NULL OR p.fecha_pedido >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR p.fecha_pedido < p_fecha_hasta + INTERVAL '1 day')
    GROUP BY DATE(p.fecha_pedido), lp.tipo
    ORDER BY fecha DESC, tipo_lista;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 13. FUNCIÓN: Alertas de comportamiento sospechoso
-- ===========================================

CREATE OR REPLACE FUNCTION fn_detectar_comportamiento_sospechoso(
    p_sucursal_id UUID,
    p_dias_atras INTEGER DEFAULT 7
) RETURNS TABLE (
    usuario_id UUID,
    usuario_nombre VARCHAR,
    tipo_alerta VARCHAR,
    descripcion TEXT,
    valor_actual DECIMAL,
    valor_promedio DECIMAL,
    fecha_deteccion TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    -- Alerta 1: Usuario con % de ventas mayoristas muy alto vs promedio
    WITH stats_usuario AS (
        SELECT 
            a.usuario_id,
            u.nombre as usuario_nombre,
            COUNT(*) FILTER (WHERE a.tipo_lista = 'mayorista') as ventas_mayorista,
            COUNT(*) as ventas_totales,
            ROUND(COUNT(*) FILTER (WHERE a.tipo_lista = 'mayorista') * 100.0 / NULLIF(COUNT(*), 0), 2) as pct_mayorista
        FROM auditoria_listas_precios a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.sucursal_id = p_sucursal_id
          AND a.fecha_venta >= NOW() - (p_dias_atras || ' days')::INTERVAL
        GROUP BY a.usuario_id, u.nombre
    ),
    promedio_sucursal AS (
        SELECT AVG(pct_mayorista) as prom_mayorista
        FROM stats_usuario
    )
    SELECT 
        su.usuario_id,
        su.usuario_nombre,
        'alto_mayorista'::VARCHAR as tipo_alerta,
        ('Usuario con ' || su.pct_mayorista || '% de ventas mayoristas vs promedio de ' || ROUND(ps.prom_mayorista, 2) || '%')::TEXT as descripcion,
        su.pct_mayorista as valor_actual,
        ROUND(ps.prom_mayorista, 2) as valor_promedio,
        NOW() as fecha_deteccion
    FROM stats_usuario su
    CROSS JOIN promedio_sucursal ps
    WHERE su.pct_mayorista > ps.prom_mayorista * 1.5  -- 50% más que el promedio
      AND su.ventas_totales >= 5  -- Al menos 5 ventas para ser significativo

    UNION ALL

    -- Alerta 2: Ventas mayoristas de bajo volumen (posible "descuento disfrazado")
    SELECT 
        a.usuario_id,
        u.nombre as usuario_nombre,
        'mayorista_bajo_volumen'::VARCHAR as tipo_alerta,
        ('Venta mayorista de solo ' || a.cantidad_total || ' kg al cliente')::TEXT as descripcion,
        a.cantidad_total as valor_actual,
        10.0 as valor_promedio,  -- Umbral mínimo esperado para mayorista
        a.fecha_venta as fecha_deteccion
    FROM auditoria_listas_precios a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    WHERE a.sucursal_id = p_sucursal_id
      AND a.tipo_lista = 'mayorista'
      AND a.cantidad_total < 10  -- Menos de 10 kg como mayorista es sospechoso
      AND a.fecha_venta >= NOW() - (p_dias_atras || ' days')::INTERVAL

    ORDER BY fecha_deteccion DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 14. POLÍTICAS RLS
-- ===========================================

-- Conteos de stock
ALTER TABLE conteos_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_conteos" ON conteos_stock
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "sucursal_access_conteos" ON conteos_stock
    USING (sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::UUID);

-- Items de conteo
ALTER TABLE conteo_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_conteo_items" ON conteo_stock_items
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "sucursal_access_conteo_items" ON conteo_stock_items
    USING (
        conteo_id IN (
            SELECT id FROM conteos_stock
            WHERE sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::UUID
        )
    );

-- Ajustes de stock
ALTER TABLE ajustes_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_ajustes" ON ajustes_stock
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "sucursal_access_ajustes" ON ajustes_stock
    USING (sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::UUID);

-- Auditoría de listas
ALTER TABLE auditoria_listas_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_auditoria_listas" ON auditoria_listas_precios
    USING (current_setting('jwt.claims.role', true) = 'admin');

CREATE POLICY "sucursal_access_auditoria_listas" ON auditoria_listas_precios
    USING (sucursal_id = (current_setting('jwt.claims.sucursal_id', true))::UUID);

-- ===========================================
-- 15. COMENTARIOS DE DOCUMENTACIÓN
-- ===========================================

COMMENT ON TABLE conteos_stock IS 'Registro de conteos físicos de stock por sucursal';
COMMENT ON TABLE conteo_stock_items IS 'Detalle de productos contados en cada conteo físico';
COMMENT ON TABLE ajustes_stock IS 'Ajustes de stock derivados de conteos o correcciones manuales';
COMMENT ON TABLE auditoria_listas_precios IS 'Registro de auditoría de qué lista de precios se usó en cada venta';

COMMENT ON FUNCTION fn_obtener_costo_promedio_sucursal IS 'Calcula el costo promedio ponderado de un producto en una sucursal';
COMMENT ON FUNCTION fn_registrar_venta_sucursal IS 'Registra una venta en sucursal con control de lista de precios, costo y margen';
COMMENT ON FUNCTION fn_iniciar_conteo_stock IS 'Inicia un nuevo conteo físico de stock en una sucursal';
COMMENT ON FUNCTION fn_completar_conteo_stock IS 'Completa un conteo y genera ajustes automáticos según tolerancia';
COMMENT ON FUNCTION fn_reporte_uso_listas_sucursal IS 'Genera reporte de uso de listas de precio por usuario y sucursal';
COMMENT ON FUNCTION fn_reporte_margenes_sucursal IS 'Genera reporte de márgenes por tipo de lista y fecha';
COMMENT ON FUNCTION fn_detectar_comportamiento_sospechoso IS 'Detecta patrones sospechosos en el uso de listas de precios';

COMMIT;

