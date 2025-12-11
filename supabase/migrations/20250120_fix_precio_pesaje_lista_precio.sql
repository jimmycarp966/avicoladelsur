-- ===========================================
-- MIGRACIÓN: Corregir cálculo de precio al pesar producto
-- Fecha: 20/01/2025
-- Objetivo:
--   Al pesar un producto, el precio debe calcularse según la lista de precios
--   del presupuesto o del item, no usar precio_venta directo del producto
-- ===========================================

BEGIN;

-- Actualizar función fn_actualizar_peso_item_presupuesto
CREATE OR REPLACE FUNCTION fn_actualizar_peso_item_presupuesto(
    p_presupuesto_item_id UUID,
    p_peso_final DECIMAL(10,3)
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_presupuesto RECORD;
    v_lista_precio_id UUID;
    v_precio_unit_final DECIMAL(10,2);
    v_subtotal_final DECIMAL(10,2);
BEGIN
    -- Obtener datos del item con información del presupuesto
    SELECT 
        pi.*,
        p.lista_precio_id as presupuesto_lista_precio_id
    INTO v_item
    FROM presupuesto_items pi
    INNER JOIN presupuestos p ON p.id = pi.presupuesto_id
    WHERE pi.id = p_presupuesto_item_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item de presupuesto no encontrado');
    END IF;

    -- Determinar qué lista_precio_id usar:
    -- 1. Si el item tiene lista_precio_id específica, usar esa
    -- 2. Si no, usar la lista_precio_id del presupuesto
    -- 3. Si ninguna existe, usar precio_venta del producto como fallback
    v_lista_precio_id := COALESCE(v_item.lista_precio_id, v_item.presupuesto_lista_precio_id);

    -- Calcular precio unitario final usando la lista de precios si está disponible
    IF v_lista_precio_id IS NOT NULL THEN
        -- Usar fn_obtener_precio_producto para obtener precio según la lista
        SELECT fn_obtener_precio_producto(v_lista_precio_id, v_item.producto_id) 
        INTO v_precio_unit_final;
    ELSE
        -- Fallback: usar precio_venta del producto si no hay lista
        SELECT precio_venta INTO v_precio_unit_final
        FROM productos
        WHERE id = v_item.producto_id;
    END IF;

    -- Si aún no hay precio, usar 0
    v_precio_unit_final := COALESCE(v_precio_unit_final, 0);

    -- Calcular subtotal final
    v_subtotal_final := p_peso_final * v_precio_unit_final;

    -- Actualizar item
    UPDATE presupuesto_items
    SET peso_final = p_peso_final,
        precio_unit_final = v_precio_unit_final,
        subtotal_final = v_subtotal_final,
        updated_at = NOW()
    WHERE id = p_presupuesto_item_id;

    -- Recalcular total del presupuesto
    UPDATE presupuestos
    SET total_final = (
        SELECT COALESCE(SUM(COALESCE(subtotal_final, subtotal_est)), 0)
        FROM presupuesto_items
        WHERE presupuesto_id = v_item.presupuesto_id
    ),
    updated_at = NOW()
    WHERE id = v_item.presupuesto_id;

    RETURN jsonb_build_object(
        'success', true,
        'precio_unit_final', v_precio_unit_final,
        'subtotal_final', v_subtotal_final,
        'lista_precio_id_usada', v_lista_precio_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_actualizar_peso_item_presupuesto IS 
'Actualiza el peso final de un item de presupuesto y recalcula el precio según la lista de precios.
Prioridad: lista_precio_id del item > lista_precio_id del presupuesto > precio_venta del producto.';

COMMIT;

