-- =====================================================
-- SISTEMA DE PRODUCCIÓN Y DESPOSTE
-- Trazabilidad de transformación de productos
-- =====================================================

-- ===========================================
-- TABLAS PRINCIPALES
-- ===========================================

-- Órdenes de producción (registro de transformaciones)
CREATE TABLE IF NOT EXISTS ordenes_produccion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_orden VARCHAR(50) UNIQUE NOT NULL,
    fecha_produccion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado VARCHAR(30) DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'completada', 'cancelada')),
    operario_id UUID REFERENCES usuarios(id),
    observaciones TEXT,
    -- Métricas calculadas
    peso_total_entrada DECIMAL(10,3) DEFAULT 0,
    peso_total_salida DECIMAL(10,3) DEFAULT 0,
    merma_kg DECIMAL(10,3) DEFAULT 0,
    merma_porcentaje DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entradas de producción (productos consumidos/egresados)
CREATE TABLE IF NOT EXISTS orden_produccion_entradas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id UUID NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_id UUID REFERENCES lotes(id), -- lote específico consumido
    cantidad DECIMAL(10,3) NOT NULL,
    peso_kg DECIMAL(10,3), -- peso total consumido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Salidas de producción (productos generados)
CREATE TABLE IF NOT EXISTS orden_produccion_salidas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id UUID NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_generado_id UUID REFERENCES lotes(id), -- lote creado automáticamente
    cantidad DECIMAL(10,3) NOT NULL DEFAULT 1,
    peso_kg DECIMAL(10,3) NOT NULL, -- peso medido en balanza
    plu VARCHAR(20), -- código PLU para etiqueta
    fecha_vencimiento DATE,
    pesaje_id UUID, -- referencia al pesaje de balanza
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración de balanza
CREATE TABLE IF NOT EXISTS balanza_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    modelo VARCHAR(100), -- SDP BBC-4030
    indicador VARCHAR(100), -- SDP 32
    puerto VARCHAR(50), -- COM3, /dev/ttyUSB0, etc.
    baudrate INTEGER DEFAULT 9600,
    data_bits INTEGER DEFAULT 8,
    parity VARCHAR(10) DEFAULT 'none' CHECK (parity IN ('none', 'even', 'odd')),
    stop_bits INTEGER DEFAULT 1,
    activa BOOLEAN DEFAULT true,
    ultima_sincronizacion TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registro de pesajes (historial)
CREATE TABLE IF NOT EXISTS pesajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    balanza_id UUID REFERENCES balanza_config(id),
    producto_id UUID REFERENCES productos(id),
    orden_produccion_id UUID REFERENCES ordenes_produccion(id),
    peso_bruto DECIMAL(10,3) NOT NULL,
    tara DECIMAL(10,3) DEFAULT 0,
    peso_neto DECIMAL(10,3) NOT NULL,
    unidad VARCHAR(10) DEFAULT 'kg',
    operario_id UUID REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- MODIFICACIONES A TABLA LOTES
-- ===========================================

-- Agregar referencia a orden de producción
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS orden_produccion_id UUID REFERENCES ordenes_produccion(id);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS es_produccion BOOLEAN DEFAULT false;

-- Eliminar campo costo_unitario (ya no se usa)
ALTER TABLE lotes DROP COLUMN IF EXISTS costo_unitario;

