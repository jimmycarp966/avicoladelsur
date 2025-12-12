-- RPC Function para obtener cliente con coordenadas en formato JSON
-- Necesaria porque Supabase no soporta ST_AsGeoJSON en consultas directas

CREATE OR REPLACE FUNCTION fn_get_cliente_con_coordenadas(p_cliente_id UUID)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  telefono TEXT,
  direccion TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nombre::TEXT,
    c.telefono::TEXT,
    c.direccion::TEXT,
    ST_Y(c.coordenadas::geometry) as lat,
    ST_X(c.coordenadas::geometry) as lng
  FROM clientes c
  WHERE c.id = p_cliente_id;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION fn_get_cliente_con_coordenadas(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_cliente_con_coordenadas(UUID) TO service_role;
