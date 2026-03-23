-- =====================================================
-- MEJORAS MÓDULO DE PRODUCCIÓN: RENDIMIENTOS Y DESPERDICIOS
-- Migración: 20260107_rendimientos_esperados_produccion.sql
-- =====================================================

-- ===========================================
-- 1. NUEVA TABLA: RENDIMIENTOS ESPERADOS
-- Configura el % de rendimiento esperado por Producto + Destino + Proveedor(Marca)
-- ===========================================

CREATE TABLE IF NOT EXISTS rendimientos_esperados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    destino_id UUID NOT NULL REFERENCES destinos_produccion(id) ON DELETE CASCADE,
    producto_entrada_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE, -- El producto generado (ej: Filet)
    proveedor VARCHAR(255) NOT NULL DEFAULT 'GENERICO', -- "Marca" u origen del insumo
    porcentaje_esperado DECIMAL(5,2) NOT NULL, -- Ej: 45.5 = 45.5%
    tolerancia DECIMAL(5,2) NOT NULL DEFAULT 5.0, -- +/- 5% de desviación permitida
    activo BOOLEAN DEFAULT true,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(destino_id, producto_entrada_id, proveedor)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_rendimientos_destino ON rendimientos_esperados(destino_id);
CREATE INDEX IF NOT EXISTS idx_rendimientos_producto ON rendimientos_esperados(producto_entrada_id);
CREATE INDEX IF NOT EXISTS idx_rendimientos_proveedor ON rendimientos_esperados(proveedor);

-- Comentarios
COMMENT ON TABLE rendimientos_esperados IS 'Configuración de rendimientos esperados por producto/destino/proveedor para predicción de mermas';
COMMENT ON COLUMN rendimientos_esperados.proveedor IS 'Marca o proveedor del insumo original (ej: Granja San José, Avícola Norte)';
COMMENT ON COLUMN rendimientos_esperados.porcentaje_esperado IS 'Porcentaje del peso de entrada que se espera obtener de este producto (ej: 45.5 significa 45.5%)';
COMMENT ON COLUMN rendimientos_esperados.tolerancia IS 'Porcentaje de desviación permitida antes de generar alerta (ej: 5 = +/-5%)';

-- ===========================================
-- 2. AGREGAR COLUMNA es_desperdicio_solido A destino_productos
-- Diferencia desperdicios sólidos (piel, huesos) de merma líquida
-- ===========================================

ALTER TABLE destino_productos 
ADD COLUMN IF NOT EXISTS es_desperdicio_solido BOOLEAN DEFAULT false;

COMMENT ON COLUMN destino_productos.es_desperdicio_solido IS 'Si true, este producto es desperdicio sólido (piel, carcasa) y no cuenta como pérdida líquida';

-- ===========================================
-- 3. AGREGAR COLUMNAS A orden_produccion_entradas
-- Para tracking de rendimiento real vs esperado
-- ===========================================

ALTER TABLE orden_produccion_entradas
ADD COLUMN IF NOT EXISTS peso_esperado_kg DECIMAL(10,3);

ALTER TABLE orden_produccion_entradas
ADD COLUMN IF NOT EXISTS es_desperdicio_solido BOOLEAN DEFAULT false;

ALTER TABLE orden_produccion_entradas
ADD COLUMN IF NOT EXISTS desviacion_porcentaje DECIMAL(5,2);

-- ===========================================
-- 4. FUNCIONES RPC PARA RENDIMIENTOS
-- ===========================================

-- Obtener rendimientos esperados para un destino y proveedor
CREATE OR REPLACE FUNCTION fn_obtener_rendimientos_destino(
    p_destino_id UUID,
    p_proveedor VARCHAR DEFAULT 'GENERICO'
) RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'producto_id', r.producto_entrada_id,
                'producto_nombre', p.nombre,
                'producto_codigo', p.codigo,
                'porcentaje_esperado', r.porcentaje_esperado,
                'tolerancia', r.tolerancia,
                'es_desperdicio_solido', COALESCE(dp.es_desperdicio_solido, false)
            )
        ), '[]'::jsonb)
        FROM rendimientos_esperados r
        JOIN productos p ON p.id = r.producto_entrada_id
        LEFT JOIN destino_productos dp ON dp.destino_id = r.destino_id AND dp.producto_id = r.producto_entrada_id
        WHERE r.destino_id = p_destino_id
          AND r.activo = true
          AND (r.proveedor = p_proveedor OR r.proveedor = 'GENERICO')
        ORDER BY r.proveedor DESC -- Prioriza proveedor específico sobre GENERICO
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calcular predicción de pesos para un destino basado en peso de entrada
CREATE OR REPLACE FUNCTION fn_predecir_rendimiento(
    p_destino_id UUID,
    p_peso_entrada_kg DECIMAL,
    p_proveedor VARCHAR DEFAULT 'GENERICO'
) RETURNS JSONB AS $$
DECLARE
    v_rendimientos JSONB;
    v_predicciones JSONB := '[]'::jsonb;
    v_item JSONB;
    v_peso_predicho DECIMAL;