-- ===========================================
-- ÍNDICES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_fecha ON ordenes_produccion(fecha_produccion);
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_estado ON ordenes_produccion(estado);
CREATE INDEX IF NOT EXISTS idx_orden_entradas_orden_id ON orden_produccion_entradas(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_salidas_orden_id ON orden_produccion_salidas(orden_id);
CREATE INDEX IF NOT EXISTS idx_pesajes_orden_id ON pesajes(orden_produccion_id);
CREATE INDEX IF NOT EXISTS idx_lotes_orden_produccion ON lotes(orden_produccion_id);

-- ===========================================
-- FUNCIONES RPC
-- ===========================================

-- Función para generar número de orden
CREATE OR REPLACE FUNCTION fn_generar_numero_orden()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_fecha TEXT;
    v_secuencia INTEGER;
    v_numero VARCHAR(50);
BEGIN
    v_fecha := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(numero_orden FROM 'OP-[0-9]{8}-([0-9]+)') AS INTEGER)
    ), 0) + 1
    INTO v_secuencia
    FROM ordenes_produccion
    WHERE numero_orden LIKE 'OP-' || v_fecha || '-%';
    
    v_numero := 'OP-' || v_fecha || '-' || LPAD(v_secuencia::TEXT, 4, '0');
    
    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- Función para crear orden de producción
