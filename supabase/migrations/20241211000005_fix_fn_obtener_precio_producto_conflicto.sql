-- ===========================================
-- MIGRACIÓN: Eliminar conflicto de fn_obtener_precio_producto
-- Fecha: 11/12/2024
-- Descripción: Eliminar todas las versiones de la función y dejar solo
--   la versión correcta con 2 parámetros que usa margen de ganancia
-- ===========================================

BEGIN;

-- Eliminar TODAS las versiones de fn_obtener_precio_producto
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc 
        WHERE proname = 'fn_obtener_precio_producto'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;

-- Crear SOLO la versión correcta con 2 parámetros que usa margen
CREATE OR REPLACE FUNCTION fn_obtener_precio_producto(
    p_lista_precio_id UUID,
    p_producto_id UUID
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_precio DECIMAL(10,2);
    v_precio_costo DECIMAL(10,2);
    v_margen_ganancia DECIMAL(5,2);
BEGIN
    -- Obtener margen de ganancia de la lista y precio_costo del producto
    SELECT lp.margen_ganancia, p.precio_costo
    INTO v_margen_ganancia, v_precio_costo
    FROM listas_precios lp
    CROSS JOIN productos p
    WHERE lp.id = p_lista_precio_id
      AND p.id = p_producto_id;

    -- Calcular precio desde margen si está disponible
    IF v_margen_ganancia IS NOT NULL AND v_margen_ganancia > 0 
       AND v_precio_costo IS NOT NULL AND v_precio_costo > 0 THEN
        v_precio := v_precio_costo * (1 + v_margen_ganancia / 100);
    END IF;

    -- Si no hay margen o costo, usar precio_venta como fallback
    IF v_precio IS NULL THEN
        SELECT precio_venta INTO v_precio
        FROM productos
        WHERE id = p_producto_id;
    END IF;

    -- Si aún es NULL, retornar 0
    RETURN COALESCE(v_precio, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;

