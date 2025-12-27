-- ============================================================================
-- Migración: Horarios de Apertura de Clientes para Optimización de Reparto
-- Fecha: 2025-12-27
-- Descripción: Agrega campos de horarios de apertura por día a la tabla clientes
--              y actualiza estructuras para soportar ETA y tiempo de descarga
-- ============================================================================

-- ============================================================================
-- 1. CAMPOS DE HORARIOS EN CLIENTES
-- ============================================================================

-- Formato de horarios: "HH:mm-HH:mm" o "HH:mm-HH:mm,HH:mm-HH:mm" para horario partido
-- NULL o vacío = disponible todo el día

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_lunes TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_martes TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_miercoles TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_jueves TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_viernes TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_sabado TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_domingo TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN clientes.horario_lunes IS 'Horario apertura lunes (ej: "08:00-12:00,16:00-20:00" o vacío=todo el día)';
COMMENT ON COLUMN clientes.horario_martes IS 'Horario apertura martes';
COMMENT ON COLUMN clientes.horario_miercoles IS 'Horario apertura miércoles';
COMMENT ON COLUMN clientes.horario_jueves IS 'Horario apertura jueves';
COMMENT ON COLUMN clientes.horario_viernes IS 'Horario apertura viernes';
COMMENT ON COLUMN clientes.horario_sabado IS 'Horario apertura sábado';
COMMENT ON COLUMN clientes.horario_domingo IS 'Horario apertura domingo';

-- ============================================================================
-- 2. CAMPO hora_inicio_reparto EN RUTAS_REPARTO
-- ============================================================================

-- Hora real en que se inició el reparto (cuando almacén presiona "Pasar a Ruta")
ALTER TABLE rutas_reparto ADD COLUMN IF NOT EXISTS hora_inicio_reparto TIMESTAMPTZ;

COMMENT ON COLUMN rutas_reparto.hora_inicio_reparto IS 'Hora en que almacén presionó "Pasar a Ruta" - usada para calcular ETAs';

-- ============================================================================
-- 3. CAMPOS ETA Y TIEMPO DESCARGA EN ENTREGAS
-- ============================================================================

ALTER TABLE entregas ADD COLUMN IF NOT EXISTS eta TIMESTAMPTZ;
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS tiempo_descarga_min INTEGER;
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS peso_entrega_kg NUMERIC(10,2);
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS en_horario BOOLEAN DEFAULT true;

COMMENT ON COLUMN entregas.eta IS 'Hora estimada de llegada calculada';
COMMENT ON COLUMN entregas.tiempo_descarga_min IS 'Tiempo estimado de descarga en minutos';
COMMENT ON COLUMN entregas.peso_entrega_kg IS 'Peso total a entregar en kg';
COMMENT ON COLUMN entregas.en_horario IS 'Si la ETA cae dentro del horario de apertura del cliente';

