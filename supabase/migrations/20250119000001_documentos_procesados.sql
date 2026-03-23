-- ===========================================
-- MIGRACIÓN: Documentos Procesados con Document AI
-- Fecha: 19/01/2025
-- Objetivo: Crear tablas para documentos procesados y extracciones
-- ===========================================

BEGIN;

-- ===========================================
-- TABLA: documentos_procesados
-- Documentos procesados con Document AI
-- ===========================================

CREATE TABLE IF NOT EXISTS documentos_procesados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(50) NOT NULL, -- 'factura', 'remito', 'recibo'
    archivo_url TEXT NOT NULL, -- URL en Supabase Storage
    datos_extraidos JSONB NOT NULL, -- Datos extraídos por Document AI
    estado VARCHAR(20) DEFAULT 'procesando', -- 'procesando', 'completado', 'error'
    error TEXT, -- Mensaje de error si falla
    procesado_por VARCHAR(50) DEFAULT 'document-ai',
    confianza_promedio DECIMAL(5,4), -- Confianza promedio de extracción
    usuario_procesador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    relacionado_con_id UUID, -- ID de factura, remito, etc. relacionado
    relacionado_con_tipo VARCHAR(50), -- Tipo de relación: 'factura_proveedor', 'remito_entrega'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos_procesados(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos_procesados(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_relacionado ON documentos_procesados(relacionado_con_tipo, relacionado_con_id);
CREATE INDEX IF NOT EXISTS idx_documentos_created_at ON documentos_procesados(created_at DESC);

-- Comentarios
COMMENT ON TABLE documentos_procesados IS 'Documentos procesados automáticamente con Document AI';
COMMENT ON COLUMN documentos_procesados.datos_extraidos IS 'Datos estructurados extraídos: {numero, fecha, proveedor, total, productos}';
COMMENT ON COLUMN documentos_procesados.confianza_promedio IS 'Confianza promedio de la extracción (0-1)';

-- ===========================================
-- TABLA: extracciones_documentos
-- Extracciones individuales de campos de documentos
-- ===========================================

CREATE TABLE IF NOT EXISTS extracciones_documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID NOT NULL REFERENCES documentos_procesados(id) ON DELETE CASCADE,
    campo_nombre VARCHAR(100) NOT NULL, -- 'numero', 'fecha', 'proveedor', etc.
    valor_extraido TEXT NOT NULL,
    valor_normalizado TEXT, -- Valor normalizado (ej: fecha en formato ISO)
    confianza DECIMAL(5,4), -- Confianza de esta extracción específica
    tipo_campo VARCHAR(50), -- 'texto', 'numero', 'fecha', 'moneda'
    pagina INTEGER, -- Página del documento donde se encontró
    coordenadas JSONB, -- Coordenadas del campo en el documento
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_extracciones_documento_id ON extracciones_documentos(documento_id);
CREATE INDEX IF NOT EXISTS idx_extracciones_campo ON extracciones_documentos(campo_nombre);

-- Comentarios
COMMENT ON TABLE extracciones_documentos IS 'Extracciones individuales de campos de documentos';
COMMENT ON COLUMN extracciones_documentos.coordenadas IS 'Coordenadas del campo: {x, y, width, height}';

-- ===========================================
-- FUNCIÓN: fn_registrar_documento_procesado
-- Registra un documento procesado
-- ===========================================

CREATE OR REPLACE FUNCTION fn_registrar_documento_procesado(
    p_tipo VARCHAR(50),
    p_archivo_url TEXT,
    p_datos_extraidos JSONB,
    p_estado VARCHAR(20) DEFAULT 'completado',
    p_confianza_promedio DECIMAL DEFAULT NULL,
    p_usuario_procesador_id UUID DEFAULT NULL,
    p_relacionado_con_id UUID DEFAULT NULL,
    p_relacionado_con_tipo VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_documento_id UUID;
BEGIN
    INSERT INTO documentos_procesados (
        tipo,
        archivo_url,
        datos_extraidos,
        estado,
        confianza_promedio,
        usuario_procesador_id,
        relacionado_con_id,
        relacionado_con_tipo
    ) VALUES (
        p_tipo,
        p_archivo_url,
        p_datos_extraidos,
        p_estado,
        p_confianza_promedio,
        p_usuario_procesador_id,
        p_relacionado_con_id,
        p_relacionado_con_tipo
    )
    RETURNING id INTO v_documento_id;

    -- Registrar extracciones individuales si están disponibles
    IF p_datos_extraidos IS NOT NULL THEN
        -- Extraer campos comunes
        IF p_datos_extraidos->>'numero' IS NOT NULL THEN
            INSERT INTO extracciones_documentos (
                documento_id,
                campo_nombre,
                valor_extraido,
                valor_normalizado,
                tipo_campo
            ) VALUES (
                v_documento_id,
                'numero',
                p_datos_extraidos->>'numero',
                p_datos_extraidos->>'numero',
                'texto'
            );
        END IF;

        IF p_datos_extraidos->>'fecha' IS NOT NULL THEN
            INSERT INTO extracciones_documentos (
                documento_id,
                campo_nombre,
                valor_extraido,
                valor_normalizado,
                tipo_campo
            ) VALUES (
                v_documento_id,
                'fecha',
                p_datos_extraidos->>'fecha',
                p_datos_extraidos->>'fecha',
                'fecha'
            );
        END IF;

        IF p_datos_extraidos->>'proveedor' IS NOT NULL THEN
            INSERT INTO extracciones_documentos (
                documento_id,
                campo_nombre,
                valor_extraido,
                valor_normalizado,
                tipo_campo
            ) VALUES (
                v_documento_id,
                'proveedor',
                p_datos_extraidos->>'proveedor',
                p_datos_extraidos->>'proveedor',
                'texto'
            );
        END IF;

        IF p_datos_extraidos->>'total' IS NOT NULL THEN
            INSERT INTO extracciones_documentos (
                documento_id,
                campo_nombre,
                valor_extraido,
                valor_normalizado,
                tipo_campo
            ) VALUES (
                v_documento_id,
                'total',
                p_datos_extraidos->>'total',
                p_datos_extraidos->>'total',
                'moneda'
            );
        END IF;
    END IF;

    RETURN v_documento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN: fn_obtener_documentos_pendientes
-- Obtiene documentos pendientes de procesar
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_documentos_pendientes()
RETURNS TABLE (
    id UUID,
    tipo VARCHAR(50),
    archivo_url TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.tipo,
        d.archivo_url,
        d.created_at
    FROM documentos_procesados d
    WHERE d.estado = 'procesando'
    ORDER BY d.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos
GRANT SELECT, INSERT, UPDATE ON documentos_procesados TO authenticated;
GRANT SELECT, INSERT ON extracciones_documentos TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_documento_procesado TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_documentos_pendientes TO authenticated;

COMMIT;

