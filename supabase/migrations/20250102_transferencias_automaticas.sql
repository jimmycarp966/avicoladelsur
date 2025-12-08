-- ===========================================
-- MIGRACIÓN: Sistema de Transferencias Automáticas
-- Fecha: 2025-01-02
-- Descripción: Implementa transferencias automáticas basadas en stock mínimo
-- ===========================================

BEGIN;

-- ===========================================
-- AGREGAR CAMPOS A TRANSFERENCIAS_STOCK
-- ===========================================

-- Agregar columna origen si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transferencias_stock' 
        AND column_name = 'origen'
    ) THEN
        ALTER TABLE transferencias_stock 
        ADD COLUMN origen VARCHAR(20) DEFAULT 'manual' 
        CHECK (origen IN ('manual', 'automatica'));
        
        -- Actualizar registros existentes
        UPDATE transferencias_stock SET origen = 'manual' WHERE origen IS NULL;
    END IF;
END $$;

-- Agregar columna cantidad_sugerida a transferencia_items si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transferencia_items' 
        AND column_name = 'cantidad_sugerida'
    ) THEN
        ALTER TABLE transferencia_items 
        ADD COLUMN cantidad_sugerida DECIMAL(10,3);
    END IF;
END $$;

-- Actualizar constraint de estado para incluir 'solicitud_automatica'
-- Mantener compatibilidad con todos los estados del flujo integrado con presupuestos
DO $$
BEGIN
    -- Primero eliminar el constraint existente si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transferencias_stock_estado_check'
        AND table_name = 'transferencias_stock'
    ) THEN
        ALTER TABLE transferencias_stock 
        DROP CONSTRAINT transferencias_stock_estado_check;
    END IF;
    
    -- Crear nuevo constraint con todos los estados posibles
    -- Estados del flujo integrado: solicitud, en_almacen, preparado, en_ruta, entregado, recibido
    -- Estados del flujo antiguo: pendiente, en_transito, recibida
    -- Estados especiales: solicitud_automatica, cancelada
    ALTER TABLE transferencias_stock 
    ADD CONSTRAINT transferencias_stock_estado_check 
    CHECK (estado IN (
        'solicitud', 'en_almacen', 'preparado', 'en_ruta', 'entregado', 'recibido',
        'pendiente', 'en_transito', 'recibida',
        'solicitud_automatica', 'cancelada'
    ));
END $$;

-- ===========================================
-- FUNCIÓN: Crear solicitud de transferencia automática
-- ===========================================

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
    v_stock_minimo INTEGER;
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
    
    v_stock_minimo := COALESCE(v_producto.stock_minimo, 0);
    
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
        -- Crear o actualizar alerta de stock
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
        -- Sugerir cantidad para llegar al stock mínimo + margen de seguridad (50% del mínimo)
        v_cantidad_sugerida := GREATEST(
            v_stock_minimo - v_stock_destino + (v_stock_minimo * 0.5),
            1
        );
        -- No exceder el stock disponible en origen
        v_cantidad_sugerida := LEAST(v_cantidad_sugerida, v_stock_origen);
    ELSE
        v_cantidad_sugerida := p_cantidad_sugerida;
    END IF;
    
    -- Calcular turno y fecha de entrega automáticamente (igual que presupuestos)
    -- Usar la misma función que presupuestos para calcular turno y fecha
    SELECT t.turno, t.fecha_entrega INTO v_turno, v_fecha_entrega
    FROM fn_calcular_turno_fecha_entrega(NULL) t;
    
    -- Obtener zona de la sucursal destino (para integración con rutas)
    SELECT z.id INTO v_zona_id
    FROM sucursales s
    LEFT JOIN zonas z ON LOWER(TRIM(z.nombre)) = LOWER(TRIM(s.direccion))
    WHERE s.id = p_sucursal_destino_id
    LIMIT 1;
    
    -- Generar número de transferencia único
    v_numero_transferencia := 'TRANS-AUTO-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    
    -- Crear transferencia con estado 'solicitud_automatica' (será aprobada y pasará a 'en_almacen')
    -- Incluye turno y fecha_entrega para que cuando se apruebe aparezca en "Presupuestos del Día"
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
    
    -- Crear item de transferencia con cantidad sugerida
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
    
    -- Crear notificación para administradores
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

-- ===========================================
-- FUNCIÓN: Reservar stock al aprobar solicitud automática
-- ===========================================

CREATE OR REPLACE FUNCTION fn_reservar_stock_solicitud_automatica(
    p_transferencia_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transferencia RECORD;
    v_item RECORD;
    v_lote_id UUID;
    v_stock_disponible DECIMAL(10,3);
BEGIN
    -- Obtener transferencia
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
    END IF;
    
    -- Reservar stock para cada item (descontar del disponible)
    FOR v_item IN
        SELECT * FROM transferencia_items WHERE transferencia_id = p_transferencia_id
    LOOP
        -- Verificar stock disponible
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = v_item.producto_id
        AND l.sucursal_id = v_transferencia.sucursal_origen_id
        AND l.estado = 'disponible';
        
        IF v_stock_disponible < v_item.cantidad_solicitada THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Stock insuficiente para reservar. Disponible: ' || v_stock_disponible || ', Solicitado: ' || v_item.cantidad_solicitada
            );
        END IF;
        
        -- Reservar stock (descontar del disponible) usando FIFO
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible - v_item.cantidad_solicitada,
            updated_at = NOW()
        WHERE id = (
            SELECT id FROM lotes
            WHERE producto_id = v_item.producto_id
            AND sucursal_id = v_transferencia.sucursal_origen_id
            AND estado = 'disponible'
            AND cantidad_disponible >= v_item.cantidad_solicitada
            ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC
            LIMIT 1
        );
    END LOOP;
    
    RETURN jsonb_build_object('success', true, 'message', 'Stock reservado exitosamente');
