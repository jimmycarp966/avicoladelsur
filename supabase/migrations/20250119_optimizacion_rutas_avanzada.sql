-- ===========================================
-- MIGRACIÓN: Optimización de Rutas Avanzada
-- Fecha: 19/01/2025
-- Objetivo: Crear tablas y funciones para optimización avanzada de rutas con Google Cloud
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: optimizaciones_rutas
-- Almacena historial de optimizaciones realizadas
-- ===========================================

CREATE TABLE IF NOT EXISTS optimizaciones_rutas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_reparto_id UUID NOT NULL REFERENCES rutas_reparto(id) ON DELETE CASCADE,
    tipo_optimizacion VARCHAR(50) NOT NULL DEFAULT 'local', -- 'fleet-routing', 'optimization', 'google', 'local'
    objetivos JSONB, -- Objetivos de optimización seleccionados
    restricciones JSONB, -- Restricciones aplicadas
    orden_visita_original JSONB, -- Orden original antes de optimizar
    orden_visita_optimizado JSONB, -- Orden optimizado
    distancia_original_km DECIMAL(10,2),
    distancia_optimizada_km DECIMAL(10,2),
    tiempo_original_min INTEGER,
    tiempo_optimizado_min INTEGER,
    ahorro_distancia_porcentaje DECIMAL(5,2), -- % de ahorro en distancia
    ahorro_tiempo_porcentaje DECIMAL(5,2), -- % de ahorro en tiempo
    ahorro_combustible DECIMAL(10,2), -- $ ahorrado en combustible
    polyline TEXT, -- Polyline de la ruta optimizada
    estado VARCHAR(20) DEFAULT 'completada', -- 'completada', 'aplicada', 'descartada'
    aplicada BOOLEAN DEFAULT false, -- Si la optimización fue aplicada a la ruta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_optimizaciones_ruta_reparto_id ON optimizaciones_rutas(ruta_reparto_id);
CREATE INDEX IF NOT EXISTS idx_optimizaciones_tipo ON optimizaciones_rutas(tipo_optimizacion);
CREATE INDEX IF NOT EXISTS idx_optimizaciones_estado ON optimizaciones_rutas(estado);
CREATE INDEX IF NOT EXISTS idx_optimizaciones_created_at ON optimizaciones_rutas(created_at DESC);

-- Comentarios
COMMENT ON TABLE optimizaciones_rutas IS 'Historial de optimizaciones de rutas realizadas con diferentes algoritmos';
COMMENT ON COLUMN optimizaciones_rutas.tipo_optimizacion IS 'Tipo de optimización: fleet-routing, optimization, google, local';
COMMENT ON COLUMN optimizaciones_rutas.objetivos IS 'Objetivos de optimización en formato JSON: {minimizarDistancia, minimizarTiempo, minimizarCombustible}';
COMMENT ON COLUMN optimizaciones_rutas.restricciones IS 'Restricciones aplicadas: {capacidadVehiculo, horarioRepartidor, clientesUrgentes}';

-- ===========================================
-- TABLA: metricas_rutas
-- Métricas agregadas de eficiencia de rutas
-- ===========================================

CREATE TABLE IF NOT EXISTS metricas_rutas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL,
    semana INTEGER, -- Número de semana del año
    mes INTEGER NOT NULL,
    año INTEGER NOT NULL,
    total_rutas INTEGER DEFAULT 0,
    rutas_optimizadas INTEGER DEFAULT 0,
    distancia_total_km DECIMAL(10,2) DEFAULT 0,
    distancia_ahorrada_km DECIMAL(10,2) DEFAULT 0,
    tiempo_total_min INTEGER DEFAULT 0,
    tiempo_ahorrado_min INTEGER DEFAULT 0,
    combustible_ahorrado DECIMAL(10,2) DEFAULT 0, -- $ ahorrado
    ahorro_promedio_distancia DECIMAL(5,2) DEFAULT 0, -- % promedio
    ahorro_promedio_tiempo DECIMAL(5,2) DEFAULT 0, -- % promedio
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fecha)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_metricas_fecha ON metricas_rutas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_semana ON metricas_rutas(año, semana);
CREATE INDEX IF NOT EXISTS idx_metricas_mes ON metricas_rutas(año, mes);

