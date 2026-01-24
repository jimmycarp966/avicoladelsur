-- =========================================
-- CONTROL DE STOCK POR TURNOS (AUDITORÍA)
-- =========================================
-- Fecha: 2026-01-24
-- Descripción: Sistema de conteo físico de stock por turnos mañana/noche
-- Skill: erp-sucursales-auditoria, supabase-rls-audit

-- Tabla principal de conteos
CREATE TABLE IF NOT EXISTS conteos_stock_turno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(10) NOT NULL CHECK (turno IN ('mañana', 'noche')),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'completado', 'cancelado', 'timeout')),
    hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hora_fin TIMESTAMPTZ,
    duracion_minutos INTEGER, -- Calculado al cerrar
    observaciones TEXT,
    -- Aviso de producción en curso
    produccion_en_curso BOOLEAN DEFAULT false,
    ordenes_produccion_ids UUID[], -- IDs de órdenes activas
    cajones_faltantes INTEGER DEFAULT 0, -- Cajones que faltan por producir
    -- Estadísticas
    total_productos_contados INTEGER DEFAULT 0,
    total_diferencias INTEGER DEFAULT 0,
    monto_diferencia_estimado DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fecha, turno) -- Solo un conteo por fecha/turno
);

-- Items del conteo
CREATE TABLE IF NOT EXISTS conteos_stock_turno_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conteo_id UUID NOT NULL REFERENCES conteos_stock_turno(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    -- Cantidades
    cantidad_sistema DECIMAL(10,3) NOT NULL, -- Stock según sistema
    cantidad_fisica DECIMAL(10,3), -- Cantidad contada físicamente
    diferencia DECIMAL(10,3) GENERATED ALWAYS AS (COALESCE(cantidad_fisica, 0) - cantidad_sistema) STORED,
    -- Porcentaje de diferencia
    diferencia_porcentaje DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN cantidad_sistema > 0 THEN ((COALESCE(cantidad_fisica, 0) - cantidad_sistema) / cantidad_sistema) * 100
            ELSE 0 
        END
    ) STORED,
    -- Valor económico de la diferencia
    diferencia_valor DECIMAL(12,2), -- Calculado como diferencia × precio_costo
    observacion TEXT,
    hora_conteo TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conteo_id, producto_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_fecha ON conteos_stock_turno(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_usuario ON conteos_stock_turno(usuario_id);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_estado ON conteos_stock_turno(estado);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_items_conteo ON conteos_stock_turno_items(conteo_id);

-- RLS Habilitado
ALTER TABLE conteos_stock_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteos_stock_turno_items ENABLE ROW LEVEL SECURITY;

-- Políticas: Solo usuarios autenticados
CREATE POLICY "conteos_stock_turno_select_authenticated"
    ON conteos_stock_turno FOR SELECT TO authenticated USING (true);

CREATE POLICY "conteos_stock_turno_insert_authenticated"
    ON conteos_stock_turno FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = usuario_id
    );

CREATE POLICY "conteos_stock_turno_update_authenticated"
    ON conteos_stock_turno FOR UPDATE TO authenticated USING (
        auth.uid() = usuario_id OR
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
    );

CREATE POLICY "conteos_stock_turno_items_all_authenticated"
    ON conteos_stock_turno_items FOR ALL TO authenticated USING (true);

-- =========================================
-- FUNCIONES RPC
-- =========================================

-- Función para verificar producción en curso
CREATE OR REPLACE FUNCTION fn_verificar_produccion_en_curso()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ordenes_activas UUID[];
    v_cajones_faltantes INTEGER := 0;
    v_productos_en_proceso INTEGER := 0;
