-- ===========================================
-- FIX: fn_obtener_ultima_ubicacion_por_vehiculo
-- Elimina la referencia a r.zona_id que no existe en la tabla rutas_reparto
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_ultima_ubicacion_por_vehiculo(
    p_fecha DATE DEFAULT CURRENT_DATE,
    p_zona_id UUID DEFAULT NULL
)
RETURNS TABLE (
    vehiculo_id UUID,
    repartidor_id UUID,
    repartidor_nombre TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ,
    ruta_activa_id UUID,
    ruta_numero TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH ultimas_ubicaciones AS (
        SELECT DISTINCT ON (u.vehiculo_id)
            u.vehiculo_id,
            u.repartidor_id,
            u.lat,
            u.lng,
            u.created_at
        FROM ubicaciones_repartidores u
        WHERE DATE(u.created_at) = p_fecha
        ORDER BY u.vehiculo_id, u.created_at DESC
    )
    SELECT 
        uu.vehiculo_id,
        uu.repartidor_id,
        CONCAT(us.nombre, ' ', COALESCE(us.apellido, '')) AS repartidor_nombre,
        uu.lat,
        uu.lng,
        uu.created_at,
        r.id AS ruta_activa_id,
        r.numero_ruta AS ruta_numero
    FROM ultimas_ubicaciones uu
    LEFT JOIN usuarios us ON us.id = uu.repartidor_id
    LEFT JOIN rutas_reparto r ON r.vehiculo_id = uu.vehiculo_id 
        AND r.estado IN ('planificada', 'en_curso')
        AND r.fecha_ruta = p_fecha
    -- Se ha eliminado el filtro por zona_id porque la columna no existe en rutas_reparto
    -- WHERE (p_zona_id IS NULL OR r.zona_id = p_zona_id)
    ORDER BY uu.created_at DESC;
END;
$$ LANGUAGE plpgsql;
