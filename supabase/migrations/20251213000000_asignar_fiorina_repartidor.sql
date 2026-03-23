-- ===========================================
-- MIGRACIÓN: Asignar Fiorina siempre al repartidor@avicoladelsur.com
-- Fecha: 13/12/2025
-- Objetivo: 
--   1. Asegurar que el usuario repartidor@avicoladelsur.com siempre tenga asignada la Fiorina
--   2. Crear trigger que mantenga esta asignación automáticamente
--   3. Asignar inicialmente la Fiorina si no está asignada
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: Obtener ID de la Fiorina (vehículo más chico)
-- ===========================================
CREATE OR REPLACE FUNCTION fn_obtener_fiorina_id()
RETURNS UUID AS $$
DECLARE
    v_fiorina_id UUID;
BEGIN
    -- Buscar vehículo con menor capacidad (Fiorina ~600 kg)
    -- Si hay varios con la misma capacidad, tomar el primero activo
    SELECT id INTO v_fiorina_id
    FROM vehiculos
    WHERE activo = true
      AND capacidad_kg IS NOT NULL
    ORDER BY capacidad_kg ASC, created_at ASC
    LIMIT 1;
    
    -- Si no hay vehículos con capacidad definida, tomar el primero activo
    IF v_fiorina_id IS NULL THEN
        SELECT id INTO v_fiorina_id
        FROM vehiculos
        WHERE activo = true
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;
    
    RETURN v_fiorina_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_obtener_fiorina_id() IS 'Obtiene el ID del vehículo más chico (Fiorina) para asignar al repartidor principal';

-- ===========================================
-- FUNCIÓN: Trigger para mantener Fiorina asignada
-- ===========================================
CREATE OR REPLACE FUNCTION trg_mantener_fiorina_repartidor()
RETURNS TRIGGER AS $$
DECLARE
    v_repartidor_email TEXT;
    v_fiorina_id UUID;
BEGIN
    -- Obtener email del usuario desde la tabla usuarios
    -- Si es INSERT, usar NEW.email; si es UPDATE, obtenerlo de la BD
    IF TG_OP = 'INSERT' THEN
        v_repartidor_email := NEW.email;
    ELSE
        -- En UPDATE, obtener email actualizado o existente
        SELECT email INTO v_repartidor_email
        FROM usuarios
        WHERE id = NEW.id;
        
        -- Si no se encuentra, intentar desde auth.users como fallback
        IF v_repartidor_email IS NULL THEN
            SELECT email INTO v_repartidor_email
            FROM auth.users
            WHERE id = NEW.id;
        END IF;
    END IF;
    
    -- Solo aplicar si es el repartidor principal
    IF v_repartidor_email = 'repartidor@avicoladelsur.com' THEN
        -- Obtener ID de la Fiorina
        v_fiorina_id := fn_obtener_fiorina_id();
        
        IF v_fiorina_id IS NULL THEN
            RAISE WARNING 'No se encontró vehículo activo para asignar como Fiorina';
            RETURN NEW;
        END IF;
        
        -- Forzar asignación de Fiorina
        NEW.vehiculo_asignado := v_fiorina_id;
        
        RAISE NOTICE 'Fiorina (vehículo ID: %) asignada automáticamente a repartidor@avicoladelsur.com', v_fiorina_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trg_mantener_fiorina_repartidor() IS 'Trigger que asegura que repartidor@avicoladelsur.com siempre tenga la Fiorina asignada';

-- ===========================================
-- CREAR TRIGGER: Antes de INSERT o UPDATE en usuarios
-- ===========================================
DROP TRIGGER IF EXISTS trg_mantener_fiorina_repartidor_trigger ON usuarios;

CREATE TRIGGER trg_mantener_fiorina_repartidor_trigger
    BEFORE INSERT OR UPDATE OF vehiculo_asignado, email ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION trg_mantener_fiorina_repartidor();

COMMENT ON TRIGGER trg_mantener_fiorina_repartidor_trigger ON usuarios IS 
'Trigger que mantiene la Fiorina asignada al repartidor principal automáticamente';

-- ===========================================
-- ASIGNAR FIORINA INICIALMENTE
-- ===========================================
DO $$
DECLARE
    v_repartidor_id UUID;
    v_fiorina_id UUID;
BEGIN
    -- Obtener ID del repartidor
    SELECT u.id INTO v_repartidor_id
    FROM usuarios u
    INNER JOIN auth.users au ON au.id = u.id
    WHERE au.email = 'repartidor@avicoladelsur.com'
    LIMIT 1;
    
    IF v_repartidor_id IS NULL THEN
        RAISE NOTICE 'Usuario repartidor@avicoladelsur.com no encontrado. El trigger asignará la Fiorina cuando se cree el usuario.';
    ELSE
        -- Obtener ID de la Fiorina
        v_fiorina_id := fn_obtener_fiorina_id();
        
        IF v_fiorina_id IS NULL THEN
            RAISE WARNING 'No se encontró vehículo activo para asignar como Fiorina';
        ELSE
            -- Asignar Fiorina al repartidor
            UPDATE usuarios
            SET vehiculo_asignado = v_fiorina_id,
                updated_at = NOW()
            WHERE id = v_repartidor_id
              AND (vehiculo_asignado IS NULL OR vehiculo_asignado != v_fiorina_id);
            
            IF FOUND THEN
                RAISE NOTICE 'Fiorina (vehículo ID: %) asignada inicialmente a repartidor@avicoladelsur.com', v_fiorina_id;
            ELSE
                RAISE NOTICE 'Repartidor@avicoladelsur.com ya tiene la Fiorina asignada (vehículo ID: %)', v_fiorina_id;
            END IF;
        END IF;
    END IF;
END $$;

COMMIT;

