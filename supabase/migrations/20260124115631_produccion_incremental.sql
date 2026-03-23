-- Agregar columna cantidad_unidades si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orden_produccion_entradas' AND column_name = 'cantidad_unidades') THEN
        ALTER TABLE orden_produccion_entradas ADD COLUMN cantidad_unidades INTEGER DEFAULT 1;
    END IF;
END $$;

-- Tabla de progreso de producción
CREATE TABLE IF NOT EXISTS produccion_progreso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id UUID NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    destino_id UUID REFERENCES destinos_produccion(id),
    cantidad_objetivo INTEGER DEFAULT 0,
    peso_objetivo_kg DECIMAL(10,3),
    cantidad_producida INTEGER DEFAULT 0,
    peso_producido_kg DECIMAL(10,3) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(orden_id, producto_id, destino_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produccion_progreso_orden ON produccion_progreso(orden_id);

-- RLS
ALTER TABLE produccion_progreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produccion_progreso_all_authenticated" ON produccion_progreso;
CREATE POLICY "produccion_progreso_all_authenticated"
    ON produccion_progreso FOR ALL TO authenticated USING (true);

-- Función para establecer objetivo
CREATE OR REPLACE FUNCTION fn_establecer_objetivo_produccion(
    p_orden_id UUID,
    p_producto_id UUID,
    p_destino_id UUID,
    p_cantidad_objetivo INTEGER,
    p_peso_objetivo_kg DECIMAL(10,3) DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_progreso_id UUID;
BEGIN
    INSERT INTO produccion_progreso (orden_id, producto_id, destino_id, cantidad_objetivo, peso_objetivo_kg)
    VALUES (p_orden_id, p_producto_id, p_destino_id, p_cantidad_objetivo, p_peso_objetivo_kg)
    ON CONFLICT (orden_id, producto_id, destino_id)
    DO UPDATE SET
        cantidad_objetivo = p_cantidad_objetivo,
        peso_objetivo_kg = COALESCE(p_peso_objetivo_kg, produccion_progreso.peso_objetivo_kg),
        updated_at = NOW()
    RETURNING id INTO v_progreso_id;
    
    RETURN json_build_object('success', true, 'progreso_id', v_progreso_id);
END;
$$;

-- Función para obtener progreso
CREATE OR REPLACE FUNCTION fn_obtener_progreso_produccion(p_orden_id UUID)
RETURNS TABLE (
    producto_id UUID,
    producto_nombre VARCHAR,
    producto_codigo VARCHAR,
    destino_id UUID,
    destino_nombre VARCHAR,
    cantidad_objetivo INTEGER,
    cantidad_producida INTEGER,
    peso_objetivo_kg DECIMAL,
    peso_producido_kg DECIMAL,
    porcentaje_completado DECIMAL,
    completado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pp.producto_id,
        p.nombre as producto_nombre,
        p.codigo as producto_codigo,
        pp.destino_id,
        COALESCE(d.nombre, 'Sin destino')::VARCHAR as destino_nombre,
        pp.cantidad_objetivo,
        pp.cantidad_producida,
        pp.peso_objetivo_kg,
        pp.peso_producido_kg,
        CASE 
            WHEN pp.cantidad_objetivo > 0 
            THEN (pp.cantidad_producida::DECIMAL / pp.cantidad_objetivo * 100)
            ELSE 0
        END as porcentaje_completado,
        pp.cantidad_producida >= pp.cantidad_objetivo as completado
    FROM produccion_progreso pp
    JOIN productos p ON p.id = pp.producto_id
    LEFT JOIN destinos_produccion d ON d.id = pp.destino_id
    WHERE pp.orden_id = p_orden_id
    ORDER BY d.nombre, p.nombre;
END;
$$;;
