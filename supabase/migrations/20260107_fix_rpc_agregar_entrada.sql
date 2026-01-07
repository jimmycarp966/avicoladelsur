-- =====================================================
-- FIX MÓDULO DE PRODUCCIÓN: ACTUALIZAR RPC AGREGAR ENTRADA
-- Migración: 20260107_fix_rpc_agregar_entrada.sql
-- =====================================================

-- Actualizar fn_agregar_entrada_stock para aceptar nuevos parámetros de rendimiento y desperdicio
CREATE OR REPLACE FUNCTION fn_agregar_entrada_stock(
    p_orden_id UUID,
    p_producto_id UUID,
    p_destino_id UUID,
    p_peso_kg DECIMAL,
    p_cantidad INTEGER DEFAULT 1,
    p_plu VARCHAR DEFAULT NULL,
    p_fecha_vencimiento DATE DEFAULT NULL,
    p_pesaje_id UUID DEFAULT NULL,
    p_merma_esperada_kg DECIMAL DEFAULT 0,
    p_peso_esperado_kg DECIMAL DEFAULT NULL,
    p_es_desperdicio_solido BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_orden RECORD;
    v_entrada_id UUID;
    v_es_destino_valido BOOLEAN;
BEGIN
    -- Validar orden
    SELECT * INTO v_orden FROM ordenes_produccion WHERE id = p_orden_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
    END IF;
    
    IF v_orden.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La orden no está en proceso');
    END IF;
    
    -- Validar que el producto pertenezca al destino indicado
    SELECT EXISTS (
        SELECT 1 FROM destino_productos 
        WHERE destino_id = p_destino_id AND producto_id = p_producto_id
    ) INTO v_es_destino_valido;
    
    IF NOT v_es_destino_valido THEN
        RETURN jsonb_build_object('success', false, 'error', 'El producto no pertenece al destino indicado');
    END IF;
    
    -- Insertar entrada (producto generado)
    INSERT INTO orden_produccion_entradas (
        orden_id,
        producto_id,
        destino_id,
        peso_kg,
        cantidad,
        plu,
        fecha_vencimiento,
        pesaje_id,
        merma_esperada_kg,
        peso_esperado_kg,
        es_desperdicio_solido
    ) VALUES (
        p_orden_id,
        p_producto_id,
        p_destino_id,
        p_peso_kg,
        p_cantidad,
        p_plu,
        p_fecha_vencimiento,
        p_pesaje_id,
        p_merma_esperada_kg,
        p_peso_esperado_kg,
        p_es_desperdicio_solido
    ) RETURNING id INTO v_entrada_id;
    
    -- Actualizar totales de la orden
    UPDATE ordenes_produccion
    SET peso_total_salida = (
        SELECT COALESCE(SUM(peso_kg), 0)
        FROM orden_produccion_entradas
        WHERE orden_id = p_orden_id
    ),
    updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object('success', true, 'entrada_id', v_entrada_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
