-- ===========================================
-- MIGRACIÓN: Planificación Permanente de Rutas
-- Fecha: 2025-12-04
-- Descripción: Crea zonas y planificación semanal permanente para
--              Monteros, Simoca, Concepción y Valles
-- ===========================================

BEGIN;

-- ===========================================
-- 1. CREAR/VERIFICAR ZONAS
-- ===========================================

INSERT INTO zonas (nombre, descripcion, activo) VALUES
    ('Monteros', 'Zona de entrega Monteros - Lunes a Sábado mañana y tarde', true),
    ('Simoca', 'Zona de entrega Simoca - Frecuencias variables', true),
    ('Concepción', 'Zona de entrega Concepción - Lunes, Miércoles, Sábado mañana', true),
    ('Valles', 'Zona de entrega Valles - Lunes, Miércoles, Sábado mañana', true)
ON CONFLICT (nombre) DO UPDATE SET 
    activo = true,
    updated_at = NOW();

-- ===========================================
-- 2. CREAR PLANES PARA 52 SEMANAS
-- ===========================================

DO $$
DECLARE
    v_zona_monteros UUID;
    v_zona_simoca UUID;
    v_zona_concepcion UUID;
    v_zona_valles UUID;
    v_repartidor_id UUID;
    v_semana_actual DATE;
    v_semana DATE;
    v_semana_num INTEGER;
    v_planes_creados INTEGER := 0;
    v_planes_existentes INTEGER := 0;
BEGIN
    -- Obtener IDs de zonas
    SELECT id INTO v_zona_monteros FROM zonas WHERE nombre = 'Monteros' LIMIT 1;
    SELECT id INTO v_zona_simoca FROM zonas WHERE nombre = 'Simoca' LIMIT 1;
    SELECT id INTO v_zona_concepcion FROM zonas WHERE nombre = 'Concepción' LIMIT 1;
    SELECT id INTO v_zona_valles FROM zonas WHERE nombre = 'Valles' LIMIT 1;
    
    -- Verificar que todas las zonas existen
    IF v_zona_monteros IS NULL THEN
        RAISE EXCEPTION 'No se encontró la zona Monteros';
    END IF;
    IF v_zona_simoca IS NULL THEN
        RAISE EXCEPTION 'No se encontró la zona Simoca';
    END IF;
    IF v_zona_concepcion IS NULL THEN
        RAISE EXCEPTION 'No se encontró la zona Concepción';
    END IF;
    IF v_zona_valles IS NULL THEN
        RAISE EXCEPTION 'No se encontró la zona Valles';
    END IF;
    
    -- Obtener ID del repartidor (repartidor@avicoladelsur.com)
    SELECT id INTO v_repartidor_id 
    FROM usuarios 
    WHERE email = 'repartidor@avicoladelsur.com' 
      AND rol = 'repartidor' 
      AND activo = true 
    LIMIT 1;
    
    -- Si no existe el repartidor específico, buscar cualquier repartidor activo
    IF v_repartidor_id IS NULL THEN
        SELECT id INTO v_repartidor_id 
        FROM usuarios 
        WHERE rol = 'repartidor' 
          AND activo = true 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;
    
    -- Verificar que existe al menos un repartidor
    IF v_repartidor_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró ningún repartidor activo. Crea un repartidor antes de ejecutar esta migración.';
    END IF;
    
    -- Calcular el lunes de la semana actual
    v_semana_actual := fn_calcular_inicio_semana(CURRENT_DATE);
    
    RAISE NOTICE 'Zonas encontradas: Monteros=%, Simoca=%, Concepción=%, Valles=%', 
        v_zona_monteros, v_zona_simoca, v_zona_concepcion, v_zona_valles;
    RAISE NOTICE 'Repartidor ID: %', v_repartidor_id;
    RAISE NOTICE 'Semana inicial: %', v_semana_actual;
    
    -- Iterar sobre 52 semanas
    FOR v_semana_num IN 0..51 LOOP
        v_semana := v_semana_actual + (v_semana_num * 7);
        
        -- ===========================================
        -- MONTEROS: Lunes a Sábado - mañana y tarde
        -- Días: 1 (lunes) a 6 (sábado)
        -- ===========================================
        FOR dia IN 1..6 LOOP
            -- Turno mañana
            INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
            VALUES (v_zona_monteros, dia, 'mañana', v_repartidor_id, v_semana, true)
            ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
            
            IF FOUND THEN v_planes_creados := v_planes_creados + 1;
            ELSE v_planes_existentes := v_planes_existentes + 1;
            END IF;
            
            -- Turno tarde
            INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
            VALUES (v_zona_monteros, dia, 'tarde', v_repartidor_id, v_semana, true)
            ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
            
            IF FOUND THEN v_planes_creados := v_planes_creados + 1;
            ELSE v_planes_existentes := v_planes_existentes + 1;
            END IF;
        END LOOP;
        
        -- ===========================================
        -- SIMOCA: Frecuencias variables
        -- Lunes (1): mañana y tarde
        -- Martes a Jueves (2-4): solo tarde
        -- Viernes (5): mañana y tarde
        -- Sábado (6): solo tarde
        -- ===========================================
        
        -- Lunes - mañana y tarde
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_simoca, 1, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_simoca, 1, 'tarde', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- Martes a Jueves - solo tarde
        FOR dia IN 2..4 LOOP
            INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
            VALUES (v_zona_simoca, dia, 'tarde', v_repartidor_id, v_semana, true)
            ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
            IF FOUND THEN v_planes_creados := v_planes_creados + 1;
            ELSE v_planes_existentes := v_planes_existentes + 1;
            END IF;
        END LOOP;
        
        -- Viernes - mañana y tarde
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_simoca, 5, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_simoca, 5, 'tarde', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- Sábado - solo tarde
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_simoca, 6, 'tarde', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- ===========================================
        -- CONCEPCIÓN: Lunes, Miércoles, Sábado - mañana
        -- Días: 1 (lunes), 3 (miércoles), 6 (sábado)
        -- ===========================================
        
        -- Lunes mañana
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_concepcion, 1, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- Miércoles mañana
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_concepcion, 3, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- Sábado mañana
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_concepcion, 6, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- ===========================================
        -- VALLES: Lunes, Miércoles, Sábado - mañana
        -- Días: 1 (lunes), 3 (miércoles), 6 (sábado)
        -- ===========================================
        
        -- Lunes mañana
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_valles, 1, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- Miércoles mañana
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_valles, 3, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
        -- Sábado mañana
        INSERT INTO plan_rutas_semanal (zona_id, dia_semana, turno, repartidor_id, semana_inicio, activo)
        VALUES (v_zona_valles, 6, 'mañana', v_repartidor_id, v_semana, true)
        ON CONFLICT (zona_id, dia_semana, turno, semana_inicio) DO NOTHING;
        IF FOUND THEN v_planes_creados := v_planes_creados + 1;
        ELSE v_planes_existentes := v_planes_existentes + 1;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'RESUMEN DE PLANIFICACIÓN';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Planes creados: %', v_planes_creados;
    RAISE NOTICE 'Planes ya existentes (omitidos): %', v_planes_existentes;
    RAISE NOTICE 'Total procesados: %', v_planes_creados + v_planes_existentes;
    RAISE NOTICE '===========================================';
    