-- Comentarios
COMMENT ON TABLE metricas_rutas IS 'Métricas agregadas de eficiencia de rutas por día/semana/mes';
COMMENT ON COLUMN metricas_rutas.combustible_ahorrado IS 'Dinero ahorrado en combustible (en pesos)';

-- ===========================================
-- FUNCIÓN: fn_registrar_optimizacion_ruta
-- Registra una nueva optimización de ruta
-- ===========================================

CREATE OR REPLACE FUNCTION fn_registrar_optimizacion_ruta(
    p_ruta_reparto_id UUID,
    p_tipo_optimizacion VARCHAR(50),
    p_objetivos JSONB,
    p_restricciones JSONB,
    p_orden_visita_original JSONB,
    p_orden_visita_optimizado JSONB,
    p_distancia_original_km DECIMAL,
    p_distancia_optimizada_km DECIMAL,
    p_tiempo_original_min INTEGER,
    p_tiempo_optimizado_min INTEGER,
    p_polyline TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_optimizacion_id UUID;
    v_ahorro_distancia DECIMAL(5,2);
    v_ahorro_tiempo DECIMAL(5,2);
    v_ahorro_combustible DECIMAL(10,2);
BEGIN
    -- Calcular ahorros
    IF p_distancia_original_km > 0 THEN
        v_ahorro_distancia := ((p_distancia_original_km - p_distancia_optimizada_km) / p_distancia_original_km) * 100;
    ELSE
        v_ahorro_distancia := 0;
    END IF;

    IF p_tiempo_original_min > 0 THEN
        v_ahorro_tiempo := ((p_tiempo_original_min - p_tiempo_optimizado_min)::DECIMAL / p_tiempo_original_min) * 100;
    ELSE
        v_ahorro_tiempo := 0;
    END IF;

    -- Estimación: 0.15L/km * $450/L
    v_ahorro_combustible := GREATEST(0, (p_distancia_original_km - p_distancia_optimizada_km) * 0.15 * 450);

    -- Insertar optimización
    INSERT INTO optimizaciones_rutas (
        ruta_reparto_id,
        tipo_optimizacion,
        objetivos,
        restricciones,
        orden_visita_original,
        orden_visita_optimizado,
        distancia_original_km,
        distancia_optimizada_km,
        tiempo_original_min,
        tiempo_optimizado_min,
        ahorro_distancia_porcentaje,
        ahorro_tiempo_porcentaje,
        ahorro_combustible,
        polyline,
        estado
    ) VALUES (
        p_ruta_reparto_id,
        p_tipo_optimizacion,
        p_objetivos,
        p_restricciones,
        p_orden_visita_original,
        p_orden_visita_optimizado,
        p_distancia_original_km,
        p_distancia_optimizada_km,
        p_tiempo_original_min,
        p_tiempo_optimizado_min,
        v_ahorro_distancia,
        v_ahorro_tiempo,
        v_ahorro_combustible,
        p_polyline,
        'completada'
    )
    RETURNING id INTO v_optimizacion_id;

    -- Actualizar métricas del día
    PERFORM fn_actualizar_metricas_rutas(
        CURRENT_DATE,
        p_distancia_original_km - p_distancia_optimizada_km,
        p_tiempo_original_min - p_tiempo_optimizado_min,
        v_ahorro_combustible
    );

    RETURN v_optimizacion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_actualizar_metricas_rutas
-- Actualiza las métricas agregadas de rutas
-- ===========================================

CREATE OR REPLACE FUNCTION fn_actualizar_metricas_rutas(
    p_fecha DATE,
    p_distancia_ahorrada_km DECIMAL,
    p_tiempo_ahorrado_min INTEGER,
    p_combustible_ahorrado DECIMAL
)
RETURNS VOID AS $$
DECLARE
    v_semana INTEGER;
    v_mes INTEGER;
    v_año INTEGER;
BEGIN
    v_semana := EXTRACT(WEEK FROM p_fecha);
    v_mes := EXTRACT(MONTH FROM p_fecha);
    v_año := EXTRACT(YEAR FROM p_fecha);

    INSERT INTO metricas_rutas (
        fecha,
        semana,
        mes,
        año,
        distancia_ahorrada_km,
        tiempo_ahorrado_min,
        combustible_ahorrado
    ) VALUES (
        p_fecha,
        v_semana,
        v_mes,
        v_año,
        p_distancia_ahorrada_km,
        p_tiempo_ahorrado_min,
        p_combustible_ahorrado
    )
    ON CONFLICT (fecha) DO UPDATE SET
        distancia_ahorrada_km = metricas_rutas.distancia_ahorrada_km + p_distancia_ahorrada_km,
        tiempo_ahorrado_min = metricas_rutas.tiempo_ahorrado_min + p_tiempo_ahorrado_min,
        combustible_ahorrado = metricas_rutas.combustible_ahorrado + p_combustible_ahorrado,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_obtener_metricas_rutas_semana
-- Obtiene métricas agregadas de la semana
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_metricas_rutas_semana(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
    v_semana INTEGER;
    v_año INTEGER;
    v_result JSONB;
BEGIN
    v_semana := EXTRACT(WEEK FROM p_fecha);
    v_año := EXTRACT(YEAR FROM p_fecha);

    SELECT jsonb_build_object(
        'distancia_ahorrada_km', COALESCE(SUM(distancia_ahorrada_km), 0),
        'tiempo_ahorrado_min', COALESCE(SUM(tiempo_ahorrado_min), 0),
        'combustible_ahorrado', COALESCE(SUM(combustible_ahorrado), 0),
        'total_rutas', COUNT(DISTINCT ruta_reparto_id)
    )
    INTO v_result
    FROM optimizaciones_rutas
    WHERE EXTRACT(WEEK FROM created_at) = v_semana
      AND EXTRACT(YEAR FROM created_at) = v_año
      AND estado = 'aplicada';

    RETURN COALESCE(v_result, jsonb_build_object(
        'distancia_ahorrada_km', 0,
        'tiempo_ahorrado_min', 0,
        'combustible_ahorrado', 0,
        'total_rutas', 0
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_aplicar_optimizacion_ruta
-- Aplica una optimización a una ruta
-- ===========================================

CREATE OR REPLACE FUNCTION fn_aplicar_optimizacion_ruta(
    p_optimizacion_id UUID,
    p_ruta_reparto_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_optimizacion RECORD;
    v_detalle JSONB;
    v_orden INTEGER;
BEGIN
    -- Obtener optimización
    SELECT * INTO v_optimizacion
    FROM optimizaciones_rutas
    WHERE id = p_optimizacion_id
      AND ruta_reparto_id = p_ruta_reparto_id
      AND estado = 'completada';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Optimización no encontrada o ya aplicada');
    END IF;

    -- Actualizar orden de entrega en detalles_ruta
    FOR v_detalle IN SELECT * FROM jsonb_array_elements(v_optimizacion.orden_visita_optimizado)
    LOOP
        v_orden := (v_detalle->>'orden')::INTEGER;
        
        UPDATE detalles_ruta
        SET orden_entrega = v_orden,
            updated_at = NOW()
        WHERE id = (v_detalle->>'detalle_ruta_id')::UUID
          AND ruta_id = p_ruta_reparto_id;
    END LOOP;

    -- Actualizar ruta con nueva distancia y tiempo
    UPDATE rutas_reparto
    SET distancia_estimada_km = v_optimizacion.distancia_optimizada_km,
        tiempo_estimado_min = v_optimizacion.tiempo_optimizado_min,
        updated_at = NOW()
    WHERE id = p_ruta_reparto_id;

    -- Actualizar estado de optimización
    UPDATE optimizaciones_rutas
    SET estado = 'aplicada',
        aplicada = true,
        updated_at = NOW()
    WHERE id = p_optimizacion_id;

    RETURN jsonb_build_object(
        'success', true,
        'mensaje', 'Optimización aplicada correctamente',
        'ahorro_distancia', v_optimizacion.ahorro_distancia_porcentaje,
        'ahorro_tiempo', v_optimizacion.ahorro_tiempo_porcentaje,
        'ahorro_combustible', v_optimizacion.ahorro_combustible
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos
GRANT SELECT, INSERT, UPDATE ON optimizaciones_rutas TO authenticated;
GRANT SELECT ON metricas_rutas TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_optimizacion_ruta TO authenticated;
GRANT EXECUTE ON FUNCTION fn_actualizar_metricas_rutas TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_metricas_rutas_semana TO authenticated;
GRANT EXECUTE ON FUNCTION fn_aplicar_optimizacion_ruta TO authenticated;

COMMIT;

