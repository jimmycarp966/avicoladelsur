-- ===========================================
-- MIGRACIÓN: Stock mínimo por sucursal para transferencias automáticas
-- Fecha: 2025-12-09
-- Descripción: Permite configurar umbrales de stock mínimos específicos por sucursal-producto.
--              Las transferencias automáticas usarán primero el umbral por sucursal
--              y si no existe, harán fallback al stock_minimo global del producto.
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: producto_sucursal_minimos
-- ===========================================

CREATE TABLE IF NOT EXISTS producto_sucursal_minimos (
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (producto_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_sucursal_minimos_sucursal_producto
    ON producto_sucursal_minimos (sucursal_id, producto_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION trg_set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producto_sucursal_minimos_updated_at ON producto_sucursal_minimos;
CREATE TRIGGER trg_producto_sucursal_minimos_updated_at
    BEFORE UPDATE ON producto_sucursal_minimos
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_timestamp();

-- ===========================================
-- HELPER: Obtener stock mínimo por sucursal con fallback
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_stock_minimo_producto_sucursal(
    p_producto_id UUID,
    p_sucursal_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_minimo NUMERIC;
BEGIN
    -- Buscar umbral específico por sucursal
    SELECT psm.stock_minimo
    INTO v_stock_minimo
    FROM producto_sucursal_minimos psm
    WHERE psm.producto_id = p_producto_id
      AND psm.sucursal_id = p_sucursal_id;

    IF FOUND THEN
        RETURN COALESCE(v_stock_minimo, 0);
    END IF;

    -- Fallback al stock_minimo global del producto
    SELECT COALESCE(p.stock_minimo, 0)
    INTO v_stock_minimo
    FROM productos p
    WHERE p.id = p_producto_id;

    RETURN COALESCE(v_stock_minimo, 0);
END;
$$;

COMMENT ON FUNCTION fn_obtener_stock_minimo_producto_sucursal IS 'Devuelve el stock mínimo configurado para un producto en una sucursal, con fallback al stock_minimo global del producto.';

-- ===========================================
-- ACTUALIZAR FUNCIONES EXISTENTES PARA USAR EL NUEVO UMBRAL
-- ===========================================

-- Función: fn_crear_solicitud_transferencia_automatica
CREATE OR REPLACE FUNCTION fn_crear_solicitud_transferencia_automatica(
    p_sucursal_destino_id UUID,
    p_producto_id UUID,
    p_cantidad_sugerida DECIMAL DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sucursal_central_id UUID := '00000000-0000-0000-0000-000000000001';
    v_producto RECORD;
    v_stock_destino DECIMAL(10,3);
    v_stock_origen DECIMAL(10,3);
    v_stock_minimo NUMERIC;
    v_cantidad_sugerida DECIMAL(10,3);
    v_transferencia_id UUID;
    v_numero_transferencia VARCHAR(50);
    v_existe_solicitud BOOLEAN;
    v_alerta_id UUID;
    v_turno VARCHAR(20);
    v_fecha_entrega DATE;
    v_zona_id UUID;
BEGIN
    -- Obtener información del producto
    SELECT id, nombre, stock_minimo INTO v_producto
    FROM productos
    WHERE id = p_producto_id AND activo = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Producto no encontrado o inactivo'
        );
    END IF;
    
    -- Stock mínimo: primero por sucursal, luego global
    v_stock_minimo := fn_obtener_stock_minimo_producto_sucursal(p_producto_id, p_sucursal_destino_id);
    
    -- Calcular stock actual en sucursal destino
    SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_destino
    FROM lotes l
    WHERE l.producto_id = p_producto_id
      AND l.sucursal_id = p_sucursal_destino_id
      AND l.estado = 'disponible';
    
    -- Verificar que realmente esté bajo el stock mínimo
    IF v_stock_destino >= v_stock_minimo THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'El stock actual no está por debajo del mínimo',
            'stock_actual', v_stock_destino,
            'stock_minimo', v_stock_minimo
        );
    END IF;
    
    -- Verificar si ya existe una solicitud automática pendiente para este producto/sucursal
    SELECT EXISTS (
        SELECT 1 
        FROM transferencias_stock ts
        INNER JOIN transferencia_items ti ON ti.transferencia_id = ts.id
        WHERE ts.sucursal_destino_id = p_sucursal_destino_id
          AND ti.producto_id = p_producto_id
          AND ts.estado IN ('solicitud_automatica', 'pendiente')
          AND ts.origen = 'automatica'
    ) INTO v_existe_solicitud;
    
    IF v_existe_solicitud THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ya existe una solicitud automática pendiente para este producto'
        );
    END IF;
    
    -- Calcular stock disponible en Casa Central
    SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_origen
    FROM lotes l
    WHERE l.producto_id = p_producto_id
      AND l.sucursal_id = v_sucursal_central_id
      AND l.estado = 'disponible';
    
    -- Si no hay stock en origen, solo crear alerta
    IF v_stock_origen <= 0 THEN
        INSERT INTO alertas_stock (
            sucursal_id,
            producto_id,
            cantidad_actual,
            umbral,
            estado
        ) VALUES (
            p_sucursal_destino_id,
            p_producto_id,
            v_stock_destino,
            v_stock_minimo,
            'pendiente'
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_alerta_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'accion', 'alerta_creada',
            'mensaje', 'No hay stock disponible en Casa Central. Se creó una alerta.',
            'alerta_id', v_alerta_id,
            'stock_origen', v_stock_origen
        );
    END IF;
    
    -- Calcular cantidad sugerida si no se proporciona
    IF p_cantidad_sugerida IS NULL OR p_cantidad_sugerida <= 0 THEN
        v_cantidad_sugerida := GREATEST(
            v_stock_minimo - v_stock_destino + (v_stock_minimo * 0.5),
            1
        );
        v_cantidad_sugerida := LEAST(v_cantidad_sugerida, v_stock_origen);
    ELSE
        v_cantidad_sugerida := p_cantidad_sugerida;
    END IF;
    
    SELECT t.turno, t.fecha_entrega INTO v_turno, v_fecha_entrega
    FROM fn_calcular_turno_fecha_entrega(NULL) t;
    
    SELECT z.id INTO v_zona_id
    FROM sucursales s
    LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(s.direccion))
    WHERE s.id = p_sucursal_destino_id
    LIMIT 1;
    
    v_numero_transferencia := 'TRANS-AUTO-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    
    INSERT INTO transferencias_stock (
        numero_transferencia,
        sucursal_origen_id,
        sucursal_destino_id,
        estado,
        origen,
        motivo,
        observaciones,
        turno,
        fecha_entrega,
        zona_id
    ) VALUES (
        v_numero_transferencia,
        v_sucursal_central_id,
        p_sucursal_destino_id,
        'solicitud_automatica',
        'automatica',
        'Solicitud automática por stock bajo',
        'Generada automáticamente cuando el stock cayó por debajo del mínimo (' || v_stock_destino || ' < ' || v_stock_minimo || ')',
        v_turno,
        v_fecha_entrega,
        v_zona_id
    ) RETURNING id INTO v_transferencia_id;
    
    INSERT INTO transferencia_items (
        transferencia_id,
        producto_id,
        cantidad_solicitada,
        cantidad_sugerida
    ) VALUES (
        v_transferencia_id,
        p_producto_id,
        v_cantidad_sugerida,
        v_cantidad_sugerida
    );
    
    PERFORM crear_notificacion(
        'transfer_request',
        'Solicitud Automática de Transferencia - ' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_destino_id),
        'La sucursal ' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_destino_id) || 
        ' requiere ' || v_cantidad_sugerida || ' unidades de ' || v_producto.nombre || 
        ' (Stock actual: ' || v_stock_destino || ', Mínimo: ' || v_stock_minimo || ')',
        jsonb_build_object(
            'transferencia_id', v_transferencia_id,
            'sucursal_destino_id', p_sucursal_destino_id,
            'producto_id', p_producto_id,
            'cantidad_sugerida', v_cantidad_sugerida,
            'prioridad', 'alta',
            'origen', 'automatica'
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'accion', 'solicitud_creada',
        'transferencia_id', v_transferencia_id,
        'numero_transferencia', v_numero_transferencia,
        'cantidad_sugerida', v_cantidad_sugerida,
        'stock_origen', v_stock_origen,
        'stock_destino', v_stock_destino
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Función: fn_evaluar_stock_bajo_y_crear_solicitudes
CREATE OR REPLACE FUNCTION fn_evaluar_stock_bajo_y_crear_solicitudes(
    p_sucursal_id UUID,
    p_producto_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_producto RECORD;
    v_stock_total DECIMAL(10,3);
    v_stock_minimo NUMERIC;
    v_resultado JSONB;
    v_resultados JSONB[] := '{}';
    v_total_solicitudes INTEGER := 0;
    v_total_alertas INTEGER := 0;
BEGIN
    IF p_producto_id IS NOT NULL THEN
        SELECT p.id, p.nombre, p.stock_minimo INTO v_producto
        FROM productos p
        WHERE p.id = p_producto_id AND p.activo = true;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Producto no encontrado'
            );
        END IF;
        
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_total
        FROM lotes l
        WHERE l.producto_id = p_producto_id
          AND l.sucursal_id = p_sucursal_id
          AND l.estado = 'disponible';
        
        v_stock_minimo := fn_obtener_stock_minimo_producto_sucursal(p_producto_id, p_sucursal_id);
        
        IF v_stock_total < v_stock_minimo THEN
            v_resultado := fn_crear_solicitud_transferencia_automatica(
                p_sucursal_id,
                p_producto_id,
                NULL
            );
            
            IF v_resultado->>'accion' = 'solicitud_creada' THEN
                v_total_solicitudes := v_total_solicitudes + 1;
            ELSIF v_resultado->>'accion' = 'alerta_creada' THEN
                v_total_alertas := v_total_alertas + 1;
            END IF;
            
            v_resultados := array_append(v_resultados, v_resultado);
        END IF;
    ELSE
        FOR v_producto IN
            SELECT DISTINCT p.id, p.nombre, p.stock_minimo
            FROM productos p
            INNER JOIN lotes l ON l.producto_id = p.id
            WHERE l.sucursal_id = p_sucursal_id
              AND p.activo = true
        LOOP
            SELECT COALESCE(SUM(l2.cantidad_disponible), 0) INTO v_stock_total
            FROM lotes l2
            WHERE l2.producto_id = v_producto.id
              AND l2.sucursal_id = p_sucursal_id
              AND l2.estado = 'disponible';
            
            v_stock_minimo := fn_obtener_stock_minimo_producto_sucursal(v_producto.id, p_sucursal_id);
            
            IF v_stock_total < v_stock_minimo THEN
                v_resultado := fn_crear_solicitud_transferencia_automatica(
                    p_sucursal_id,
                    v_producto.id,
                    NULL
                );
                
                IF v_resultado->>'accion' = 'solicitud_creada' THEN
                    v_total_solicitudes := v_total_solicitudes + 1;
                ELSIF v_resultado->>'accion' = 'alerta_creada' THEN
                    v_total_alertas := v_total_alertas + 1;
                END IF;
                
                v_resultados := array_append(v_resultados, v_resultado);
            END IF;
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'sucursal_id', p_sucursal_id,
        'total_solicitudes', v_total_solicitudes,
        'total_alertas', v_total_alertas,
        'resultados', array_to_json(v_resultados)
    );