BEGIN
    -- Obtener rendimientos configurados
    v_rendimientos := fn_obtener_rendimientos_destino(p_destino_id, p_proveedor);
    
    -- Calcular peso predicho para cada producto
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_rendimientos) LOOP
        v_peso_predicho := ROUND((p_peso_entrada_kg * (v_item->>'porcentaje_esperado')::DECIMAL / 100), 2);
        
        v_predicciones := v_predicciones || jsonb_build_object(
            'producto_id', v_item->>'producto_id',
            'producto_nombre', v_item->>'producto_nombre',
            'producto_codigo', v_item->>'producto_codigo',
            'porcentaje_esperado', (v_item->>'porcentaje_esperado')::DECIMAL,
            'peso_predicho_kg', v_peso_predicho,
            'tolerancia', (v_item->>'tolerancia')::DECIMAL,
            'peso_min_kg', ROUND(v_peso_predicho * (1 - (v_item->>'tolerancia')::DECIMAL / 100), 2),
            'peso_max_kg', ROUND(v_peso_predicho * (1 + (v_item->>'tolerancia')::DECIMAL / 100), 2),
            'es_desperdicio_solido', (v_item->>'es_desperdicio_solido')::BOOLEAN
        );
    END LOOP;
    
    RETURN v_predicciones;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CRUD: Crear o actualizar rendimiento esperado
CREATE OR REPLACE FUNCTION fn_upsert_rendimiento_esperado(
    p_destino_id UUID,
    p_producto_id UUID,
    p_proveedor VARCHAR,
    p_porcentaje DECIMAL,
    p_tolerancia DECIMAL DEFAULT 5.0,
    p_notas TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rendimientos_esperados (destino_id, producto_entrada_id, proveedor, porcentaje_esperado, tolerancia, notas)
    VALUES (p_destino_id, p_producto_id, COALESCE(p_proveedor, 'GENERICO'), p_porcentaje, p_tolerancia, p_notas)
    ON CONFLICT (destino_id, producto_entrada_id, proveedor)
    DO UPDATE SET 
        porcentaje_esperado = EXCLUDED.porcentaje_esperado,
        tolerancia = EXCLUDED.tolerancia,
        notas = EXCLUDED.notas,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar rendimiento esperado
CREATE OR REPLACE FUNCTION fn_eliminar_rendimiento_esperado(
    p_id UUID
) RETURNS JSONB AS $$
BEGIN
    DELETE FROM rendimientos_esperados WHERE id = p_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 5. ACTUALIZAR FUNCIÓN DE COMPLETAR ORDEN
-- Incluir cálculo de merma líquida vs desperdicio sólido
-- ===========================================

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
    v_merma_total DECIMAL;
    v_merma_pct DECIMAL;
    v_desperdicio_solido DECIMAL := 0;
    v_merma_liquida DECIMAL;
BEGIN
    -- Obtener orden
    SELECT * INTO v_orden FROM ordenes_produccion WHERE id = p_orden_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden no encontrada');
    END IF;
    
    IF v_orden.estado != 'en_proceso' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La orden ya fue procesada');
    END IF;
    
    -- Calcular desperdicio sólido (piel, etc.)
    SELECT COALESCE(SUM(ope.peso_kg), 0) INTO v_desperdicio_solido
    FROM orden_produccion_entradas ope
    WHERE ope.orden_id = p_orden_id
      AND ope.es_desperdicio_solido = true;
    
    -- Calcular merma total (salida_stock - entrada_stock)
    -- peso_total_entrada = lo que SALIÓ del stock (consumido)
    -- peso_total_salida = lo que ENTRÓ al stock (generado)
    v_merma_total := v_orden.peso_total_entrada - v_orden.peso_total_salida;
    
    -- Merma líquida = merma total - desperdicio sólido
    -- (La piel es desperdicio pero no es "pérdida líquida")
    v_merma_liquida := v_merma_total - v_desperdicio_solido;
    
    v_merma_pct := CASE 
        WHEN v_orden.peso_total_entrada > 0 
        THEN (v_merma_liquida / v_orden.peso_total_entrada) * 100 
        ELSE 0 
    END;
    
    -- Generar lotes para cada entrada (producto generado)
    v_fecha := TO_CHAR(NOW(), 'YYYYMMDD');
    
    FOR v_entrada IN SELECT * FROM orden_produccion_entradas WHERE orden_id = p_orden_id LOOP
        -- Calcular desviación si hay peso esperado
        IF v_entrada.peso_esperado_kg IS NOT NULL AND v_entrada.peso_esperado_kg > 0 THEN
            UPDATE orden_produccion_entradas
            SET desviacion_porcentaje = ROUND(((v_entrada.peso_kg - v_entrada.peso_esperado_kg) / v_entrada.peso_esperado_kg) * 100, 2)
            WHERE id = v_entrada.id;
        END IF;
        
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
            'peso_kg', v_entrada.peso_kg,
            'es_desperdicio_solido', v_entrada.es_desperdicio_solido
        );
    END LOOP;
    
    -- Marcar orden como completada
    UPDATE ordenes_produccion
    SET estado = 'completada',
        merma_kg = v_merma_liquida, -- Solo merma líquida
        merma_porcentaje = v_merma_pct,
        updated_at = NOW()
    WHERE id = p_orden_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'lotes_generados', v_lotes_generados,
        'merma_total_kg', v_merma_total,
        'desperdicio_solido_kg', v_desperdicio_solido,
        'merma_liquida_kg', v_merma_liquida,
        'merma_porcentaje', v_merma_pct
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 6. RLS PARA NUEVA TABLA
-- ===========================================