BEGIN
    -- Buscar órdenes de producción en proceso
    SELECT ARRAY_AGG(id) INTO v_ordenes_activas
    FROM ordenes_produccion
    WHERE estado = 'en_proceso';

    IF v_ordenes_activas IS NOT NULL AND ARRAY_LENGTH(v_ordenes_activas, 1) > 0 THEN
        -- Contar productos que faltan por procesar
        -- Esto se basa en las salidas (materias primas) menos las entradas (productos generados)
        SELECT 
            COALESCE(SUM(GREATEST(0, s.cantidad - COALESCE(e.cantidad_generada, 0))), 0)
        INTO v_cajones_faltantes
        FROM orden_produccion_salidas s
        LEFT JOIN (
            SELECT orden_id, COUNT(*) as cantidad_generada
            FROM orden_produccion_entradas
            GROUP BY orden_id
        ) e ON s.orden_id = e.orden_id
        WHERE s.orden_id = ANY(v_ordenes_activas);
    END IF;

    RETURN json_build_object(
        'en_curso', v_ordenes_activas IS NOT NULL AND ARRAY_LENGTH(v_ordenes_activas, 1) > 0,
        'ordenes_ids', COALESCE(v_ordenes_activas, ARRAY[]::UUID[]),
        'cantidad_ordenes', COALESCE(ARRAY_LENGTH(v_ordenes_activas, 1), 0),
        'cajones_faltantes', v_cajones_faltantes
    );
END;
$$;