CREATE OR REPLACE FUNCTION fn_crear_orden_produccion(
    p_operario_id UUID,
    p_observaciones TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_orden_id UUID;
    v_numero_orden VARCHAR(50);
BEGIN
    v_numero_orden := fn_generar_numero_orden();
    
    INSERT INTO ordenes_produccion (
        numero_orden,
        operario_id,
        observaciones
    ) VALUES (
        v_numero_orden,
        p_operario_id,
        p_observaciones
    ) RETURNING id INTO v_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'orden_id', v_orden_id,
        'numero_orden', v_numero_orden
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para agregar entrada (producto a consumir)
CREATE OR REPLACE FUNCTION fn_agregar_entrada_produccion(
    p_orden_id UUID,
    p_producto_id UUID,
    p_lote_id UUID,
    p_cantidad DECIMAL,
    p_peso_kg DECIMAL DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_lote RECORD;
    v_entrada_id UUID;
BEGIN
    -- Verificar que el lote existe y tiene stock
    SELECT * INTO v_lote FROM lotes WHERE id = p_lote_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lote no encontrado');
    END IF;
    
    IF v_lote.cantidad_disponible < p_cantidad THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente en el lote');
    END IF;
    
    -- Insertar entrada
    INSERT INTO orden_produccion_entradas (
        orden_id,
        producto_id,
        lote_id,
        cantidad,
        peso_kg
    ) VALUES (
        p_orden_id,
        p_producto_id,
        p_lote_id,
        p_cantidad,
        p_peso_kg
    ) RETURNING id INTO v_entrada_id;
    
    -- Descontar del lote (reservar)
    UPDATE lotes
    SET cantidad_disponible = cantidad_disponible - p_cantidad,
        estado = CASE WHEN cantidad_disponible - p_cantidad <= 0 THEN 'agotado' ELSE estado END,
        updated_at = NOW()
    WHERE id = p_lote_id;
    
    -- Registrar movimiento de stock
    INSERT INTO movimientos_stock (
        lote_id,
        tipo_movimiento,
        cantidad,
        motivo,
        usuario_id
    ) VALUES (
        p_lote_id,
        'salida',
        p_cantidad,
        'Consumido en orden de producción ' || (SELECT numero_orden FROM ordenes_produccion WHERE id = p_orden_id),
        (SELECT operario_id FROM ordenes_produccion WHERE id = p_orden_id)
    );
    
    -- Actualizar peso total entrada en orden
    UPDATE ordenes_produccion
    SET peso_total_entrada = peso_total_entrada + COALESCE(p_peso_kg, 0),
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'entrada_id', v_entrada_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para agregar salida (producto generado con peso)
CREATE OR REPLACE FUNCTION fn_agregar_salida_produccion(
    p_orden_id UUID,
    p_producto_id UUID,
    p_peso_kg DECIMAL,
    p_cantidad DECIMAL DEFAULT 1,
    p_plu VARCHAR DEFAULT NULL,
    p_fecha_vencimiento DATE DEFAULT NULL,
    p_pesaje_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_salida_id UUID;
BEGIN
    INSERT INTO orden_produccion_salidas (
        orden_id,
        producto_id,
        peso_kg,
        cantidad,
        plu,
        fecha_vencimiento,
        pesaje_id
    ) VALUES (
        p_orden_id,
        p_producto_id,
        p_peso_kg,
        p_cantidad,
        p_plu,
        COALESCE(p_fecha_vencimiento, CURRENT_DATE + INTERVAL '7 days'),
        p_pesaje_id
    ) RETURNING id INTO v_salida_id;
    
    -- Actualizar peso total salida en orden
    UPDATE ordenes_produccion
    SET peso_total_salida = peso_total_salida + p_peso_kg,
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'salida_id', v_salida_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para completar orden y generar lotes
CREATE OR REPLACE FUNCTION fn_completar_orden_produccion(
    p_orden_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_orden RECORD;
    v_salida RECORD;
    v_lote_id UUID;
    v_numero_lote VARCHAR(50);
    v_lotes_generados JSONB := '[]'::JSONB;
    v_fecha TEXT;
    v_secuencia INTEGER;
    v_merma DECIMAL;
    v_merma_pct DECIMAL;
BEGIN
    -- Obtener orden
    SELECT * INTO v_orden FROM ordenes_produccion WHERE id = p_orden_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
    END IF;
    
    IF v_orden.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La orden ya fue procesada');
    END IF;
    
    -- Calcular merma
    v_merma := v_orden.peso_total_entrada - v_orden.peso_total_salida;
    v_merma_pct := CASE 
        WHEN v_orden.peso_total_entrada > 0 
        THEN (v_merma / v_orden.peso_total_entrada) * 100 
        ELSE 0 
    END;
    
    -- Generar lotes para cada salida
    v_fecha := TO_CHAR(NOW(), 'YYYYMMDD');
    
    FOR v_salida IN SELECT * FROM orden_produccion_salidas WHERE orden_id = p_orden_id LOOP
        -- Generar número de lote único
        SELECT COALESCE(MAX(
            CAST(SUBSTRING(numero_lote FROM 'LP-[0-9]{8}-([0-9]+)') AS INTEGER)
        ), 0) + 1
        INTO v_secuencia
        FROM lotes
        WHERE numero_lote LIKE 'LP-' || v_fecha || '-%';
        
        v_numero_lote := 'LP-' || v_fecha || '-' || LPAD(v_secuencia::TEXT, 4, '0');
        
        -- Crear lote
        INSERT INTO lotes (
            numero_lote,
            producto_id,
            cantidad_ingresada,
            cantidad_disponible,
            fecha_ingreso,
            fecha_vencimiento,
            ubicacion_almacen,
            estado,
            orden_produccion_id,
            es_produccion
        ) VALUES (
            v_numero_lote,
            v_salida.producto_id,
            v_salida.peso_kg,
            v_salida.peso_kg,
            CURRENT_DATE,
            v_salida.fecha_vencimiento,
            'PRODUCCION',
            'disponible',
            p_orden_id,
            true
        ) RETURNING id INTO v_lote_id;
        
        -- Actualizar salida con lote generado
        UPDATE orden_produccion_salidas
        SET lote_generado_id = v_lote_id
        WHERE id = v_salida.id;
        
        -- Registrar movimiento de stock
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_lote_id,
            'ingreso',
            v_salida.peso_kg,
            'Generado por orden de producción ' || v_orden.numero_orden,
            v_orden.operario_id
        );
        
        v_lotes_generados := v_lotes_generados || jsonb_build_object(
            'lote_id', v_lote_id,
            'numero_lote', v_numero_lote,
            'producto_id', v_salida.producto_id,
            'peso_kg', v_salida.peso_kg
        );
    END LOOP;
    
    -- Marcar orden como completada
    UPDATE ordenes_produccion
    SET estado = 'completada',
        merma_kg = v_merma,
        merma_porcentaje = v_merma_pct,
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'lotes_generados', v_lotes_generados,
        'merma_kg', v_merma,
        'merma_porcentaje', v_merma_pct
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cancelar orden (revierte stock)
CREATE OR REPLACE FUNCTION fn_cancelar_orden_produccion(
    p_orden_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_orden RECORD;
    v_entrada RECORD;
BEGIN
    SELECT * INTO v_orden FROM ordenes_produccion WHERE id = p_orden_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
    END IF;
    
    IF v_orden.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cancelar órdenes en proceso');
    END IF;
    
    -- Revertir stock de entradas
    FOR v_entrada IN SELECT * FROM orden_produccion_entradas WHERE orden_id = p_orden_id LOOP
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible + v_entrada.cantidad,
            estado = 'disponible',
            updated_at = NOW()
        WHERE id = v_entrada.lote_id;
        
        -- Registrar movimiento de reversión
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_entrada.lote_id,
            'ajuste',
            v_entrada.cantidad,
            'Reversión por cancelación de orden ' || v_orden.numero_orden,
            v_orden.operario_id
        );
    END LOOP;
    
    -- Marcar como cancelada
    UPDATE ordenes_produccion
    SET estado = 'cancelada',
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar pesaje
CREATE OR REPLACE FUNCTION fn_registrar_pesaje(
    p_balanza_id UUID,
    p_producto_id UUID,
    p_orden_produccion_id UUID,
    p_peso_bruto DECIMAL,
    p_tara DECIMAL DEFAULT 0,
    p_operario_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pesaje_id UUID;
    v_peso_neto DECIMAL;
BEGIN
    v_peso_neto := p_peso_bruto - p_tara;
    
    INSERT INTO pesajes (
        balanza_id,
        producto_id,
        orden_produccion_id,
        peso_bruto,
        tara,
        peso_neto,
        operario_id
    ) VALUES (
        p_balanza_id,
        p_producto_id,
        p_orden_produccion_id,
        p_peso_bruto,
        p_tara,
        v_peso_neto,
        p_operario_id
    ) RETURNING id INTO v_pesaje_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'pesaje_id', v_pesaje_id,
        'peso_neto', v_peso_neto
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- POLÍTICAS RLS
-- ===========================================

ALTER TABLE ordenes_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_produccion_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_produccion_salidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE balanza_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesajes ENABLE ROW LEVEL SECURITY;

-- Políticas para ordenes_produccion
CREATE POLICY "ordenes_produccion_read_all" ON ordenes_produccion
    FOR SELECT USING (true);

CREATE POLICY "ordenes_produccion_insert_staff" ON ordenes_produccion
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

CREATE POLICY "ordenes_produccion_update_staff" ON ordenes_produccion
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

-- Políticas para entradas/salidas
CREATE POLICY "orden_entradas_read_all" ON orden_produccion_entradas
    FOR SELECT USING (true);

CREATE POLICY "orden_entradas_insert_staff" ON orden_produccion_entradas
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

CREATE POLICY "orden_salidas_read_all" ON orden_produccion_salidas
    FOR SELECT USING (true);

CREATE POLICY "orden_salidas_insert_staff" ON orden_produccion_salidas
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

-- Políticas para configuración de balanza (solo admin)
CREATE POLICY "balanza_config_read_all" ON balanza_config
    FOR SELECT USING (true);

CREATE POLICY "balanza_config_admin" ON balanza_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
    );

-- Políticas para pesajes
CREATE POLICY "pesajes_read_all" ON pesajes
    FOR SELECT USING (true);

CREATE POLICY "pesajes_insert_staff" ON pesajes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

-- ===========================================
-- DATOS INICIALES
-- ===========================================

-- Insertar configuración de balanza por defecto
INSERT INTO balanza_config (nombre, modelo, indicador, puerto, baudrate)
VALUES ('Balanza Principal', 'SDP BBC-4030', 'SDP 32', 'COM3', 9600)
ON CONFLICT DO NOTHING;
