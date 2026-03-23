-- =====================================================
-- REFACTORIZACIÓN SISTEMA DE PRODUCCIÓN
-- Intercambio de nomenclatura + Destinos de Producción
-- =====================================================

-- ===========================================
-- 1. NUEVA TABLA: DESTINOS DE PRODUCCIÓN
-- ===========================================

CREATE TABLE IF NOT EXISTS destinos_produccion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    orden_display INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Datos iniciales
INSERT INTO destinos_produccion (nombre, descripcion, orden_display) VALUES
('Filet', 'Patamuslo, Filet, Puchero, Menudo, Alas (desperdicio: cuero/piel)', 1),
('Pechuga', 'Patamuslo, Alas, Pechuga, Menudo', 2),
('Pollo Trozado', 'Pollo entero trozado, Menudo', 3)
ON CONFLICT (nombre) DO NOTHING;

-- ===========================================
-- 2. NUEVA TABLA: PRODUCTOS POR DESTINO
-- ===========================================

CREATE TABLE IF NOT EXISTS destino_productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    destino_id UUID NOT NULL REFERENCES destinos_produccion(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    es_desperdicio BOOLEAN DEFAULT false,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(destino_id, producto_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_destino_productos_destino ON destino_productos(destino_id);
CREATE INDEX IF NOT EXISTS idx_destino_productos_producto ON destino_productos(producto_id);

-- ===========================================
-- 3. RENOMBRAR TABLAS (INTERCAMBIO NOMENCLATURA)
-- Actual "entradas" (consume stock) → Nueva "salidas" (SALE del stock)
-- Actual "salidas" (genera stock) → Nueva "entradas" (ENTRA al stock)
-- ===========================================

-- Paso 1: Renombrar tablas actuales a temporales
ALTER TABLE IF EXISTS orden_produccion_entradas RENAME TO orden_produccion_salidas_temp;
ALTER TABLE IF EXISTS orden_produccion_salidas RENAME TO orden_produccion_entradas_temp;

-- Paso 2: Renombrar temporales a finales
ALTER TABLE IF EXISTS orden_produccion_salidas_temp RENAME TO orden_produccion_salidas;
ALTER TABLE IF EXISTS orden_produccion_entradas_temp RENAME TO orden_produccion_entradas;

-- ===========================================
-- 4. MODIFICAR TABLA ÓRDENES DE PRODUCCIÓN
-- ===========================================

-- Agregar columna destino_id (obligatoria para las entradas)
ALTER TABLE ordenes_produccion 
ADD COLUMN IF NOT EXISTS destino_id UUID REFERENCES destinos_produccion(id);

-- ===========================================
-- 5. AGREGAR CAMPOS DE MERMA INDIVIDUAL
-- ===========================================

-- En la nueva tabla "entradas" (productos que entran al stock)
ALTER TABLE orden_produccion_entradas 
ADD COLUMN IF NOT EXISTS merma_esperada_kg DECIMAL(10,3) DEFAULT 0;

ALTER TABLE orden_produccion_entradas 
ADD COLUMN IF NOT EXISTS merma_real_kg DECIMAL(10,3) DEFAULT 0;

-- Campo para vincular al destino específico
ALTER TABLE orden_produccion_entradas 
ADD COLUMN IF NOT EXISTS destino_id UUID REFERENCES destinos_produccion(id);

-- ===========================================
-- 6. ACTUALIZAR/CREAR FUNCIONES RPC
-- ===========================================

-- Función para agregar SALIDA de stock (producto que SALE del inventario - consumido)
CREATE OR REPLACE FUNCTION fn_agregar_salida_stock(
    p_orden_id UUID,
    p_producto_id UUID,
    p_lote_id UUID,
    p_cantidad DECIMAL,
    p_peso_kg DECIMAL DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_lote RECORD;
    v_salida_id UUID;
BEGIN
    -- Verificar que el lote existe y tiene stock
    SELECT * INTO v_lote FROM lotes WHERE id = p_lote_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lote no encontrado');
    END IF;
    
    IF v_lote.cantidad_disponible < p_cantidad THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente en el lote');
    END IF;
    
    -- Insertar salida (producto que SALE del stock)
    INSERT INTO orden_produccion_salidas (
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
    ) RETURNING id INTO v_salida_id;
    
    -- Descontar del lote
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
    
    -- Actualizar peso total salida en orden
    UPDATE ordenes_produccion
    SET peso_total_entrada = peso_total_entrada + COALESCE(p_peso_kg, 0),
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'salida_id', v_salida_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para agregar ENTRADA de stock (producto que ENTRA al inventario - generado)
CREATE OR REPLACE FUNCTION fn_agregar_entrada_stock(
    p_orden_id UUID,
    p_producto_id UUID,
    p_destino_id UUID,
    p_peso_kg DECIMAL,
    p_cantidad DECIMAL DEFAULT 1,
    p_plu VARCHAR DEFAULT NULL,
    p_fecha_vencimiento DATE DEFAULT NULL,
    p_pesaje_id UUID DEFAULT NULL,
    p_merma_esperada_kg DECIMAL DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_entrada_id UUID;
    v_producto_valido BOOLEAN;
BEGIN
    -- Validar que el producto pertenece al destino (si hay productos configurados)
    SELECT EXISTS(
        SELECT 1 FROM destino_productos 
        WHERE destino_id = p_destino_id 
        AND producto_id = p_producto_id
    ) OR NOT EXISTS(
        SELECT 1 FROM destino_productos WHERE destino_id = p_destino_id
    ) INTO v_producto_valido;
    
    -- Si hay productos configurados para el destino, validar
    IF NOT v_producto_valido THEN
        RETURN jsonb_build_object('success', false, 'error', 'El producto no pertenece al destino seleccionado');
    END IF;

    INSERT INTO orden_produccion_entradas (
        orden_id,
        producto_id,
        destino_id,
        peso_kg,
        cantidad,
        plu,
        fecha_vencimiento,
        pesaje_id,
        merma_esperada_kg
    ) VALUES (
        p_orden_id,
        p_producto_id,
        p_destino_id,
        p_peso_kg,
        p_cantidad,
        p_plu,
        COALESCE(p_fecha_vencimiento, CURRENT_DATE + INTERVAL '7 days'),
        p_pesaje_id,
        p_merma_esperada_kg
    ) RETURNING id INTO v_entrada_id;
    
    -- Actualizar peso total entrada en orden
    UPDATE ordenes_produccion
    SET peso_total_salida = peso_total_salida + p_peso_kg,
        destino_id = COALESCE(destino_id, p_destino_id),
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'entrada_id', v_entrada_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para completar orden y generar lotes (actualizada)
CREATE OR REPLACE FUNCTION fn_completar_orden_produccion(
    p_orden_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_orden RECORD;
    v_entrada RECORD;
    v_lote_id UUID;
    v_numero_lote VARCHAR(50);
    v_lotes_generados JSONB := '[]'::JSONB;
    v_fecha TEXT;
    v_secuencia INTEGER;
    v_merma DECIMAL;
    v_merma_pct DECIMAL;
    v_desperdicio DECIMAL;
BEGIN
    -- Obtener orden
    SELECT * INTO v_orden FROM ordenes_produccion WHERE id = p_orden_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
    END IF;
    
    IF v_orden.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La orden ya fue procesada');
    END IF;
    
    -- Calcular merma total (desperdicio = salida_stock - entrada_stock)
    -- peso_total_entrada = lo que SALIÓ del stock (consumido)
    -- peso_total_salida = lo que ENTRÓ al stock (generado)
    v_merma := v_orden.peso_total_entrada - v_orden.peso_total_salida;
    v_merma_pct := CASE 
        WHEN v_orden.peso_total_entrada > 0 
        THEN (v_merma / v_orden.peso_total_entrada) * 100 
        ELSE 0 
    END;
    v_desperdicio := v_merma; -- El desperdicio es la diferencia final
    
    -- Generar lotes para cada entrada (producto generado)
    v_fecha := TO_CHAR(NOW(), 'YYYYMMDD');
    
    FOR v_entrada IN SELECT * FROM orden_produccion_entradas WHERE orden_id = p_orden_id LOOP
        -- Calcular merma individual
        UPDATE orden_produccion_entradas
        SET merma_real_kg = GREATEST(0, merma_esperada_kg - peso_kg)
        WHERE id = v_entrada.id;
        
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
            v_entrada.producto_id,
            v_entrada.peso_kg,
            v_entrada.peso_kg,
            CURRENT_DATE,
            v_entrada.fecha_vencimiento,
            'PRODUCCION',
            'disponible',
            p_orden_id,
            true
        ) RETURNING id INTO v_lote_id;
        
        -- Actualizar entrada con lote generado
        UPDATE orden_produccion_entradas
        SET lote_generado_id = v_lote_id
        WHERE id = v_entrada.id;
        
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
            v_entrada.peso_kg,
            'Generado por orden de producción ' || v_orden.numero_orden,
            v_orden.operario_id
        );
        
        v_lotes_generados := v_lotes_generados || jsonb_build_object(
            'lote_id', v_lote_id,
            'numero_lote', v_numero_lote,
            'producto_id', v_entrada.producto_id,
            'peso_kg', v_entrada.peso_kg
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
        'merma_porcentaje', v_merma_pct,
        'desperdicio_kg', v_desperdicio
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cancelar orden (actualizada para nueva nomenclatura)
CREATE OR REPLACE FUNCTION fn_cancelar_orden_produccion(
    p_orden_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_orden RECORD;
    v_salida RECORD;
BEGIN
    SELECT * INTO v_orden FROM ordenes_produccion WHERE id = p_orden_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
    END IF;
    
    IF v_orden.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cancelar órdenes en proceso');
    END IF;
    
    -- Revertir stock de salidas (productos que salieron del stock)
    FOR v_salida IN SELECT * FROM orden_produccion_salidas WHERE orden_id = p_orden_id LOOP
        UPDATE lotes
        SET cantidad_disponible = cantidad_disponible + v_salida.cantidad,
            estado = 'disponible',
            updated_at = NOW()
        WHERE id = v_salida.lote_id;
        
        -- Registrar movimiento de reversión
        INSERT INTO movimientos_stock (
            lote_id,
            tipo_movimiento,
            cantidad,
            motivo,
            usuario_id
        ) VALUES (
            v_salida.lote_id,
            'ajuste',
            v_salida.cantidad,
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

-- ===========================================
-- 7. FUNCIONES PARA CRUD DE DESTINOS
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_destinos_produccion()
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', d.id,
                'nombre', d.nombre,
                'descripcion', d.descripcion,
                'activo', d.activo,
                'orden_display', d.orden_display,
                'productos', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', dp.id,
                            'producto_id', dp.producto_id,
                            'es_desperdicio', dp.es_desperdicio,
                            'producto_nombre', p.nombre,
                            'producto_codigo', p.codigo
                        ) ORDER BY dp.orden
                    ), '[]'::jsonb)
                    FROM destino_productos dp
                    JOIN productos p ON p.id = dp.producto_id
                    WHERE dp.destino_id = d.id
                )
            ) ORDER BY d.orden_display
        ), '[]'::jsonb)
        FROM destinos_produccion d
        WHERE d.activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_crear_destino_produccion(
    p_nombre VARCHAR,
    p_descripcion TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_destino_id UUID;
    v_orden INTEGER;
BEGIN
    SELECT COALESCE(MAX(orden_display), 0) + 1 INTO v_orden FROM destinos_produccion;
    
    INSERT INTO destinos_produccion (nombre, descripcion, orden_display)
    VALUES (p_nombre, p_descripcion, v_orden)
    RETURNING id INTO v_destino_id;
    
    RETURN jsonb_build_object('success', true, 'destino_id', v_destino_id);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe un destino con ese nombre');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_asociar_producto_destino(
    p_destino_id UUID,
    p_producto_id UUID,
    p_es_desperdicio BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO destino_productos (destino_id, producto_id, es_desperdicio)
    VALUES (p_destino_id, p_producto_id, p_es_desperdicio)
    ON CONFLICT (destino_id, producto_id) 
    DO UPDATE SET es_desperdicio = p_es_desperdicio
    RETURNING id INTO v_id;
    
    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_desasociar_producto_destino(
    p_destino_id UUID,
    p_producto_id UUID
) RETURNS JSONB AS $$
BEGIN
    DELETE FROM destino_productos 
    WHERE destino_id = p_destino_id AND producto_id = p_producto_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 8. POLÍTICAS RLS PARA NUEVAS TABLAS
-- ===========================================

ALTER TABLE destinos_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE destino_productos ENABLE ROW LEVEL SECURITY;

-- Destinos: lectura para todos, escritura solo admin
CREATE POLICY "destinos_produccion_read_all" ON destinos_produccion
    FOR SELECT USING (true);

CREATE POLICY "destinos_produccion_admin" ON destinos_produccion
    FOR ALL USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
    );

