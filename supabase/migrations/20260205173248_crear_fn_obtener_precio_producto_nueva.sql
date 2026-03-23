
CREATE OR REPLACE FUNCTION public.fn_obtener_precio_producto(
    p_producto_id UUID, 
    p_lista_precio_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_precio DECIMAL(10,2);
    v_precio_costo DECIMAL(10,2);
    v_margen_ganancia DECIMAL(5,2);
BEGIN
    -- 1. PRIMERO: Buscar precio explícito en precios_productos
    SELECT precio INTO v_precio
    FROM precios_productos
    WHERE producto_id = p_producto_id
      AND lista_precio_id = p_lista_precio_id;

    -- 2. Si encontró un precio > 0, retornar ese precio
    IF v_precio IS NOT NULL AND v_precio > 0 THEN
        RETURN v_precio;
    END IF;

    -- 3. Si NO encontró o el precio es NULL/0, usar la lógica actual (margen + costo)
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

    -- 4. Si eso también da NULL, usar precio_venta de productos
    IF v_precio IS NULL OR v_precio = 0 THEN
        SELECT precio_venta INTO v_precio
        FROM productos
        WHERE id = p_producto_id;
    END IF;

    -- 5. Si todo falla, retornar 0
    RETURN COALESCE(v_precio, 0);
END;
$function$;
;
