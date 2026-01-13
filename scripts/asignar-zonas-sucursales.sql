-- ===========================================
-- SCRIPT: Asignar Zonas a Sucursales
-- Fecha: 2026-01-13
-- ===========================================

-- Este script asigna zonas a las 4 sucursales:
-- - 3 sucursales → Zona Monteros
-- - 1 sucursal → Zona Simoca

-- ===========================================
-- PASO 1: Verificar y crear zonas si no existen
-- ===========================================

-- Insertar zona Monteros si no existe
INSERT INTO zonas (nombre, descripcion)
VALUES ('Monteros', 'Zona de reparto Monteros')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar zona Simoca si no existe
INSERT INTO zonas (nombre, descripcion)
VALUES ('Simoca', 'Zona de reparto Simoca')
ON CONFLICT (nombre) DO NOTHING;

-- ===========================================
-- PASO 2: Obtener IDs de zonas
-- ===========================================

DO $$
DECLARE
    v_zona_monteros_id UUID;
    v_zona_simoca_id UUID;
BEGIN
    -- Obtener ID de zona Monteros
    SELECT id INTO v_zona_monteros_id
    FROM zonas
    WHERE nombre = 'Monteros'
    LIMIT 1;

    -- Obtener ID de zona Simoca
    SELECT id INTO v_zona_simoca_id
    FROM zonas
    WHERE nombre = 'Simoca'
    LIMIT 1;

    -- ===========================================
    -- PASO 3: Asignar zonas a sucursales
    -- ===========================================

    -- NOTA: Ajusta los nombres de las sucursales según corresponda
    -- Las 3 primeras sucursales van a Monteros
    -- La última sucursal va a Simoca

    -- Asignar zona Monteros a las primeras 3 sucursales
    UPDATE sucursales
    SET zona_id = v_zona_monteros_id
    WHERE id IN (
        SELECT id
        FROM sucursales
        WHERE activo = true
        ORDER BY nombre
        LIMIT 3
    );

    -- Asignar zona Simoca a la última sucursal
    UPDATE sucursales
    SET zona_id = v_zona_simoca_id
    WHERE id IN (
        SELECT id
        FROM sucursales
        WHERE activo = true
        AND zona_id IS NULL
        LIMIT 1
    );

    RAISE NOTICE 'Zonas asignadas exitosamente a las sucursales';
    RAISE NOTICE 'Zona Monteros ID: %', v_zona_monteros_id;
    RAISE NOTICE 'Zona Simoca ID: %', v_zona_simoca_id;
END $$;

-- ===========================================
-- PASO 4: Verificar asignación
-- ===========================================

SELECT 
    s.id,
    s.nombre,
    s.direccion,
    z.nombre as zona_nombre,
    z.id as zona_id
FROM sucursales s
LEFT JOIN zonas z ON s.zona_id = z.id
WHERE s.activo = true
ORDER BY z.nombre, s.nombre;
