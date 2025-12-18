-- DIAGNÓSTICO: Verificar rutas_planificadas para rutas activas
-- Ejecutar en Supabase SQL Editor

-- 1. Ver rutas activas
SELECT 
  r.id as ruta_id,
  r.numero_ruta,
  r.estado
FROM rutas_reparto r
WHERE r.estado IN ('planificada', 'en_curso')
ORDER BY r.fecha_ruta DESC;

-- 2. Ver rutas_planificadas para las rutas activas
SELECT 
  rp.id,
  rp.ruta_reparto_id,
  rp.estado as estado_planificacion,
  rp.polyline IS NOT NULL as tiene_polyline,
  rp.orden_visita IS NOT NULL as tiene_orden_visita,
  CASE 
    WHEN rp.orden_visita IS NULL THEN 0
    ELSE jsonb_array_length(rp.orden_visita::jsonb)
  END as cantidad_entregas
FROM rutas_planificadas rp
JOIN rutas_reparto r ON r.id = rp.ruta_reparto_id
WHERE r.estado IN ('planificada', 'en_curso');

-- 3. Si hay orden_visita, verificar que tenga lat/lng
SELECT 
  rp.ruta_reparto_id,
  jsonb_array_elements(rp.orden_visita::jsonb) as punto
FROM rutas_planificadas rp
JOIN rutas_reparto r ON r.id = rp.ruta_reparto_id
WHERE r.estado IN ('planificada', 'en_curso')
  AND rp.orden_visita IS NOT NULL
LIMIT 10;