END $$;

-- ===========================================
-- 3. VERIFICACIÓN FINAL
-- ===========================================

-- Mostrar resumen de zonas
DO $$
DECLARE
    v_zona RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'ZONAS CONFIGURADAS:';
    FOR v_zona IN 
        SELECT nombre, activo, 
               (SELECT COUNT(*) FROM plan_rutas_semanal WHERE zona_id = z.id AND activo = true) as total_planes
        FROM zonas z
        WHERE nombre IN ('Monteros', 'Simoca', 'Concepción', 'Valles')
        ORDER BY nombre
    LOOP
        RAISE NOTICE '  - %: activo=%, planes=%', v_zona.nombre, v_zona.activo, v_zona.total_planes;
    END LOOP;
END $$;

-- Mostrar planes por zona para la semana actual
DO $$
DECLARE
    v_semana_actual DATE;
    v_plan RECORD;
    v_dias TEXT[] := ARRAY['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
BEGIN
    v_semana_actual := fn_calcular_inicio_semana(CURRENT_DATE);
    
    RAISE NOTICE '';
    RAISE NOTICE 'PLANES PARA SEMANA ACTUAL (%)', v_semana_actual;
    RAISE NOTICE '';
    
    FOR v_plan IN 
        SELECT z.nombre as zona, p.dia_semana, p.turno,
               u.nombre || ' ' || COALESCE(u.apellido, '') as repartidor
        FROM plan_rutas_semanal p
        JOIN zonas z ON z.id = p.zona_id
        LEFT JOIN usuarios u ON u.id = p.repartidor_id
        WHERE p.semana_inicio = v_semana_actual
          AND p.activo = true
        ORDER BY z.nombre, p.dia_semana, p.turno
    LOOP
        RAISE NOTICE '  % - % % - Repartidor: %', 
            v_plan.zona, 
            v_dias[v_plan.dia_semana + 1], 
            v_plan.turno,
            COALESCE(v_plan.repartidor, 'Sin asignar');
    END LOOP;
END $$;

COMMIT;

-- ===========================================
-- RESUMEN DE FRECUENCIAS IMPLEMENTADAS
-- ===========================================
-- 
-- MONTEROS (12 planes/semana):
--   - Lunes a Sábado: mañana y tarde
--
-- SIMOCA (8 planes/semana):
--   - Lunes: mañana y tarde
--   - Martes: tarde
--   - Miércoles: tarde
--   - Jueves: tarde
--   - Viernes: mañana y tarde
--   - Sábado: tarde
--
-- CONCEPCIÓN (3 planes/semana):
--   - Lunes: mañana
--   - Miércoles: mañana
--   - Sábado: mañana
--
-- VALLES (3 planes/semana):
--   - Lunes: mañana
--   - Miércoles: mañana
--   - Sábado: mañana
--
-- TOTAL: 26 planes por semana × 52 semanas = 1,352 planes
-- ===========================================




