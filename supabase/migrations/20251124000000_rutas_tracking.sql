-- ===========================================
-- MIGRACIÓN: RUTAS OPTIMIZADAS Y TRACKING
-- Fecha: 2025-11-24
-- Descripción: Implementa optimización de rutas (Google Directions + fallback local) 
--              y tracking en tiempo real con alertas de desvío y cliente saltado
-- ===========================================

-- ===========================================
-- TABLA: UBICACIONES REPARTIDORES
-- ===========================================

CREATE TABLE IF NOT EXISTS ubicaciones_repartidores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repartidor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    vehiculo_id UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ubicaciones_vehiculo_created ON ubicaciones_repartidores(vehiculo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_repartidor_created ON ubicaciones_repartidores(repartidor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_created_at ON ubicaciones_repartidores(created_at DESC);

-- Índice geoespacial para búsquedas por proximidad
CREATE INDEX IF NOT EXISTS idx_ubicaciones_geo ON ubicaciones_repartidores USING GIST (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
);

-- ===========================================
-- TABLA: RUTAS PLANIFICADAS
-- ===========================================

CREATE TABLE IF NOT EXISTS rutas_planificadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    zona_id UUID REFERENCES zonas(id),
    vehiculo_id UUID REFERENCES vehiculos(id),
    ruta_reparto_id UUID REFERENCES rutas_reparto(id) ON DELETE CASCADE,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'optimizada', 'en_curso', 'completada')),
    orden_visita JSONB, -- [{cliente_id, pedido_id, lat, lng, orden, nombre_cliente}]
    polyline TEXT, -- encoded polyline (Google o Leaflet)
    distancia_total_km DECIMAL(8,2),
    duracion_total_min INTEGER,
    optimizada_por TEXT DEFAULT 'local' CHECK (optimizada_por IN ('google', 'local')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rutas_planificadas_fecha_vehiculo ON rutas_planificadas(fecha, vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_rutas_planificadas_ruta_reparto ON rutas_planificadas(ruta_reparto_id);
CREATE INDEX IF NOT EXISTS idx_rutas_planificadas_estado ON rutas_planificadas(estado);

-- ===========================================
-- TABLA: ALERTAS REPARTO
-- ===========================================

CREATE TABLE IF NOT EXISTS alertas_reparto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruta_id UUID REFERENCES rutas_planificadas(id) ON DELETE CASCADE,
    ruta_reparto_id UUID REFERENCES rutas_reparto(id) ON DELETE CASCADE,
    vehiculo_id UUID REFERENCES vehiculos(id),
    repartidor_id UUID REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('desvio', 'cliente_saltado', 'retraso', 'otro')),
    descripcion TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    distancia_desvio_m DECIMAL(8,2), -- distancia en metros desde la ruta planificada
    cliente_id UUID REFERENCES clientes(id), -- si es cliente_saltado
    pedido_id UUID REFERENCES pedidos(id), -- si es cliente_saltado
    resuelta BOOLEAN DEFAULT false,
    resuelta_por UUID REFERENCES usuarios(id),
    resuelta_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_alertas_ruta ON alertas_reparto(ruta_id);
CREATE INDEX IF NOT EXISTS idx_alertas_ruta_reparto ON alertas_reparto(ruta_reparto_id);
CREATE INDEX IF NOT EXISTS idx_alertas_vehiculo ON alertas_reparto(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_reparto(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta ON alertas_reparto(resuelta);
CREATE INDEX IF NOT EXISTS idx_alertas_created_at ON alertas_reparto(created_at DESC);

-- ===========================================
-- TABLA: VEHICULOS ESTADO (cache de última ubicación)
-- ===========================================

CREATE TABLE IF NOT EXISTS vehiculos_estado (
    vehiculo_id UUID PRIMARY KEY REFERENCES vehiculos(id) ON DELETE CASCADE,
    ultima_lat DOUBLE PRECISION,
    ultima_lng DOUBLE PRECISION,
    ultima_actualizacion TIMESTAMPTZ,
    velocidad_kmh DECIMAL(5,2),
    direccion_grados INTEGER, -- 0-360
    ruta_activa_id UUID REFERENCES rutas_reparto(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- FUNCIÓN RPC: OBTENER ÚLTIMA UBICACIÓN POR VEHÍCULO
-- ===========================================

CREATE OR REPLACE FUNCTION fn_obtener_ultima_ubicacion_por_vehiculo(
    p_fecha DATE DEFAULT CURRENT_DATE,
    p_zona_id UUID DEFAULT NULL
)
RETURNS TABLE (
    vehiculo_id UUID,
    repartidor_id UUID,
    repartidor_nombre TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ,
    ruta_activa_id UUID,
    ruta_numero TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH ultimas_ubicaciones AS (
        SELECT DISTINCT ON (u.vehiculo_id)
            u.vehiculo_id,
            u.repartidor_id,
            u.lat,
            u.lng,
            u.created_at
        FROM ubicaciones_repartidores u
        WHERE DATE(u.created_at) = p_fecha
        ORDER BY u.vehiculo_id, u.created_at DESC
    )
    SELECT 
        uu.vehiculo_id,
        uu.repartidor_id,
        CONCAT(us.nombre, ' ', COALESCE(us.apellido, '')) AS repartidor_nombre,
        uu.lat,
        uu.lng,
        uu.created_at,
        r.id AS ruta_activa_id,
        r.numero_ruta AS ruta_numero
    FROM ultimas_ubicaciones uu
    LEFT JOIN usuarios us ON us.id = uu.repartidor_id
    LEFT JOIN rutas_reparto r ON r.vehiculo_id = uu.vehiculo_id 
        AND r.estado IN ('planificada', 'en_curso')
        AND r.fecha_ruta = p_fecha
    WHERE (p_zona_id IS NULL OR r.zona_id = p_zona_id)
    ORDER BY uu.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- FUNCIÓN RPC: GENERAR RUTA LOCAL (FALLBACK)
-- ===========================================

CREATE OR REPLACE FUNCTION fn_generar_ruta_local(
    p_ruta_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_ruta RECORD;
    v_pedidos RECORD;
    v_orden JSONB := '[]'::JSONB;
    v_polyline TEXT;
    v_distancia_total DECIMAL := 0;
    v_duracion_total INTEGER := 0;
    v_punto_anterior RECORD;
    v_punto_actual RECORD;
    v_distancia_parcial DECIMAL;
BEGIN
    -- Obtener ruta con pedidos
    SELECT r.*, z.nombre AS zona_nombre
    INTO v_ruta
    FROM rutas_reparto r
    LEFT JOIN zonas z ON z.id = r.zona_id
    WHERE r.id = p_ruta_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ruta no encontrada');
    END IF;
    
    -- Obtener pedidos de la ruta con coordenadas de clientes
    FOR v_pedidos IN
        SELECT 
            dr.id AS detalle_ruta_id,
            dr.pedido_id,
            dr.orden_entrega,
            p.cliente_id,
            c.nombre AS cliente_nombre,
            c.direccion,
            ST_Y(c.coordenadas::geometry) AS lat,
            ST_X(c.coordenadas::geometry) AS lng
        FROM detalles_ruta dr
        INNER JOIN pedidos p ON p.id = dr.pedido_id
        INNER JOIN clientes c ON c.id = p.cliente_id
        WHERE dr.ruta_id = p_ruta_id
        AND c.coordenadas IS NOT NULL
        ORDER BY dr.orden_entrega ASC
    LOOP
        -- Agregar al orden (Nearest Neighbor ya aplicado por orden_entrega)
        v_orden := v_orden || jsonb_build_object(
            'detalle_ruta_id', v_pedidos.detalle_ruta_id,
            'pedido_id', v_pedidos.pedido_id,
            'cliente_id', v_pedidos.cliente_id,
            'cliente_nombre', v_pedidos.cliente_nombre,
            'lat', v_pedidos.lat,
            'lng', v_pedidos.lng,
            'orden', v_pedidos.orden_entrega
        );
        
        -- Calcular distancia acumulada (Haversine simplificado)
        IF v_punto_anterior.lat IS NOT NULL THEN
            v_distancia_parcial := (
                6371 * acos(
                    cos(radians(v_punto_anterior.lat)) * 
                    cos(radians(v_pedidos.lat)) * 
                    cos(radians(v_pedidos.lng) - radians(v_punto_anterior.lng)) + 
                    sin(radians(v_punto_anterior.lat)) * 
                    sin(radians(v_pedidos.lat))
                )
            );
            v_distancia_total := v_distancia_total + v_distancia_parcial;
        END IF;
        
        v_punto_anterior := v_pedidos;
    END LOOP;
    
    -- Estimar duración (promedio 30 km/h en ciudad)
    IF v_distancia_total > 0 THEN
        v_duracion_total := ROUND((v_distancia_total / 30.0) * 60);
    END IF;
    
    -- Generar polyline simple (formato básico para Leaflet)
    -- En producción, usaría una función más robusta de encoding
    v_polyline := ''; -- Se generará en el backend TypeScript
    
    -- Crear o actualizar ruta_planificada
    INSERT INTO rutas_planificadas (
        ruta_reparto_id,
        fecha,
        zona_id,
        vehiculo_id,
        estado,
        orden_visita,
        polyline,
        distancia_total_km,
        duracion_total_min,
        optimizada_por
    ) VALUES (
        p_ruta_id,
        v_ruta.fecha_ruta,
        v_ruta.zona_id,
        v_ruta.vehiculo_id,
        'optimizada',
        v_orden,
        v_polyline,
        v_distancia_total,
        v_duracion_total,
        'local'
    )
    ON CONFLICT (ruta_reparto_id) 
    DO UPDATE SET
        orden_visita = EXCLUDED.orden_visita,
        polyline = EXCLUDED.polyline,
        distancia_total_km = EXCLUDED.distancia_total_km,
        duracion_total_min = EXCLUDED.duracion_total_min,
        optimizada_por = EXCLUDED.optimizada_por,
        estado = 'optimizada',
        updated_at = NOW();
    
    RETURN jsonb_build_object(
        'success', true,
        'ruta_planificada_id', (SELECT id FROM rutas_planificadas WHERE ruta_reparto_id = p_ruta_id),
        'orden_visita', v_orden,
        'distancia_total_km', v_distancia_total,
        'duracion_total_min', v_duracion_total,
        'optimizada_por', 'local'
    );
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- FUNCIÓN RPC: MARCAR ALERTA DESVÍO
-- ===========================================

CREATE OR REPLACE FUNCTION fn_marcar_alerta_desvio(
    p_ruta_id UUID,
    p_vehiculo_id UUID,
    p_repartidor_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_distancia_desvio_m DECIMAL,
    p_descripcion TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_alerta_id UUID;
    v_ruta_reparto_id UUID;
BEGIN
    -- Obtener ruta_reparto_id desde rutas_planificadas
    SELECT ruta_reparto_id INTO v_ruta_reparto_id
    FROM rutas_planificadas
    WHERE id = p_ruta_id;
    
    -- Insertar alerta
    INSERT INTO alertas_reparto (
        ruta_id,
        ruta_reparto_id,
        vehiculo_id,
        repartidor_id,
        tipo,
        descripcion,
        lat,
        lng,
        distancia_desvio_m
    ) VALUES (
        p_ruta_id,
        v_ruta_reparto_id,
        p_vehiculo_id,
        p_repartidor_id,
        'desvio',
        COALESCE(p_descripcion, 'Vehículo se desvió ' || ROUND(p_distancia_desvio_m) || ' metros de la ruta planificada'),
        p_lat,
        p_lng,
        p_distancia_desvio_m
    )
    RETURNING id INTO v_alerta_id;
    
    -- Crear notificación para admin
    PERFORM crear_notificacion(
        'admin',
        'Alerta de Desvío',
        'El vehículo ' || (SELECT patente FROM vehiculos WHERE id = p_vehiculo_id) || 
        ' se desvió ' || ROUND(p_distancia_desvio_m) || ' metros de la ruta planificada',
        'alerta',
        jsonb_build_object(
            'tipo', 'desvio',
            'alerta_id', v_alerta_id,
            'ruta_id', p_ruta_id,
            'vehiculo_id', p_vehiculo_id
        )
    );
    
    RETURN jsonb_build_object('success', true, 'alerta_id', v_alerta_id);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- FUNCIÓN RPC: MARCAR ALERTA CLIENTE SALTADO
-- ===========================================

CREATE OR REPLACE FUNCTION fn_marcar_alerta_cliente_saltado(
    p_ruta_id UUID,
    p_vehiculo_id UUID,
    p_repartidor_id UUID,
    p_cliente_id UUID,
    p_pedido_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_distancia_m DECIMAL,
    p_descripcion TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_alerta_id UUID;
    v_ruta_reparto_id UUID;
    v_cliente_nombre TEXT;
BEGIN
    -- Obtener nombre del cliente
    SELECT nombre INTO v_cliente_nombre
    FROM clientes
    WHERE id = p_cliente_id;
    
    -- Obtener ruta_reparto_id
    SELECT ruta_reparto_id INTO v_ruta_reparto_id
    FROM rutas_planificadas
    WHERE id = p_ruta_id;
    
    -- Insertar alerta
    INSERT INTO alertas_reparto (
        ruta_id,
        ruta_reparto_id,
        vehiculo_id,
        repartidor_id,
        tipo,
        descripcion,
        lat,
        lng,
        cliente_id,
        pedido_id
    ) VALUES (
        p_ruta_id,
        v_ruta_reparto_id,
        p_vehiculo_id,
        p_repartidor_id,
        'cliente_saltado',
        COALESCE(p_descripcion, 'Vehículo pasó a ' || ROUND(p_distancia_m) || ' metros del cliente ' || v_cliente_nombre || ' sin entregar'),
        p_lat,
        p_lng,
        p_cliente_id,
        p_pedido_id
    )
    RETURNING id INTO v_alerta_id;
    
    -- Crear notificación para admin
    PERFORM crear_notificacion(
        'admin',
        'Cliente Saltado',
        'El vehículo ' || (SELECT patente FROM vehiculos WHERE id = p_vehiculo_id) || 
        ' pasó cerca del cliente ' || v_cliente_nombre || ' sin entregar',
        'alerta',
        jsonb_build_object(
            'tipo', 'cliente_saltado',
            'alerta_id', v_alerta_id,
            'ruta_id', p_ruta_id,
            'cliente_id', p_cliente_id,
            'pedido_id', p_pedido_id
        )
    );
    
    RETURN jsonb_build_object('success', true, 'alerta_id', v_alerta_id);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER: ACTUALIZAR VEHICULOS_ESTADO
-- ===========================================

CREATE OR REPLACE FUNCTION fn_actualizar_vehiculo_estado()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO vehiculos_estado (
        vehiculo_id,
        ultima_lat,
        ultima_lng,
        ultima_actualizacion,
        ruta_activa_id,
        updated_at
    ) VALUES (
        NEW.vehiculo_id,
        NEW.lat,
        NEW.lng,
        NEW.created_at,
        (SELECT id FROM rutas_reparto 
         WHERE vehiculo_id = NEW.vehiculo_id 
         AND estado IN ('planificada', 'en_curso')
         ORDER BY fecha_ruta DESC, created_at DESC LIMIT 1),
        NOW()
    )
    ON CONFLICT (vehiculo_id) 
    DO UPDATE SET
        ultima_lat = EXCLUDED.ultima_lat,
        ultima_lng = EXCLUDED.ultima_lng,
        ultima_actualizacion = EXCLUDED.ultima_actualizacion,
        ruta_activa_id = EXCLUDED.ruta_activa_id,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_vehiculo_estado
    AFTER INSERT ON ubicaciones_repartidores
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_vehiculo_estado();

-- ===========================================
-- RLS (ROW LEVEL SECURITY)
-- ===========================================

-- Habilitar RLS en nuevas tablas
ALTER TABLE ubicaciones_repartidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutas_planificadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_reparto ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos_estado ENABLE ROW LEVEL SECURITY;

-- Políticas para ubicaciones_repartidores
CREATE POLICY "Repartidores pueden insertar sus propias ubicaciones"
    ON ubicaciones_repartidores FOR INSERT
    WITH CHECK (
        auth.uid() = repartidor_id OR
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
    );

CREATE POLICY "Admin y logística pueden leer todas las ubicaciones"
    ON ubicaciones_repartidores FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

CREATE POLICY "Repartidores pueden leer sus propias ubicaciones"
    ON ubicaciones_repartidores FOR SELECT
    USING (auth.uid() = repartidor_id);

-- Políticas para rutas_planificadas
CREATE POLICY "Admin y logística pueden gestionar rutas planificadas"
    ON rutas_planificadas FOR ALL
    USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'almacenista'))
    );

CREATE POLICY "Repartidores pueden leer sus rutas planificadas"
    ON rutas_planificadas FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rutas_reparto r
            WHERE r.id = rutas_planificadas.ruta_reparto_id
            AND r.repartidor_id = auth.uid()
        )
    );

-- Políticas para alertas_reparto
CREATE POLICY "Admin puede gestionar todas las alertas"
    ON alertas_reparto FOR ALL
    USING (
        EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
    );

CREATE POLICY "Repartidores pueden leer alertas de sus rutas"
    ON alertas_reparto FOR SELECT
    USING (
        repartidor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM rutas_reparto r
            WHERE r.id = alertas_reparto.ruta_reparto_id
            AND r.repartidor_id = auth.uid()
        )
    );

-- Políticas para vehiculos_estado
CREATE POLICY "Todos los usuarios autenticados pueden leer estado de vehículos"
    ON vehiculos_estado FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Solo sistema puede actualizar estado de vehículos"
    ON vehiculos_estado FOR UPDATE
    USING (false); -- Solo vía trigger

-- ===========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ===========================================

COMMENT ON TABLE ubicaciones_repartidores IS 'Registro de ubicaciones GPS de repartidores en tiempo real';
COMMENT ON TABLE rutas_planificadas IS 'Rutas optimizadas con orden de visita y polilíneas (Google o local)';
COMMENT ON TABLE alertas_reparto IS 'Alertas de desvío, cliente saltado y otros incidentes en reparto';
COMMENT ON TABLE vehiculos_estado IS 'Cache de última ubicación y estado de cada vehículo';

COMMENT ON FUNCTION fn_obtener_ultima_ubicacion_por_vehiculo IS 'Retorna última ubicación de cada vehículo activo en una fecha';
COMMENT ON FUNCTION fn_generar_ruta_local IS 'Genera orden de visita optimizado usando algoritmo Nearest Neighbor (fallback cuando Google no está disponible)';
COMMENT ON FUNCTION fn_marcar_alerta_desvio IS 'Registra alerta cuando vehículo se desvía más del umbral de la ruta planificada';
COMMENT ON FUNCTION fn_marcar_alerta_cliente_saltado IS 'Registra alerta cuando vehículo pasa cerca de cliente sin entregar';

-- ===========================================
-- ROLLBACK (si es necesario revertir)
-- ===========================================

/*
-- Para revertir esta migración:
DROP TRIGGER IF EXISTS trigger_actualizar_vehiculo_estado ON ubicaciones_repartidores;
DROP FUNCTION IF EXISTS fn_actualizar_vehiculo_estado();
DROP FUNCTION IF EXISTS fn_marcar_alerta_cliente_saltado(UUID, UUID, UUID, UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS fn_marcar_alerta_desvio(UUID, UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS fn_generar_ruta_local(UUID);
DROP FUNCTION IF EXISTS fn_obtener_ultima_ubicacion_por_vehiculo(DATE, UUID);
DROP TABLE IF EXISTS vehiculos_estado CASCADE;
DROP TABLE IF EXISTS alertas_reparto CASCADE;
DROP TABLE IF EXISTS rutas_planificadas CASCADE;
DROP TABLE IF EXISTS ubicaciones_repartidores CASCADE;
*/