-- Productos por destino: lectura para todos, escritura solo admin
CREATE POLICY "destino_productos_read_all" ON destino_productos
    FOR SELECT USING (true);

CREATE POLICY "destino_productos_admin" ON destino_productos
    FOR ALL USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
    );

-- ===========================================
-- 9. MANTENER COMPATIBILIDAD CON FUNCIONES ANTIGUAS
-- ===========================================

-- Alias para compatibilidad (deprecated, usar las nuevas)
CREATE OR REPLACE FUNCTION fn_agregar_entrada_produccion(
    p_orden_id UUID,
    p_producto_id UUID,
    p_lote_id UUID,
    p_cantidad DECIMAL,
    p_peso_kg DECIMAL DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
    -- Redirigir a la nueva función de salida de stock
    RETURN fn_agregar_salida_stock(p_orden_id, p_producto_id, p_lote_id, p_cantidad, p_peso_kg);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    v_destino_id UUID;
BEGIN
    -- Obtener destino de la orden
    SELECT destino_id INTO v_destino_id FROM ordenes_produccion WHERE id = p_orden_id;
    
    -- Redirigir a la nueva función de entrada de stock
    RETURN fn_agregar_entrada_stock(
        p_orden_id, 
        p_producto_id, 
        v_destino_id,
        p_peso_kg, 
        p_cantidad, 
        p_plu, 
        p_fecha_vencimiento, 
        p_pesaje_id,
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