END;
$$;

-- Trigger: trg_evaluar_stock_bajo usa el helper nuevo
CREATE OR REPLACE FUNCTION trg_evaluar_stock_bajo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_sucursal_id UUID;
    v_producto_id UUID;
    v_stock_total DECIMAL(10,3);
    v_stock_minimo NUMERIC;
BEGIN
    v_sucursal_id := NEW.sucursal_id;
    v_producto_id := NEW.producto_id;
    
    IF v_sucursal_id IS NULL OR v_sucursal_id = '00000000-0000-0000-0000-000000000001' THEN
        RETURN NEW;
    END IF;
    
    IF NEW.estado != 'disponible' THEN
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        IF OLD.cantidad_disponible IS NOT DISTINCT FROM NEW.cantidad_disponible THEN
            RETURN NEW;
        END IF;
    END IF;
    
    SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_total
    FROM lotes l
    WHERE l.producto_id = v_producto_id
      AND l.sucursal_id = v_sucursal_id
      AND l.estado = 'disponible';
    
    v_stock_minimo := fn_obtener_stock_minimo_producto_sucursal(v_producto_id, v_sucursal_id);
    
    IF v_stock_total < v_stock_minimo THEN
        PERFORM pg_notify('stock_bajo', json_build_object(
            'sucursal_id', v_sucursal_id,
            'producto_id', v_producto_id,
            'stock_actual', v_stock_total,
            'stock_minimo', v_stock_minimo
        )::TEXT);
        
        PERFORM fn_crear_solicitud_transferencia_automatica(
            v_sucursal_id,
            v_producto_id,
            NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluar_stock_bajo ON lotes;
CREATE TRIGGER trg_evaluar_stock_bajo
    AFTER INSERT OR UPDATE OF cantidad_disponible ON lotes
    FOR EACH ROW
    EXECUTE FUNCTION trg_evaluar_stock_bajo();

COMMIT;









