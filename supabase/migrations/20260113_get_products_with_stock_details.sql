-- Function to get products with detailed stock information
-- Returns stock_real (total physical), stock_reservado (preventive), and stock_disponible (real - reserved)

CREATE OR REPLACE FUNCTION public.fn_obtener_productos_con_stock_detalle()
RETURNS TABLE (
    id uuid,
    codigo text,
    nombre text,
    descripcion text,
    categoria text,
    precio_venta numeric,
    precio_costo numeric,
    unidad_medida text,
    stock_minimo integer,
    activo boolean,
    created_at timestamptz,
    updated_at timestamptz,
    pesable boolean,
    stock_disponible numeric,
    stock_real numeric,
    stock_reservado numeric,
    venta_mayor_habilitada boolean,
    unidad_mayor_nombre text,
    kg_por_unidad_mayor numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.codigo::text,
        p.nombre::text,
        p.descripcion,
        p.categoria::text,
        p.precio_venta,
        p.precio_costo,
        p.unidad_medida::text,
        p.stock_minimo,
        p.activo,
        p.created_at,
        p.updated_at,
        p.pesable,
        -- Stock disponible (calculated same as calcular_stock_disponible)
        GREATEST(
            COALESCE(SUM(l.cantidad_disponible) FILTER (WHERE l.estado = 'disponible' AND l.cantidad_disponible > 0 AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= fn_today_argentina())), 0) -
            COALESCE(SUM(sr.cantidad) FILTER (WHERE sr.estado = 'activa' AND sr.expires_at > fn_now_argentina()), 0),
            0
        )::numeric as stock_disponible,
        -- Stock Real (Total physical available in batches)
        COALESCE(SUM(l.cantidad_disponible) FILTER (WHERE l.estado = 'disponible' AND l.cantidad_disponible > 0 AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= fn_today_argentina())), 0)::numeric as stock_real,
        -- Stock Reservado (Preventive)
        COALESCE(SUM(sr.cantidad) FILTER (WHERE sr.estado = 'activa' AND sr.expires_at > fn_now_argentina()), 0)::numeric as stock_reservado,
        p.venta_mayor_habilitada,
        p.unidad_mayor_nombre::text,
        p.kg_por_unidad_mayor
    FROM productos p
    LEFT JOIN lotes l ON p.id = l.producto_id AND l.estado = 'disponible'
    LEFT JOIN stock_reservations sr ON p.id = sr.producto_id AND sr.estado = 'activa'
    WHERE p.activo = true
    GROUP BY p.id
    ORDER BY p.nombre;
END;
$function$;