-- ============================================================================
-- 4. FUNCIÓN PARA OBTENER HORARIO DEL CLIENTE SEGÚN DÍA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_obtener_horario_cliente(
    p_cliente_id UUID,
    p_fecha DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dia_semana INTEGER;
    v_horario TEXT;
BEGIN
    -- Obtener día de la semana (0=domingo, 1=lunes, ..., 6=sábado)
    v_dia_semana := EXTRACT(DOW FROM p_fecha)::INTEGER;
    
    SELECT 
        CASE v_dia_semana
            WHEN 0 THEN horario_domingo
            WHEN 1 THEN horario_lunes
            WHEN 2 THEN horario_martes
            WHEN 3 THEN horario_miercoles
            WHEN 4 THEN horario_jueves
            WHEN 5 THEN horario_viernes
            WHEN 6 THEN horario_sabado
        END
    INTO v_horario
    FROM clientes
    WHERE id = p_cliente_id;
    
    RETURN v_horario;
END;
$$;

COMMENT ON FUNCTION fn_obtener_horario_cliente IS 'Obtiene el horario de apertura del cliente según el día de la semana';

-- ============================================================================
-- 5. FUNCIÓN PARA VERIFICAR SI UNA HORA ESTÁ DENTRO DEL HORARIO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_verificar_en_horario(
    p_horario TEXT,
    p_hora TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_intervalo TEXT;
    v_intervalos TEXT[];
    v_hora_inicio TIME;
    v_hora_fin TIME;
    v_partes TEXT[];
BEGIN
    -- Si no hay horario definido, siempre está disponible
    IF p_horario IS NULL OR TRIM(p_horario) = '' THEN
        RETURN TRUE;
    END IF;
    
    -- Separar por comas para horarios partidos (ej: "08:00-12:00,16:00-20:00")
    v_intervalos := string_to_array(p_horario, ',');
    
    FOREACH v_intervalo IN ARRAY v_intervalos
    LOOP
        v_intervalo := TRIM(v_intervalo);
        IF v_intervalo = '' THEN
            CONTINUE;
        END IF;
        
        -- Separar hora inicio y fin
        v_partes := string_to_array(v_intervalo, '-');
        IF array_length(v_partes, 1) != 2 THEN
            CONTINUE;
        END IF;
        
        BEGIN
            v_hora_inicio := v_partes[1]::TIME;
            v_hora_fin := v_partes[2]::TIME;
            
            IF p_hora >= v_hora_inicio AND p_hora <= v_hora_fin THEN
                RETURN TRUE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE; -- Ignorar intervalos con formato inválido
        END;
    END LOOP;
    
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION fn_verificar_en_horario IS 'Verifica si una hora está dentro de un horario dado (soporta intervalos múltiples separados por coma)';

-- ============================================================================
-- 6. FUNCIÓN PARA CALCULAR TIEMPO DE DESCARGA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calcular_tiempo_descarga(
    p_peso_kg NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tiempo_base INTEGER := 5;          -- 5 minutos base
    v_kg_por_unidad INTEGER := 20;       -- 20 kg por unidad de tiempo
    v_min_por_unidad INTEGER := 2;       -- 2 minutos por cada 20 kg
    v_tiempo_adicional INTEGER;
BEGIN
    IF p_peso_kg IS NULL OR p_peso_kg <= 0 THEN
        RETURN v_tiempo_base;
    END IF;
    
    -- Calcular tiempo adicional: ceil(peso/20) * 2
    v_tiempo_adicional := CEIL(p_peso_kg / v_kg_por_unidad) * v_min_por_unidad;
    
    RETURN v_tiempo_base + v_tiempo_adicional;
END;
$$;

COMMENT ON FUNCTION fn_calcular_tiempo_descarga IS 'Calcula tiempo de descarga: 5 min base + 2 min por cada 20 kg';

-- ============================================================================
-- 7. AGREGAR CAMPO MOTIVO DE RECHAZO A ENTREGAS (si no existe)
-- ============================================================================

-- Agregar columna motivo_rechazo a entregas si no existe
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

COMMENT ON COLUMN entregas.motivo_rechazo IS 'Motivo del rechazo: cliente_ausente, cliente_fuera_de_horario, direccion_incorrecta, producto_no_solicitado, producto_daniado, otro';

-- ============================================================================
-- 8. FUNCIÓN RPC PARA OBTENER CLIENTE CON HORARIOS
-- ============================================================================

-- Eliminar función existente primero (el tipo de retorno cambió al agregar horarios)
DROP FUNCTION IF EXISTS fn_get_cliente_con_coordenadas(UUID);

-- Crear función con horarios incluidos
CREATE OR REPLACE FUNCTION fn_get_cliente_con_coordenadas(p_cliente_id UUID)
RETURNS TABLE(
    id UUID,
    nombre TEXT,
    direccion TEXT,
    telefono TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    horario_lunes TEXT,
    horario_martes TEXT,
    horario_miercoles TEXT,
    horario_jueves TEXT,
    horario_viernes TEXT,
    horario_sabado TEXT,
    horario_domingo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.nombre::TEXT,
        c.direccion::TEXT,
        c.telefono::TEXT,
        CASE 
            WHEN c.coordenadas IS NOT NULL AND jsonb_typeof(c.coordenadas) = 'object' 
            THEN (c.coordenadas->>'lat')::DOUBLE PRECISION
            ELSE NULL
        END as lat,
        CASE 
            WHEN c.coordenadas IS NOT NULL AND jsonb_typeof(c.coordenadas) = 'object' 
            THEN (c.coordenadas->>'lng')::DOUBLE PRECISION
            ELSE NULL
        END as lng,
        c.horario_lunes::TEXT,
        c.horario_martes::TEXT,
        c.horario_miercoles::TEXT,
        c.horario_jueves::TEXT,
        c.horario_viernes::TEXT,
        c.horario_sabado::TEXT,
        c.horario_domingo::TEXT
    FROM clientes c
    WHERE c.id = p_cliente_id;
END;
$$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada: Horarios de clientes para optimización de reparto';
    RAISE NOTICE '   - Campos de horarios (lunes a domingo) agregados a clientes';
    RAISE NOTICE '   - Campo hora_inicio_reparto agregado a rutas_reparto';
    RAISE NOTICE '   - Campos ETA y tiempo_descarga agregados a entregas';
    RAISE NOTICE '   - Funciones: fn_obtener_horario_cliente, fn_verificar_en_horario, fn_calcular_tiempo_descarga';
END $$;
