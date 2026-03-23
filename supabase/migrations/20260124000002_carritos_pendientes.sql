-- =========================================
-- CARRITOS PENDIENTES (Catálogo Web + Bot)
-- =========================================
-- Fecha: 2026-01-24
-- Descripción: Sistema de carritos compartibles para integración con bot WhatsApp
-- Skill: erp-ventas-chatbot

-- Tabla de carritos pendientes (para compartir link y sincronizar con bot)
CREATE TABLE IF NOT EXISTS carritos_pendientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(8) UNIQUE NOT NULL, -- Código corto para compartir (ej: ABC123)
    telefono_cliente VARCHAR(20), -- Teléfono de WhatsApp
    cliente_id UUID REFERENCES clientes(id), -- Opcional, si el cliente está registrado
    -- Items del carrito en JSON
    items JSONB NOT NULL DEFAULT '[]',
    -- Ejemplo items: [{"producto_id": "...", "cantidad": 2, "peso_aprox": 1.5, "precio_unitario": 100}]
    
    -- Totales
    total_estimado DECIMAL(12,2) DEFAULT 0,
    cantidad_items INTEGER DEFAULT 0,
    
    -- Estado
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'convertido', 'expirado', 'cancelado')),
    
    -- Conversión
    presupuesto_id UUID REFERENCES presupuestos(id), -- Si se convirtió a presupuesto
    
    -- Metadata
    origen VARCHAR(20) DEFAULT 'catalogo' CHECK (origen IN ('catalogo', 'bot', 'manual')),
    ip_cliente VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamps
    fecha_expiracion TIMESTAMPTZ, -- Cuándo expira el carrito
    confirmado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_codigo ON carritos_pendientes(codigo);
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_telefono ON carritos_pendientes(telefono_cliente);
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_estado ON carritos_pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_created ON carritos_pendientes(created_at DESC);

-- RLS: Público para lectura por código, pero solo autenticados pueden crear
ALTER TABLE carritos_pendientes ENABLE ROW LEVEL SECURITY;

-- Política: Cualquiera puede leer por código (para acceso público al catálogo)
CREATE POLICY "carritos_pendientes_select_public"
    ON carritos_pendientes FOR SELECT TO anon, authenticated
    USING (true);

-- Política: Solo usuarios autenticados pueden insertar/actualizar
CREATE POLICY "carritos_pendientes_insert_authenticated"
    ON carritos_pendientes FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "carritos_pendientes_update_authenticated"
    ON carritos_pendientes FOR UPDATE TO authenticated
    USING (true);

-- Para permitir inserts desde funciones públicas (sin autenticación)
CREATE POLICY "carritos_pendientes_insert_anon"
    ON carritos_pendientes FOR INSERT TO anon
    WITH CHECK (true);

-- =========================================
-- FUNCIONES RPC
-- =========================================

-- Función para generar código único de carrito
CREATE OR REPLACE FUNCTION fn_generar_codigo_carrito()
RETURNS VARCHAR(8)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_codigo VARCHAR(8);
    v_chars VARCHAR(36) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin I, O, 0, 1 para evitar confusión
BEGIN
    LOOP
        v_codigo := '';
        FOR i IN 1..6 LOOP
            v_codigo := v_codigo || SUBSTR(v_chars, FLOOR(RANDOM() * LENGTH(v_chars))::INT + 1, 1);
        END LOOP;
        
        -- Verificar que no existe
        EXIT WHEN NOT EXISTS (SELECT 1 FROM carritos_pendientes WHERE codigo = v_codigo);
    END LOOP;
    
    RETURN v_codigo;
END;
$$;

-- Función para crear o actualizar carrito desde catálogo web
CREATE OR REPLACE FUNCTION fn_guardar_carrito(
    p_codigo VARCHAR(8) DEFAULT NULL,
    p_telefono VARCHAR(20) DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_total_estimado DECIMAL(12,2) DEFAULT 0,
    p_ip_cliente VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_carrito_id UUID;
    v_codigo VARCHAR(8);
    v_cantidad_items INTEGER;
BEGIN
    -- Contar items
    v_cantidad_items := COALESCE(jsonb_array_length(p_items), 0);
    
    IF p_codigo IS NOT NULL THEN
        -- Actualizar carrito existente
        UPDATE carritos_pendientes
        SET 
            telefono_cliente = COALESCE(p_telefono, telefono_cliente),
            items = p_items,
            total_estimado = p_total_estimado,
            cantidad_items = v_cantidad_items,
            updated_at = NOW()
        WHERE codigo = p_codigo AND estado = 'pendiente'
        RETURNING id, codigo INTO v_carrito_id, v_codigo;
        
        IF v_carrito_id IS NULL THEN
            RETURN json_build_object('success', false, 'error', 'Carrito no encontrado o ya procesado');
        END IF;
    ELSE
        -- Crear nuevo carrito
        v_codigo := fn_generar_codigo_carrito();
        
        INSERT INTO carritos_pendientes (
            codigo,
            telefono_cliente,
            items,
            total_estimado,
            cantidad_items,
            ip_cliente,
            user_agent,
            fecha_expiracion
        ) VALUES (
            v_codigo,
            p_telefono,
            p_items,
            p_total_estimado,
            v_cantidad_items,
            p_ip_cliente,
            p_user_agent,
            NOW() + INTERVAL '24 hours' -- Expira en 24 horas
        )
        RETURNING id INTO v_carrito_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'carrito_id', v_carrito_id,
        'codigo', v_codigo,
        'cantidad_items', v_cantidad_items
    );
END;
$$;

-- Función para obtener carrito por código
CREATE OR REPLACE FUNCTION fn_obtener_carrito(
    p_codigo VARCHAR(8)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_carrito RECORD;
BEGIN
    SELECT * INTO v_carrito
    FROM carritos_pendientes
    WHERE codigo = p_codigo;
    
    IF v_carrito IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Carrito no encontrado');
    END IF;
    
    -- Verificar expiración
    IF v_carrito.fecha_expiracion IS NOT NULL AND v_carrito.fecha_expiracion < NOW() THEN
        UPDATE carritos_pendientes SET estado = 'expirado' WHERE codigo = p_codigo;
        RETURN json_build_object('success', false, 'error', 'Carrito expirado');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'carrito', json_build_object(
            'id', v_carrito.id,
            'codigo', v_carrito.codigo,
            'telefono', v_carrito.telefono_cliente,
            'items', v_carrito.items,
            'total_estimado', v_carrito.total_estimado,
            'cantidad_items', v_carrito.cantidad_items,
            'estado', v_carrito.estado,
            'created_at', v_carrito.created_at
        )
    );
END;
$$;

-- Función para confirmar carrito (marca como confirmado)
CREATE OR REPLACE FUNCTION fn_confirmar_carrito(
    p_codigo VARCHAR(8),
    p_telefono VARCHAR(20)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_carrito_id UUID;
BEGIN
    UPDATE carritos_pendientes
    SET 
        estado = 'confirmado',
        telefono_cliente = p_telefono,
        confirmado_at = NOW(),
        updated_at = NOW()
    WHERE codigo = p_codigo AND estado = 'pendiente'
    RETURNING id INTO v_carrito_id;
    
    IF v_carrito_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Carrito no encontrado o ya procesado');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'carrito_id', v_carrito_id,
        'mensaje', 'Carrito confirmado correctamente'
    );
END;
$$;
