-- Tabla de carritos pendientes
CREATE TABLE IF NOT EXISTS carritos_pendientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(8) UNIQUE NOT NULL,
    telefono_cliente VARCHAR(20),
    cliente_id UUID REFERENCES clientes(id),
    items JSONB NOT NULL DEFAULT '[]',
    total_estimado DECIMAL(12,2) DEFAULT 0,
    cantidad_items INTEGER DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'convertido', 'expirado', 'cancelado')),
    presupuesto_id UUID REFERENCES presupuestos(id),
    origen VARCHAR(20) DEFAULT 'catalogo' CHECK (origen IN ('catalogo', 'bot', 'manual')),
    ip_cliente VARCHAR(45),
    user_agent TEXT,
    fecha_expiracion TIMESTAMPTZ,
    confirmado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_codigo ON carritos_pendientes(codigo);
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_telefono ON carritos_pendientes(telefono_cliente);
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_estado ON carritos_pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_carritos_pendientes_created ON carritos_pendientes(created_at DESC);

-- RLS
ALTER TABLE carritos_pendientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carritos_pendientes_select_public" ON carritos_pendientes;
CREATE POLICY "carritos_pendientes_select_public"
    ON carritos_pendientes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "carritos_pendientes_insert_authenticated" ON carritos_pendientes;
CREATE POLICY "carritos_pendientes_insert_authenticated"
    ON carritos_pendientes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "carritos_pendientes_update_authenticated" ON carritos_pendientes;
CREATE POLICY "carritos_pendientes_update_authenticated"
    ON carritos_pendientes FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "carritos_pendientes_insert_anon" ON carritos_pendientes;
CREATE POLICY "carritos_pendientes_insert_anon"
    ON carritos_pendientes FOR INSERT TO anon WITH CHECK (true);

-- Función para generar código único
CREATE OR REPLACE FUNCTION fn_generar_codigo_carrito()
RETURNS VARCHAR(8)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_codigo VARCHAR(8);
    v_chars VARCHAR(36) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
    LOOP
        v_codigo := '';
        FOR i IN 1..6 LOOP
            v_codigo := v_codigo || SUBSTR(v_chars, FLOOR(RANDOM() * LENGTH(v_chars))::INT + 1, 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM carritos_pendientes WHERE codigo = v_codigo);
    END LOOP;
    RETURN v_codigo;
END;
$$;

-- Función para guardar carrito
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
    v_cantidad_items := COALESCE(jsonb_array_length(p_items), 0);
    
    IF p_codigo IS NOT NULL THEN
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
        v_codigo := fn_generar_codigo_carrito();
        
        INSERT INTO carritos_pendientes (
            codigo, telefono_cliente, items, total_estimado, cantidad_items,
            ip_cliente, user_agent, fecha_expiracion
        ) VALUES (
            v_codigo, p_telefono, p_items, p_total_estimado, v_cantidad_items,
            p_ip_cliente, p_user_agent, NOW() + INTERVAL '24 hours'
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
$$;;
