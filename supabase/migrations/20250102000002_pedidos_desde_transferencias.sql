-- ===========================================
-- MIGRACIÓN: Generación de Pedidos desde Transferencias
-- Fecha: 2025-01-02
-- Descripción: Genera pedidos automáticamente cuando una transferencia pasa a en_transito
-- ===========================================

BEGIN;

-- ===========================================
-- AGREGAR CAMPO TRANSFERENCIA_ID A PEDIDOS
-- ===========================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos' 
        AND column_name = 'transferencia_id'
    ) THEN
        ALTER TABLE pedidos 
        ADD COLUMN transferencia_id UUID REFERENCES transferencias_stock(id);
        
        -- Crear índice para optimizar búsquedas
        CREATE INDEX IF NOT EXISTS idx_pedidos_transferencia_id ON pedidos(transferencia_id);
    END IF;
END $$;

-- ===========================================
-- FUNCIÓN: Crear pedido desde transferencia
-- ===========================================

CREATE OR REPLACE FUNCTION fn_crear_pedido_desde_transferencia(
    p_transferencia_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transferencia RECORD;
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_item RECORD;
    v_total_items DECIMAL(10,2) := 0;
    v_total_con_recargo DECIMAL(10,2) := 0;
    v_precio_unitario DECIMAL(10,2);
    v_subtotal DECIMAL(10,2);
    v_existe_pedido BOOLEAN;
BEGIN
    -- Obtener información de la transferencia
    SELECT * INTO v_transferencia
    FROM transferencias_stock
    WHERE id = p_transferencia_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Transferencia no encontrada'
        );
    END IF;
    
    -- Verificar que la transferencia esté en estado 'preparado' o 'en_ruta' (flujo integrado con presupuestos)
    -- También acepta 'en_transito' para compatibilidad con flujo antiguo
    IF v_transferencia.estado NOT IN ('preparado', 'en_ruta', 'en_transito') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Solo se pueden generar pedidos de transferencias preparadas o en ruta. Estado actual: ' || v_transferencia.estado
        );
    END IF;
    
    -- Verificar que no exista ya un pedido para esta transferencia
    SELECT EXISTS (
        SELECT 1 FROM pedidos 
        WHERE transferencia_id = p_transferencia_id
    ) INTO v_existe_pedido;
    
    IF v_existe_pedido THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ya existe un pedido para esta transferencia'
        );
    END IF;
    
    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || v_transferencia.numero_transferencia;
    
    -- Calcular totales desde los items de la transferencia
    FOR v_item IN
        SELECT 
            ti.*,
            p.precio_venta,
            p.nombre as producto_nombre
        FROM transferencia_items ti
        INNER JOIN productos p ON p.id = ti.producto_id
        WHERE ti.transferencia_id = p_transferencia_id
          AND ti.cantidad_enviada IS NOT NULL
          AND ti.cantidad_enviada > 0
    LOOP
        v_precio_unitario := COALESCE(v_item.precio_venta, 0);
        v_subtotal := v_item.cantidad_enviada * v_precio_unitario;
        v_total_items := v_total_items + v_subtotal;
    END LOOP;
    
    v_total_con_recargo := v_total_items; -- Sin recargos para transferencias internas
    
    -- Crear pedido
    INSERT INTO pedidos (
        numero_pedido,
        sucursal_id,
        estado,
        tipo_pedido,
        origen,
        subtotal,
        total,
        total_final,
        observaciones,
        transferencia_id,
        turno,
        pago_estado
    ) VALUES (
        v_numero_pedido,
        v_transferencia.sucursal_destino_id,
        'preparando',
        'transferencia',
        'transferencia_interna',
        v_total_items,
        v_total_con_recargo,
        v_total_con_recargo,
        'Pedido generado automáticamente desde transferencia ' || v_transferencia.numero_transferencia || 
        ' (' || (SELECT nombre FROM sucursales WHERE id = v_transferencia.sucursal_origen_id) || 
        ' → ' || (SELECT nombre FROM sucursales WHERE id = v_transferencia.sucursal_destino_id) || ')',
        p_transferencia_id,
        'mañana', -- Turno por defecto para transferencias
        'pendiente'
    ) RETURNING id INTO v_pedido_id;
    
    -- Crear detalles del pedido desde los items de la transferencia
    FOR v_item IN
        SELECT 
            ti.*,
            p.precio_venta,
            p.nombre as producto_nombre
        FROM transferencia_items ti
        INNER JOIN productos p ON p.id = ti.producto_id
        WHERE ti.transferencia_id = p_transferencia_id
          AND ti.cantidad_enviada IS NOT NULL
          AND ti.cantidad_enviada > 0
    LOOP
        v_precio_unitario := COALESCE(v_item.precio_venta, 0);
        v_subtotal := v_item.cantidad_enviada * v_precio_unitario;
        
        INSERT INTO detalles_pedido (
            pedido_id,
            producto_id,
            cantidad,
            precio_unitario,
            subtotal
        ) VALUES (
            v_pedido_id,
            v_item.producto_id,
            v_item.cantidad_enviada,
            v_precio_unitario,
            v_subtotal
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'transferencia_id', p_transferencia_id,
        'total', v_total_con_recargo
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
-- TRIGGER: Generar pedido automáticamente cuando transferencia pasa a en_transito
-- ===========================================

CREATE OR REPLACE FUNCTION trg_crear_pedido_transferencia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    -- Ejecutar cuando el estado cambia a 'preparado' o 'en_ruta' (flujo integrado con presupuestos)
    -- También acepta 'en_transito' para compatibilidad con flujo antiguo
    IF NEW.estado IN ('preparado', 'en_ruta', 'en_transito') 
       AND (OLD.estado IS NULL OR OLD.estado NOT IN ('preparado', 'en_ruta', 'en_transito')) THEN
        -- Ejecutar función para crear pedido
        v_resultado := fn_crear_pedido_desde_transferencia(NEW.id, COALESCE(NEW.preparado_por, NEW.aprobado_por));
        
        -- Si hay error, registrarlo pero no bloquear la transacción
        IF v_resultado->>'success' != 'true' THEN
            RAISE WARNING 'Error al crear pedido desde transferencia %: %', NEW.id, v_resultado->>'error';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trg_crear_pedido_transferencia ON transferencias_stock;
CREATE TRIGGER trg_crear_pedido_transferencia
    AFTER UPDATE OF estado ON transferencias_stock
    FOR EACH ROW
    WHEN (NEW.estado IN ('preparado', 'en_ruta', 'en_transito') 
          AND (OLD.estado IS NULL OR OLD.estado NOT IN ('preparado', 'en_ruta', 'en_transito')))
    EXECUTE FUNCTION trg_crear_pedido_transferencia();

COMMIT;

-- Comentarios para documentación
COMMENT ON COLUMN pedidos.transferencia_id IS 'ID de la transferencia que generó este pedido (si aplica)';
COMMENT ON FUNCTION fn_crear_pedido_desde_transferencia IS 'Crea un pedido tipo transferencia desde una transferencia en tránsito';
COMMENT ON FUNCTION trg_crear_pedido_transferencia IS 'Trigger que genera pedido automáticamente cuando una transferencia pasa a estado en_transito';

