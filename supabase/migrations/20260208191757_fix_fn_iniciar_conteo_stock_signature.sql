-- =========================================
-- FIX: Actualizar fn_iniciar_conteo_stock para usar p_turno
-- El código llama con { p_turno: 'mañana' | 'noche' }
-- pero la función actual tiene (p_sucursal_id uuid, p_usuario_id uuid)
-- =========================================

-- Primero crear la tabla de conteos por turno si no existe
CREATE TABLE IF NOT EXISTS conteos_stock_turno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(10) NOT NULL CHECK (turno IN ('mañana', 'noche')),
    usuario_id UUID REFERENCES auth.users(id),
    hora_inicio TIMESTAMPTZ DEFAULT NOW(),
    hora_fin TIMESTAMPTZ,
    estado VARCHAR(20) DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'completado', 'cancelado', 'timeout')),
    produccion_en_curso BOOLEAN DEFAULT false,
    ordenes_produccion_ids UUID[],
    cajones_faltantes INTEGER DEFAULT 0,
    total_productos_contados INTEGER DEFAULT 0,
    total_diferencias INTEGER DEFAULT 0,
    duracion_minutos INTEGER,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fecha, turno)
);

-- Crear tabla de items de conteo si no existe
CREATE TABLE IF NOT EXISTS conteos_stock_turno_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conteo_id UUID NOT NULL REFERENCES conteos_stock_turno(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad_sistema DECIMAL(12,3) NOT NULL DEFAULT 0,
    cantidad_fisica DECIMAL(12,3),
    diferencia DECIMAL(12,3) DEFAULT 0,
    diferencia_porcentaje DECIMAL(5,2) DEFAULT 0,
    diferencia_valor DECIMAL(12,2) DEFAULT 0,
    hora_conteo TIMESTAMPTZ,
    observacion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conteo_id, producto_id)
);

-- Crear función auxiliar para verificar producción en curso si no existe  
CREATE OR REPLACE FUNCTION fn_verificar_produccion_en_curso()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ordenes JSON;
    v_cantidad INTEGER;
    v_cajones INTEGER;
BEGIN
    SELECT 
        json_agg(id),
        COUNT(*)::integer,
        COALESCE(SUM(
            CASE WHEN estado = 'en_proceso' THEN 
                -- Estimar cajones faltantes (salidas - entradas completadas)
                GREATEST(0, (SELECT COALESCE(SUM(cantidad), 0) FROM ordenes_produccion_salidas WHERE orden_id = op.id) -
                            (SELECT COALESCE(SUM(cantidad), 0) FROM ordenes_produccion_entradas WHERE orden_id = op.id))
            ELSE 0 END
        ), 0)::integer
    INTO v_ordenes, v_cantidad, v_cajones
    FROM ordenes_produccion op
    WHERE op.estado = 'en_proceso';

    RETURN json_build_object(
        'en_curso', v_cantidad > 0,
        'ordenes_ids', COALESCE(v_ordenes, '[]'::json),
        'cantidad_ordenes', COALESCE(v_cantidad, 0),
        'cajones_faltantes', COALESCE(v_cajones, 0)
    );
END;
$$;

-- Recrear fn_iniciar_conteo_stock con la firma correcta (p_turno)
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
        ARRAY(SELECT jsonb_array_elements_text(v_produccion::jsonb->'ordenes_ids')::uuid),
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

-- Habilitar RLS en las tablas nuevas
ALTER TABLE conteos_stock_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteos_stock_turno_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para conteos_stock_turno
DROP POLICY IF EXISTS "conteos_stock_turno_select_policy" ON conteos_stock_turno;
CREATE POLICY "conteos_stock_turno_select_policy" ON conteos_stock_turno
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "conteos_stock_turno_insert_policy" ON conteos_stock_turno;
CREATE POLICY "conteos_stock_turno_insert_policy" ON conteos_stock_turno
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "conteos_stock_turno_update_policy" ON conteos_stock_turno;
CREATE POLICY "conteos_stock_turno_update_policy" ON conteos_stock_turno
    FOR UPDATE TO authenticated USING (true);

-- Políticas RLS para conteos_stock_turno_items
DROP POLICY IF EXISTS "conteos_stock_turno_items_select_policy" ON conteos_stock_turno_items;
CREATE POLICY "conteos_stock_turno_items_select_policy" ON conteos_stock_turno_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "conteos_stock_turno_items_insert_policy" ON conteos_stock_turno_items;
CREATE POLICY "conteos_stock_turno_items_insert_policy" ON conteos_stock_turno_items
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "conteos_stock_turno_items_update_policy" ON conteos_stock_turno_items;
CREATE POLICY "conteos_stock_turno_items_update_policy" ON conteos_stock_turno_items
    FOR UPDATE TO authenticated USING (true);

-- Comentario de documentación
COMMENT ON FUNCTION fn_iniciar_conteo_stock(VARCHAR) IS 'Inicia un conteo de stock para un turno específico (mañana/noche). Auto-detecta producción en curso.';;
