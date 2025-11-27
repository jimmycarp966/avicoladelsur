-- ===========================================
-- MIGRACIÓN: Agregar campo margen_ganancia a listas_precios
-- Fecha: 15/01/2025
-- ===========================================

BEGIN;

-- Agregar columna margen_ganancia si no existe
ALTER TABLE listas_precios 
ADD COLUMN IF NOT EXISTS margen_ganancia DECIMAL(5,2);

-- Actualizar función fn_obtener_precio_producto para usar margen
CREATE OR REPLACE FUNCTION fn_obtener_precio_producto(
    p_lista_precio_id UUID,
    p_producto_id UUID
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_precio DECIMAL(10,2);
    v_precio_costo DECIMAL(10,2);
    v_margen_ganancia DECIMAL(5,2);
BEGIN
    -- Buscar precio en la lista específica (activo y vigente)
    SELECT precio INTO v_precio
    FROM precios_productos
    WHERE lista_precio_id = p_lista_precio_id
      AND producto_id = p_producto_id
      AND activo = true
      AND (fecha_desde IS NULL OR fecha_desde <= CURRENT_DATE)
      AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
    ORDER BY fecha_desde DESC NULLS LAST
    LIMIT 1;

    -- Si no se encuentra precio manual, calcular desde margen de ganancia de la lista
    IF v_precio IS NULL THEN
        -- Obtener margen de ganancia de la lista y precio_costo del producto
        SELECT lp.margen_ganancia, p.precio_costo
        INTO v_margen_ganancia, v_precio_costo
        FROM listas_precios lp
        CROSS JOIN productos p
        WHERE lp.id = p_lista_precio_id
          AND p.id = p_producto_id;

        -- Si hay margen configurado y precio_costo disponible, calcular precio
        IF v_margen_ganancia IS NOT NULL AND v_margen_ganancia > 0 
           AND v_precio_costo IS NOT NULL AND v_precio_costo > 0 THEN
            v_precio := v_precio_costo * (1 + v_margen_ganancia / 100);
        END IF;
    END IF;

    -- Si aún no hay precio, usar precio_venta del producto como fallback
    IF v_precio IS NULL THEN
        SELECT precio_venta INTO v_precio
        FROM productos
        WHERE id = p_producto_id;
    END IF;

    -- Si aún es NULL, retornar 0
    RETURN COALESCE(v_precio, 0);
END;
$$ LANGUAGE plpgsql;

COMMIT;