ALTER TABLE rendimientos_esperados ENABLE ROW LEVEL SECURITY;

-- Lectura para todos los usuarios autenticados
CREATE POLICY "rendimientos_read_all" ON rendimientos_esperados
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Escritura solo admin y almacenista
CREATE POLICY "rendimientos_write_admin" ON rendimientos_esperados
    FOR ALL USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

-- ===========================================
-- 7. DATOS INICIALES DE EJEMPLO
-- ===========================================

-- Insertar rendimientos genéricos de ejemplo para Filet
DO $$
DECLARE
    v_destino_filet UUID;
    v_prod_filet UUID;
    v_prod_patamuslo UUID;
    v_prod_piel UUID;
BEGIN
    -- Obtener ID del destino Filet
    SELECT id INTO v_destino_filet FROM destinos_produccion WHERE nombre ILIKE '%filet%' LIMIT 1;
    
    IF v_destino_filet IS NOT NULL THEN
        -- Buscar productos relacionados
        SELECT id INTO v_prod_filet FROM productos WHERE nombre ILIKE '%filet%' AND activo = true LIMIT 1;
        SELECT id INTO v_prod_patamuslo FROM productos WHERE nombre ILIKE '%patamuslo%' AND activo = true LIMIT 1;
        
        -- Crear producto Piel si no existe
        INSERT INTO productos (codigo, nombre, descripcion, categoria, precio_venta, unidad_medida, activo)
        VALUES ('PIEL001', 'Piel de Pollo', 'Desperdicio sólido del proceso de fileteo', 'Subproductos', 0, 'kg', true)
        ON CONFLICT (codigo) DO NOTHING
        RETURNING id INTO v_prod_piel;
        
        IF v_prod_piel IS NULL THEN
            SELECT id INTO v_prod_piel FROM productos WHERE codigo = 'PIEL001';
        END IF;
        
        -- Asignar Piel al destino Filet como desperdicio sólido
        IF v_prod_piel IS NOT NULL THEN
            INSERT INTO destino_productos (destino_id, producto_id, es_desperdicio, es_desperdicio_solido)
            VALUES (v_destino_filet, v_prod_piel, true, true)
            ON CONFLICT (destino_id, producto_id) 
            DO UPDATE SET es_desperdicio = true, es_desperdicio_solido = true;
        END IF;
        
        -- Insertar rendimientos genéricos
        IF v_prod_filet IS NOT NULL THEN
            INSERT INTO rendimientos_esperados (destino_id, producto_entrada_id, proveedor, porcentaje_esperado, tolerancia)
            VALUES (v_destino_filet, v_prod_filet, 'GENERICO', 42.0, 5.0)
            ON CONFLICT (destino_id, producto_entrada_id, proveedor) DO NOTHING;
        END IF;
        
        IF v_prod_patamuslo IS NOT NULL THEN
            INSERT INTO rendimientos_esperados (destino_id, producto_entrada_id, proveedor, porcentaje_esperado, tolerancia)
            VALUES (v_destino_filet, v_prod_patamuslo, 'GENERICO', 38.0, 5.0)
            ON CONFLICT (destino_id, producto_entrada_id, proveedor) DO NOTHING;
        END IF;
        
        IF v_prod_piel IS NOT NULL THEN
            INSERT INTO rendimientos_esperados (destino_id, producto_entrada_id, proveedor, porcentaje_esperado, tolerancia)
            VALUES (v_destino_filet, v_prod_piel, 'GENERICO', 8.0, 3.0)
            ON CONFLICT (destino_id, producto_entrada_id, proveedor) DO NOTHING;
        END IF;
    END IF;
END $$;;