-- Función para iniciar conteo de stock
CREATE OR REPLACE FUNCTION fn_iniciar_conteo_stock(
    p_turno VARCHAR(10)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conteo_id UUID;
    v_fecha DATE := CURRENT_DATE;
    v_produccion JSON;
    v_usuario_id UUID := auth.uid();
BEGIN
    -- Verificar turno válido
    IF p_turno NOT IN ('mañana', 'noche') THEN
        RETURN json_build_object('success', false, 'error', 'Turno inválido. Usar: mañana o noche');
    END IF;

    -- Verificar si ya existe un conteo para esta fecha/turno
    IF EXISTS (SELECT 1 FROM conteos_stock_turno WHERE fecha = v_fecha AND turno = p_turno) THEN
        RETURN json_build_object('success', false, 'error', 'Ya existe un conteo para este turno hoy');
    END IF;

    -- Verificar producción en curso
    v_produccion := fn_verificar_produccion_en_curso();

    -- Crear conteo
    INSERT INTO conteos_stock_turno (
        fecha,
        turno,
        usuario_id,
        produccion_en_curso,
        ordenes_produccion_ids,
        cajones_faltantes
    ) VALUES (
        v_fecha,
        p_turno,
        v_usuario_id,
        (v_produccion->>'en_curso')::boolean,
        ARRAY(SELECT jsonb_array_elements_text(v_produccion->'ordenes_ids')::uuid),
        (v_produccion->>'cajones_faltantes')::integer
    )
    RETURNING id INTO v_conteo_id;

    -- Pre-cargar todos los productos con su stock actual
    INSERT INTO conteos_stock_turno_items (conteo_id, producto_id, cantidad_sistema)
    SELECT 
        v_conteo_id,
        p.id,
        COALESCE(SUM(l.cantidad_disponible), 0) as stock_sistema
    FROM productos p
    LEFT JOIN lotes l ON l.producto_id = p.id AND l.cantidad_disponible > 0
    WHERE p.activo = true
    GROUP BY p.id
    ORDER BY p.nombre;

    RETURN json_build_object(
        'success', true,
        'conteo_id', v_conteo_id,
        'turno', p_turno,
        'fecha', v_fecha,
        'produccion_en_curso', (v_produccion->>'en_curso')::boolean,
        'cajones_faltantes', (v_produccion->>'cajones_faltantes')::integer
    );
END;
$$;

-- Función para registrar conteo de un item
CREATE OR REPLACE FUNCTION fn_registrar_conteo_item(
    p_conteo_id UUID,
    p_producto_id UUID,
    p_cantidad_fisica DECIMAL(10,3),
    p_observacion TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conteo_estado VARCHAR(20);
    v_diferencia DECIMAL(10,3);
    v_precio_costo DECIMAL(10,2);
    v_diferencia_valor DECIMAL(12,2);
BEGIN
    -- Verificar que el conteo existe y está en progreso
    SELECT estado INTO v_conteo_estado
    FROM conteos_stock_turno
    WHERE id = p_conteo_id;

    IF v_conteo_estado IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Conteo no encontrado');
    END IF;

    IF v_conteo_estado != 'en_progreso' THEN
        RETURN json_build_object('success', false, 'error', 'El conteo ya fue finalizado');
    END IF;

    -- Obtener precio costo del producto para calcular diferencia en valor
    SELECT COALESCE(precio_costo, 0) INTO v_precio_costo
    FROM productos
    WHERE id = p_producto_id;

    -- Calcular diferencia en valor
    SELECT p_cantidad_fisica - cantidad_sistema INTO v_diferencia
    FROM conteos_stock_turno_items
    WHERE conteo_id = p_conteo_id AND producto_id = p_producto_id;

    v_diferencia_valor := v_diferencia * v_precio_costo;

    -- Actualizar item
    UPDATE conteos_stock_turno_items
    SET 
        cantidad_fisica = p_cantidad_fisica,
        diferencia_valor = v_diferencia_valor,
        observacion = p_observacion,
        hora_conteo = NOW()
    WHERE conteo_id = p_conteo_id AND producto_id = p_producto_id;

    RETURN json_build_object(
        'success', true,
        'diferencia', v_diferencia,
        'diferencia_valor', v_diferencia_valor
    );
END;
$$;

-- Función para finalizar conteo
CREATE OR REPLACE FUNCTION fn_finalizar_conteo_stock(
    p_conteo_id UUID,
    p_observaciones TEXT DEFAULT NULL,
    p_forzar BOOLEAN DEFAULT false -- Para cerrar incluso si pasó 1 hora
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conteo RECORD;
    v_duracion INTEGER;
    v_total_contados INTEGER;
    v_total_diferencias INTEGER;
    v_monto_diferencia DECIMAL(12,2);
    v_nuevo_estado VARCHAR(20);
BEGIN
    -- Obtener conteo
    SELECT * INTO v_conteo
    FROM conteos_stock_turno
    WHERE id = p_conteo_id;

    IF v_conteo IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Conteo no encontrado');
    END IF;

    IF v_conteo.estado != 'en_progreso' THEN
        RETURN json_build_object('success', false, 'error', 'El conteo ya fue finalizado');
    END IF;

    -- Calcular duración en minutos
    v_duracion := EXTRACT(EPOCH FROM (NOW() - v_conteo.hora_inicio)) / 60;

    -- Determinar estado: si pasó más de 1 hora, marcar como timeout
    IF v_duracion > 60 AND NOT p_forzar THEN
        v_nuevo_estado := 'timeout';
    ELSE
        v_nuevo_estado := 'completado';
    END IF;

    -- Calcular estadísticas
    SELECT 
        COUNT(*) FILTER (WHERE cantidad_fisica IS NOT NULL),
        COUNT(*) FILTER (WHERE diferencia != 0),
        COALESCE(SUM(ABS(diferencia_valor)), 0)
    INTO v_total_contados, v_total_diferencias, v_monto_diferencia
    FROM conteos_stock_turno_items
    WHERE conteo_id = p_conteo_id;

    -- Actualizar conteo
    UPDATE conteos_stock_turno
    SET 
        estado = v_nuevo_estado,
        hora_fin = NOW(),
        duracion_minutos = v_duracion,
        observaciones = COALESCE(p_observaciones, observaciones),
        total_productos_contados = v_total_contados,
        total_diferencias = v_total_diferencias,
        monto_diferencia_estimado = v_monto_diferencia,
        updated_at = NOW()
    WHERE id = p_conteo_id;

    RETURN json_build_object(
        'success', true,
        'estado', v_nuevo_estado,
        'duracion_minutos', v_duracion,
        'excedio_tiempo', v_duracion > 60,
        'total_productos_contados', v_total_contados,
        'total_diferencias', v_total_diferencias,
        'monto_diferencia_estimado', v_monto_diferencia
    );
END;
$$;
