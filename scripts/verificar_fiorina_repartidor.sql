-- ===========================================
-- SCRIPT: Verificar asignación de Fiorina al repartidor
-- ===========================================
-- Este script muestra la información del repartidor y su vehículo asignado

SELECT 
    u.id,
    u.email,
    u.nombre,
    u.apellido,
    u.rol,
    u.activo,
    u.vehiculo_asignado,
    v.patente AS vehiculo_patente,
    v.marca AS vehiculo_marca,
    v.modelo AS vehiculo_modelo,
    v.capacidad_kg AS vehiculo_capacidad_kg,
    CASE 
        WHEN v.capacidad_kg IS NULL THEN 'Sin capacidad definida'
        WHEN v.capacidad_kg <= 700 THEN '✅ Fiorina (vehículo chico)'
        ELSE '❌ Vehículo grande'
    END AS tipo_vehiculo
FROM usuarios u
LEFT JOIN vehiculos v ON v.id = u.vehiculo_asignado
WHERE u.email = 'repartidor@avicoladelsur.com'
   OR u.rol = 'repartidor';

-- ===========================================
-- Verificar cuál es la Fiorina (vehículo más chico)
-- ===========================================
SELECT 
    id,
    patente,
    marca,
    modelo,
    capacidad_kg,
    activo,
    CASE 
        WHEN capacidad_kg IS NULL THEN 'Sin capacidad definida'
        WHEN capacidad_kg <= 700 THEN '✅ Fiorina (vehículo chico)'
        ELSE 'Vehículo grande'
    END AS tipo
FROM vehiculos
WHERE activo = true
ORDER BY 
    CASE WHEN capacidad_kg IS NULL THEN 1 ELSE 0 END,
    capacidad_kg ASC NULLS LAST,
    created_at ASC;

-- ===========================================
-- Verificar que el trigger esté activo
-- ===========================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_mantener_fiorina_repartidor_trigger';

