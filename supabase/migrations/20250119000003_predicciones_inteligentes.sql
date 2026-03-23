-- ===========================================
-- MIGRACIÓN: Predicciones Inteligentes con Vertex AI, AutoML y Gemini
-- Fecha: 19/01/2025
-- Objetivo: Crear tablas para predicciones de demanda, alertas de stock IA, modelos ML y reportes IA
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: predicciones_demanda
-- Predicciones de demanda de productos
-- ===========================================

CREATE TABLE IF NOT EXISTS predicciones_demanda (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    fecha_prediccion DATE NOT NULL,
    fecha_predicha DATE NOT NULL, -- Fecha para la cual se predice
    cantidad_predicha DECIMAL(10,2) NOT NULL, -- Cantidad en kg o unidades
    confianza DECIMAL(5,4) NOT NULL, -- Confianza de la predicción (0-1)
    tendencia VARCHAR(20), -- 'alta', 'media', 'baja'
    factores JSONB, -- Factores que influyen en la predicción
    modelo_usado VARCHAR(100) DEFAULT 'basico', -- 'vertex-ai', 'automl', 'basico'
    dias_restantes INTEGER, -- Días hasta rotura de stock según predicción
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id, fecha_prediccion, fecha_predicha)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_predicciones_producto_id ON predicciones_demanda(producto_id);
CREATE INDEX IF NOT EXISTS idx_predicciones_fecha_prediccion ON predicciones_demanda(fecha_prediccion DESC);
CREATE INDEX IF NOT EXISTS idx_predicciones_fecha_predicha ON predicciones_demanda(fecha_predicha);
CREATE INDEX IF NOT EXISTS idx_predicciones_tendencia ON predicciones_demanda(tendencia);

-- Comentarios
COMMENT ON TABLE predicciones_demanda IS 'Predicciones de demanda de productos usando IA';
COMMENT ON COLUMN predicciones_demanda.cantidad_predicha IS 'Cantidad predicha en kg o unidades según el producto';
COMMENT ON COLUMN predicciones_demanda.factores IS 'Factores que influyen: ["Día de semana", "Temporada", "Cliente recurrente"]';

-- ===========================================
-- TABLA: alertas_stock_ia
-- Alertas de stock generadas por IA
-- ===========================================

CREATE TABLE IF NOT EXISTS alertas_stock_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'rotura_inminente', 'stock_bajo', 'demanda_alta'
    mensaje TEXT NOT NULL,
    dias_restantes DECIMAL(5,2), -- Días hasta rotura de stock
    stock_actual DECIMAL(10,2), -- Stock actual en kg o unidades
    demanda_prevista DECIMAL(10,2), -- Demanda prevista por día
    accion_sugerida TEXT, -- Acción recomendada por la IA
    resuelta BOOLEAN DEFAULT false,
    resuelta_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    fecha_resolucion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_alertas_stock_producto_id ON alertas_stock_ia(producto_id);
