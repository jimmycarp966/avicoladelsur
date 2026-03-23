-- Tabla principal de conteos
CREATE TABLE IF NOT EXISTS conteos_stock_turno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(10) NOT NULL CHECK (turno IN ('mañana', 'noche')),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'completado', 'cancelado', 'timeout')),
    hora_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hora_fin TIMESTAMPTZ,
    duracion_minutos INTEGER,
    observaciones TEXT,
    produccion_en_curso BOOLEAN DEFAULT false,
    ordenes_produccion_ids UUID[],
    cajones_faltantes INTEGER DEFAULT 0,
    total_productos_contados INTEGER DEFAULT 0,
    total_diferencias INTEGER DEFAULT 0,
    monto_diferencia_estimado DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fecha, turno)
);

-- Items del conteo
CREATE TABLE IF NOT EXISTS conteos_stock_turno_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conteo_id UUID NOT NULL REFERENCES conteos_stock_turno(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad_sistema DECIMAL(10,3) NOT NULL,
    cantidad_fisica DECIMAL(10,3),
    diferencia DECIMAL(10,3) GENERATED ALWAYS AS (COALESCE(cantidad_fisica, 0) - cantidad_sistema) STORED,
    diferencia_porcentaje DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN cantidad_sistema > 0 THEN ((COALESCE(cantidad_fisica, 0) - cantidad_sistema) / cantidad_sistema) * 100
            ELSE 0 
        END
    ) STORED,
    diferencia_valor DECIMAL(12,2),
    observacion TEXT,
    hora_conteo TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conteo_id, producto_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_fecha ON conteos_stock_turno(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_usuario ON conteos_stock_turno(usuario_id);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_estado ON conteos_stock_turno(estado);
CREATE INDEX IF NOT EXISTS idx_conteos_stock_turno_items_conteo ON conteos_stock_turno_items(conteo_id);

-- RLS
ALTER TABLE conteos_stock_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteos_stock_turno_items ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "conteos_stock_turno_select_authenticated" ON conteos_stock_turno;
CREATE POLICY "conteos_stock_turno_select_authenticated"
    ON conteos_stock_turno FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "conteos_stock_turno_insert_authenticated" ON conteos_stock_turno;
CREATE POLICY "conteos_stock_turno_insert_authenticated"
    ON conteos_stock_turno FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "conteos_stock_turno_update_authenticated" ON conteos_stock_turno;
CREATE POLICY "conteos_stock_turno_update_authenticated"
    ON conteos_stock_turno FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "conteos_stock_turno_items_all_authenticated" ON conteos_stock_turno_items;
CREATE POLICY "conteos_stock_turno_items_all_authenticated"
    ON conteos_stock_turno_items FOR ALL TO authenticated USING (true);;