END;
$$;

-- ===========================================
-- FUNCIÓN: Evaluar stock bajo y crear solicitudes automáticas
-- ===========================================

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
    v_stock_minimo INTEGER;
    v_resultado JSONB;
    v_resultados JSONB[] := '{}';
    v_total_solicitudes INTEGER := 0;
    v_total_alertas INTEGER := 0;
BEGIN
    -- Si se especifica un producto, evaluar solo ese
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
        
        -- Calcular stock total en la sucursal
        SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_total
        FROM lotes l
        WHERE l.producto_id = p_producto_id
          AND l.sucursal_id = p_sucursal_id
          AND l.estado = 'disponible';
        
        v_stock_minimo := COALESCE(v_producto.stock_minimo, 0);
        
        -- Si está por debajo del mínimo, crear solicitud
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
        -- Evaluar todos los productos de la sucursal
        FOR v_producto IN
            SELECT DISTINCT p.id, p.nombre, p.stock_minimo
            FROM productos p
            INNER JOIN lotes l ON l.producto_id = p.id
            WHERE l.sucursal_id = p_sucursal_id
              AND p.activo = true
        LOOP
            -- Calcular stock total del producto en la sucursal
            SELECT COALESCE(SUM(l2.cantidad_disponible), 0) INTO v_stock_total
            FROM lotes l2
            WHERE l2.producto_id = v_producto.id
              AND l2.sucursal_id = p_sucursal_id
              AND l2.estado = 'disponible';
            
            v_stock_minimo := COALESCE(v_producto.stock_minimo, 0);
            
            -- Si está por debajo del mínimo, crear solicitud
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

-- ===========================================
-- TRIGGER: Evaluar stock bajo cuando cambia cantidad_disponible
-- ===========================================

CREATE OR REPLACE FUNCTION trg_evaluar_stock_bajo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_sucursal_id UUID;
    v_producto_id UUID;
    v_stock_total DECIMAL(10,3);
    v_stock_minimo INTEGER;
BEGIN
    -- Obtener sucursal y producto del lote modificado
    -- En INSERT, OLD no existe, así que usar NEW
    -- En UPDATE, usar NEW (que tiene los valores actualizados)
    v_sucursal_id := NEW.sucursal_id;
    v_producto_id := NEW.producto_id;
    
    -- Solo evaluar si hay sucursal asignada (no Casa Central para evitar loops)
    IF v_sucursal_id IS NULL OR v_sucursal_id = '00000000-0000-0000-0000-000000000001' THEN
        RETURN NEW;
    END IF;
    
    -- Solo evaluar si el lote está disponible
    IF NEW.estado != 'disponible' THEN
        RETURN NEW;
    END IF;
    
    -- En UPDATE, solo evaluar si cantidad_disponible cambió
    -- En INSERT (TG_OP = 'INSERT'), siempre evaluar porque OLD no existe
    IF TG_OP = 'UPDATE' THEN
        -- Si la cantidad no cambió, no hacer nada
        IF OLD.cantidad_disponible IS NOT DISTINCT FROM NEW.cantidad_disponible THEN
            RETURN NEW;
        END IF;
    END IF;
    -- Si es INSERT, continuar con la evaluación
    
    -- Calcular stock total del producto en la sucursal
    SELECT COALESCE(SUM(l.cantidad_disponible), 0) INTO v_stock_total
    FROM lotes l
    WHERE l.producto_id = v_producto_id
      AND l.sucursal_id = v_sucursal_id
      AND l.estado = 'disponible';
    
    -- Obtener stock mínimo del producto
    SELECT COALESCE(stock_minimo, 0) INTO v_stock_minimo
    FROM productos
    WHERE id = v_producto_id AND activo = true;
    
    -- Si el stock está por debajo del mínimo, crear solicitud automática
    IF v_stock_total < v_stock_minimo THEN
        -- Ejecutar en background para no bloquear la transacción
        PERFORM pg_notify('stock_bajo', json_build_object(
            'sucursal_id', v_sucursal_id,
            'producto_id', v_producto_id,
            'stock_actual', v_stock_total,
            'stock_minimo', v_stock_minimo
        )::TEXT);
        
        -- También ejecutar directamente (puede ser más lento pero más confiable)
        PERFORM fn_crear_solicitud_transferencia_automatica(
            v_sucursal_id,
            v_producto_id,
            NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trg_evaluar_stock_bajo ON lotes;
CREATE TRIGGER trg_evaluar_stock_bajo
    AFTER INSERT OR UPDATE OF cantidad_disponible ON lotes
    FOR EACH ROW
    EXECUTE FUNCTION trg_evaluar_stock_bajo();

COMMIT;

-- Comentarios para documentación
COMMENT ON FUNCTION fn_crear_solicitud_transferencia_automatica IS 'Crea una solicitud automática de transferencia cuando una sucursal tiene stock bajo';
COMMENT ON FUNCTION fn_evaluar_stock_bajo_y_crear_solicitudes IS 'Evalúa todos los productos de una sucursal y crea solicitudes automáticas para los que están bajo stock mínimo';
COMMENT ON FUNCTION trg_evaluar_stock_bajo IS 'Trigger que evalúa stock bajo en tiempo real cuando cambia cantidad_disponible en lotes';