CREATE INDEX IF NOT EXISTS idx_alertas_stock_tipo ON alertas_stock_ia(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_stock_resuelta ON alertas_stock_ia(resuelta);
CREATE INDEX IF NOT EXISTS idx_alertas_stock_dias_restantes ON alertas_stock_ia(dias_restantes ASC);
CREATE INDEX IF NOT EXISTS idx_alertas_stock_created_at ON alertas_stock_ia(created_at DESC);

-- Comentarios
COMMENT ON TABLE alertas_stock_ia IS 'Alertas de stock generadas automáticamente por IA basadas en predicciones';
COMMENT ON COLUMN alertas_stock_ia.tipo IS 'Tipo de alerta: rotura_inminente (<1 día), stock_bajo (1-3 días), demanda_alta (tendencia creciente)';

-- ===========================================
-- TABLA: modelos_ml
-- Tracking de modelos de ML entrenados
-- ===========================================

CREATE TABLE IF NOT EXISTS modelos_ml (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'demanda', 'clasificacion', 'regresion'
    plataforma VARCHAR(50) NOT NULL, -- 'vertex-ai', 'automl', 'custom'
    modelo_id VARCHAR(200), -- ID del modelo en la plataforma
    version VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'entrenando', -- 'entrenando', 'activo', 'deprecado'
    precision DECIMAL(5,4), -- Precisión del modelo (0-1)
    fecha_entrenamiento TIMESTAMPTZ,
    fecha_activacion TIMESTAMPTZ,
    parametros JSONB, -- Parámetros del modelo
    metricas JSONB, -- Métricas de evaluación
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_modelos_tipo ON modelos_ml(tipo);
CREATE INDEX IF NOT EXISTS idx_modelos_estado ON modelos_ml(estado);
CREATE INDEX IF NOT EXISTS idx_modelos_plataforma ON modelos_ml(plataforma);

-- Comentarios
COMMENT ON TABLE modelos_ml IS 'Tracking de modelos de machine learning entrenados';
COMMENT ON COLUMN modelos_ml.precision IS 'Precisión del modelo en validación (0-1)';

-- ===========================================
-- TABLA: reportes_ia
-- Reportes generados por Gemini
-- ===========================================

CREATE TABLE IF NOT EXISTS reportes_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(50) NOT NULL, -- 'semanal', 'mensual', 'personalizado'
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL, -- Contenido del reporte generado por Gemini
    datos_usados JSONB, -- Datos que se usaron para generar el reporte
    prompt_usado TEXT, -- Prompt usado para generar el reporte
    fecha_periodo_inicio DATE,
    fecha_periodo_fin DATE,
    generado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reportes_tipo ON reportes_ia(tipo);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha_periodo ON reportes_ia(fecha_periodo_inicio, fecha_periodo_fin);
CREATE INDEX IF NOT EXISTS idx_reportes_created_at ON reportes_ia(created_at DESC);

-- Comentarios
COMMENT ON TABLE reportes_ia IS 'Reportes generados automáticamente por Gemini';
COMMENT ON COLUMN reportes_ia.contenido IS 'Contenido del reporte en formato texto/markdown';

-- ===========================================
-- FUNCIÓN: fn_registrar_prediccion_demanda
-- Registra una nueva predicción de demanda
-- ===========================================

CREATE OR REPLACE FUNCTION fn_registrar_prediccion_demanda(
    p_producto_id UUID,
    p_fecha_prediccion DATE,
    p_fecha_predicha DATE,
    p_cantidad_predicha DECIMAL,
    p_confianza DECIMAL,
    p_tendencia VARCHAR(20) DEFAULT NULL,
    p_factores JSONB DEFAULT NULL,
    p_modelo_usado VARCHAR(100) DEFAULT 'basico',
    p_dias_restantes INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_prediccion_id UUID;
BEGIN
    INSERT INTO predicciones_demanda (
        producto_id,
        fecha_prediccion,
        fecha_predicha,
        cantidad_predicha,
        confianza,
        tendencia,
        factores,
        modelo_usado,
        dias_restantes
    ) VALUES (
        p_producto_id,
        p_fecha_prediccion,
        p_fecha_predicha,
        p_cantidad_predicha,
        p_confianza,
        p_tendencia,
        p_factores,
        p_modelo_usado,
        p_dias_restantes
    )
    ON CONFLICT (producto_id, fecha_prediccion, fecha_predicha) DO UPDATE SET
        cantidad_predicha = EXCLUDED.cantidad_predicha,
        confianza = EXCLUDED.confianza,
        tendencia = EXCLUDED.tendencia,
        factores = EXCLUDED.factores,
        modelo_usado = EXCLUDED.modelo_usado,
        dias_restantes = EXCLUDED.dias_restantes
    RETURNING id INTO v_prediccion_id;

    RETURN v_prediccion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_generar_alertas_stock
-- Genera alertas de stock basadas en predicciones
-- ===========================================

CREATE OR REPLACE FUNCTION fn_generar_alertas_stock()
RETURNS INTEGER AS $$
DECLARE
    v_alertas_generadas INTEGER := 0;
    v_producto RECORD;
    v_prediccion RECORD;
    v_stock_actual DECIMAL;
    v_dias_restantes DECIMAL;
    v_tipo_alerta VARCHAR(50);
BEGIN
    -- Iterar sobre productos activos
    FOR v_producto IN 
        SELECT id, nombre FROM productos WHERE activo = true
    LOOP
        -- Obtener predicción más reciente
        SELECT * INTO v_prediccion
        FROM predicciones_demanda
        WHERE producto_id = v_producto.id
          AND fecha_prediccion = CURRENT_DATE
        ORDER BY fecha_predicha DESC
        LIMIT 1;

        IF v_prediccion.id IS NULL THEN
            CONTINUE;
        END IF;

        -- Calcular stock actual
        SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_actual
        FROM lotes
        WHERE producto_id = v_producto.id
          AND cantidad_disponible > 0;

        -- Calcular días restantes
        IF v_prediccion.cantidad_predicha > 0 THEN
            v_dias_restantes := (v_stock_actual / (v_prediccion.cantidad_predicha / 7.0));
        ELSE
            v_dias_restantes := NULL;
        END IF;

        -- Determinar tipo de alerta
        IF v_dias_restantes IS NOT NULL AND v_dias_restantes < 1 THEN
            v_tipo_alerta := 'rotura_inminente';
        ELSIF v_dias_restantes IS NOT NULL AND v_dias_restantes < 3 THEN
            v_tipo_alerta := 'stock_bajo';
        ELSIF v_prediccion.tendencia = 'alta' AND v_dias_restantes IS NOT NULL AND v_dias_restantes < 7 THEN
            v_tipo_alerta := 'demanda_alta';
        ELSE
            CONTINUE;
        END IF;

        -- Verificar si ya existe una alerta activa del mismo tipo
        IF EXISTS (
            SELECT 1 FROM alertas_stock_ia
            WHERE producto_id = v_producto.id
              AND tipo = v_tipo_alerta
              AND resuelta = false
        ) THEN
            CONTINUE;
        END IF;

        -- Crear alerta
        INSERT INTO alertas_stock_ia (
            producto_id,
            tipo,
            mensaje,
            dias_restantes,
            stock_actual,
            demanda_prevista,
            accion_sugerida
        ) VALUES (
            v_producto.id,
            v_tipo_alerta,
            CASE 
                WHEN v_tipo_alerta = 'rotura_inminente' THEN 
                    '⚠️ ALERTA CRÍTICA: ' || v_producto.nombre || ' se acabará hoy según predicción de IA'
                WHEN v_tipo_alerta = 'stock_bajo' THEN 
                    '⚠️ ALERTA: ' || v_producto.nombre || ' se acabará en ' || ROUND(v_dias_restantes, 1) || ' días'
                ELSE 
                    '📈 Demanda alta detectada: ' || v_producto.nombre || ' tiene tendencia creciente'
            END,
            v_dias_restantes,
            v_stock_actual,
            v_prediccion.cantidad_predicha / 7.0,
            'Comprar ' || CEIL((v_prediccion.cantidad_predicha / 7.0) * 7) || 'kg para cubrir demanda de la próxima semana'
        );

        v_alertas_generadas := v_alertas_generadas + 1;
    END LOOP;

    RETURN v_alertas_generadas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_obtener_predicciones_semana
-- Obtiene todas las predicciones de la semana actual
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_predicciones_semana(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    producto_id UUID,
    producto_nombre VARCHAR(255),
    cantidad_predicha DECIMAL,
    confianza DECIMAL,
    tendencia VARCHAR(20),
    dias_restantes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.producto_id,
        pr.nombre,
        p.cantidad_predicha,
        p.confianza,
        p.tendencia,
        p.dias_restantes
    FROM predicciones_demanda p
    JOIN productos pr ON pr.id = p.producto_id
    WHERE p.fecha_prediccion >= DATE_TRUNC('week', p_fecha)
      AND p.fecha_prediccion < DATE_TRUNC('week', p_fecha) + INTERVAL '1 week'
    ORDER BY p.confianza DESC, p.cantidad_predicha DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos
GRANT SELECT, INSERT, UPDATE ON predicciones_demanda TO authenticated;
GRANT SELECT, INSERT, UPDATE ON alertas_stock_ia TO authenticated;
GRANT SELECT, INSERT, UPDATE ON modelos_ml TO authenticated;
GRANT SELECT, INSERT ON reportes_ia TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_prediccion_demanda TO authenticated;
GRANT EXECUTE ON FUNCTION fn_generar_alertas_stock TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_predicciones_semana TO authenticated;

COMMIT;

