-- ===========================================
-- MIGRACIÓN: Sistema de Listas de Precios
-- Fecha: 15/01/2025
-- ===========================================

BEGIN;

-- ===========================================
-- NUEVAS TABLAS
-- ===========================================

-- TABLA LISTAS_PRECIOS
CREATE TABLE IF NOT EXISTS listas_precios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('minorista', 'mayorista', 'distribuidor', 'personalizada')),
    activa BOOLEAN DEFAULT true,
    margen_ganancia DECIMAL(5,2), -- Porcentaje de margen (ej: 30.00 = 30%)
    fecha_vigencia_desde DATE,
    fecha_vigencia_hasta DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLA PRECIOS_PRODUCTOS
CREATE TABLE IF NOT EXISTS precios_productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lista_precio_id UUID NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    precio DECIMAL(10,2) NOT NULL,
    fecha_desde DATE,
    fecha_hasta DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lista_precio_id, producto_id, fecha_desde)
);

-- TABLA CLIENTES_LISTAS_PRECIOS (muchos a muchos)
CREATE TABLE IF NOT EXISTS clientes_listas_precios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    lista_precio_id UUID NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
    es_automatica BOOLEAN DEFAULT false,
    prioridad INTEGER DEFAULT 1,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cliente_id, lista_precio_id)
);

-- ===========================================
-- MODIFICACIONES A TABLAS EXISTENTES
-- ===========================================

-- Agregar lista_precio_id a presupuestos
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS lista_precio_id UUID REFERENCES listas_precios(id);

-- Agregar lista_precio_id a pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS lista_precio_id UUID REFERENCES listas_precios(id);

-- ===========================================
-- ÍNDICES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_listas_precios_tipo ON listas_precios(tipo);
CREATE INDEX IF NOT EXISTS idx_listas_precios_activa ON listas_precios(activa);
CREATE INDEX IF NOT EXISTS idx_precios_productos_lista ON precios_productos(lista_precio_id);
CREATE INDEX IF NOT EXISTS idx_precios_productos_producto ON precios_productos(producto_id);
CREATE INDEX IF NOT EXISTS idx_precios_productos_activo ON precios_productos(activo);
CREATE INDEX IF NOT EXISTS idx_clientes_listas_cliente ON clientes_listas_precios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_listas_lista ON clientes_listas_precios(lista_precio_id);
CREATE INDEX IF NOT EXISTS idx_clientes_listas_activa ON clientes_listas_precios(activa);
CREATE INDEX IF NOT EXISTS idx_presupuestos_lista_precio ON presupuestos(lista_precio_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_lista_precio ON pedidos(lista_precio_id);

-- ===========================================
-- FUNCIONES RPC
-- ===========================================

-- Función para obtener precio de un producto en una lista específica
CREATE OR REPLACE FUNCTION fn_obtener_precio_producto(
    p_lista_precio_id UUID,
    p_producto_id UUID
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_precio DECIMAL(10,2);
    v_precio_costo DECIMAL(10,2);
    v_margen_ganancia DECIMAL(5,2);
BEGIN
    -- Buscar precio en la lista específica (activo y vigente)
    SELECT precio INTO v_precio
    FROM precios_productos
    WHERE lista_precio_id = p_lista_precio_id
      AND producto_id = p_producto_id
      AND activo = true
      AND (fecha_desde IS NULL OR fecha_desde <= CURRENT_DATE)
      AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
    ORDER BY fecha_desde DESC NULLS LAST
    LIMIT 1;

    -- Si no se encuentra precio manual, calcular desde margen de ganancia de la lista
    IF v_precio IS NULL THEN
        -- Obtener margen de ganancia de la lista y precio_costo del producto
        SELECT lp.margen_ganancia, p.precio_costo
        INTO v_margen_ganancia, v_precio_costo
        FROM listas_precios lp
        CROSS JOIN productos p
        WHERE lp.id = p_lista_precio_id
          AND p.id = p_producto_id;

        -- Si hay margen configurado y precio_costo disponible, calcular precio
        IF v_margen_ganancia IS NOT NULL AND v_margen_ganancia > 0 
           AND v_precio_costo IS NOT NULL AND v_precio_costo > 0 THEN
            v_precio := v_precio_costo * (1 + v_margen_ganancia / 100);
        END IF;
    END IF;

    -- Si aún no hay precio, usar precio_venta del producto como fallback
    IF v_precio IS NULL THEN
        SELECT precio_venta INTO v_precio
        FROM productos
        WHERE id = p_producto_id;
    END IF;

    -- Si aún es NULL, retornar 0
    RETURN COALESCE(v_precio, 0);
END;
$$ LANGUAGE plpgsql;

-- Función para validar que un cliente no tenga más de 2 listas activas
CREATE OR REPLACE FUNCTION fn_validar_listas_cliente(
    p_cliente_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM clientes_listas_precios
    WHERE cliente_id = p_cliente_id
      AND activa = true;

    RETURN v_count < 2;
END;
$$ LANGUAGE plpgsql;

-- Función para asignar lista automática según tipo_cliente
CREATE OR REPLACE FUNCTION fn_asignar_lista_automatica_cliente(
    p_cliente_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_tipo_cliente VARCHAR(50);
    v_lista_id UUID;
    v_existe BOOLEAN;
    v_count INTEGER;
    v_result JSONB;
BEGIN
    -- Obtener tipo_cliente del cliente
    SELECT tipo_cliente INTO v_tipo_cliente
    FROM clientes
    WHERE id = p_cliente_id;

    IF v_tipo_cliente IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;

    -- Solo procesar si es minorista, mayorista o distribuidor
    IF v_tipo_cliente NOT IN ('minorista', 'mayorista', 'distribuidor') THEN
        RETURN jsonb_build_object('success', true, 'message', 'Tipo de cliente no requiere lista automática');
    END IF;

    -- Buscar lista correspondiente al tipo
    SELECT id INTO v_lista_id
    FROM listas_precios
    WHERE tipo = v_tipo_cliente
      AND activa = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_lista_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No existe lista de precios para el tipo ' || v_tipo_cliente);
    END IF;

    -- Verificar si el cliente ya tiene esta lista asignada
    SELECT EXISTS(
        SELECT 1 FROM clientes_listas_precios
        WHERE cliente_id = p_cliente_id
          AND lista_precio_id = v_lista_id
    ) INTO v_existe;

    IF v_existe THEN
        RETURN jsonb_build_object('success', true, 'message', 'Lista ya asignada');
    END IF;

    -- Desactivar listas automáticas anteriores del mismo tipo
    UPDATE clientes_listas_precios
    SET activa = false,
        updated_at = NOW()
    WHERE cliente_id = p_cliente_id
      AND es_automatica = true
      AND activa = true;

    -- Verificar que no exceda el límite de 2 listas
    SELECT COUNT(*) INTO v_count
    FROM clientes_listas_precios
    WHERE cliente_id = p_cliente_id
      AND activa = true;

    IF v_count >= 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente ya tiene 2 listas activas');
    END IF;

    -- Asignar nueva lista automática
    INSERT INTO clientes_listas_precios (
        cliente_id,
        lista_precio_id,
        es_automatica,
        prioridad,
        activa
    ) VALUES (
        p_cliente_id,
        v_lista_id,
        true,
        1,
        true
    )
    ON CONFLICT (cliente_id, lista_precio_id) DO UPDATE
    SET es_automatica = true,
        activa = true,
        prioridad = 1,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'lista_id', v_lista_id);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Trigger para validar máximo 2 listas activas antes de insertar
CREATE OR REPLACE FUNCTION trigger_validar_listas_cliente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activa = true THEN
        IF NOT fn_validar_listas_cliente(NEW.cliente_id) THEN
            RAISE EXCEPTION 'El cliente no puede tener más de 2 listas activas';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_listas_cliente_before_insert ON clientes_listas_precios;
CREATE TRIGGER trg_validar_listas_cliente_before_insert
BEFORE INSERT ON clientes_listas_precios
FOR EACH ROW
EXECUTE FUNCTION trigger_validar_listas_cliente();

DROP TRIGGER IF EXISTS trg_validar_listas_cliente_before_update ON clientes_listas_precios;
CREATE TRIGGER trg_validar_listas_cliente_before_update
BEFORE UPDATE ON clientes_listas_precios
FOR EACH ROW
WHEN (NEW.activa = true AND OLD.activa = false)
EXECUTE FUNCTION trigger_validar_listas_cliente();

-- Trigger para asignar lista automática al crear cliente
CREATE OR REPLACE FUNCTION trigger_asignar_lista_cliente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo_cliente IN ('minorista', 'mayorista', 'distribuidor') THEN
        PERFORM fn_asignar_lista_automatica_cliente(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asignar_lista_cliente_insert ON clientes;
CREATE TRIGGER trg_asignar_lista_cliente_insert
AFTER INSERT ON clientes
FOR EACH ROW
EXECUTE FUNCTION trigger_asignar_lista_cliente();

-- Trigger para actualizar lista automática al cambiar tipo_cliente
CREATE OR REPLACE FUNCTION trigger_actualizar_lista_cliente()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tipo_cliente IS DISTINCT FROM NEW.tipo_cliente THEN
        IF NEW.tipo_cliente IN ('minorista', 'mayorista', 'distribuidor') THEN
            PERFORM fn_asignar_lista_automatica_cliente(NEW.id);
        ELSE
            -- Desactivar lista automática si cambia a un tipo que no requiere lista
            UPDATE clientes_listas_precios
            SET activa = false,
                updated_at = NOW()
            WHERE cliente_id = NEW.id
              AND es_automatica = true
              AND activa = true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_lista_cliente_update ON clientes;
CREATE TRIGGER trg_actualizar_lista_cliente_update
AFTER UPDATE OF tipo_cliente ON clientes
FOR EACH ROW
EXECUTE FUNCTION trigger_actualizar_lista_cliente();

-- ===========================================
-- INSERTAR LISTAS BASE
-- ===========================================

-- Insertar listas base si no existen
INSERT INTO listas_precios (codigo, nombre, tipo, activa)
SELECT 'MINORISTA', 'Lista Minorista', 'minorista', true
WHERE NOT EXISTS (SELECT 1 FROM listas_precios WHERE codigo = 'MINORISTA');

INSERT INTO listas_precios (codigo, nombre, tipo, activa)
SELECT 'MAYORISTA', 'Lista Mayorista', 'mayorista', true
WHERE NOT EXISTS (SELECT 1 FROM listas_precios WHERE codigo = 'MAYORISTA');

INSERT INTO listas_precios (codigo, nombre, tipo, activa)
SELECT 'DISTRIBUIDOR', 'Lista Distribuidor', 'distribuidor', true
WHERE NOT EXISTS (SELECT 1 FROM listas_precios WHERE codigo = 'DISTRIBUIDOR');

-- Inicializar precios desde precio_venta de productos existentes
INSERT INTO precios_productos (lista_precio_id, producto_id, precio, activo)
SELECT 
    lp.id,
    p.id,
    p.precio_venta,
    true
FROM listas_precios lp
CROSS JOIN productos p
WHERE lp.tipo IN ('minorista', 'mayorista', 'distribuidor')
  AND p.activo = true
  AND NOT EXISTS (
      SELECT 1 FROM precios_productos pp
      WHERE pp.lista_precio_id = lp.id
        AND pp.producto_id = p.id
  );

-- ===========================================
-- POLÍTICAS RLS
-- ===========================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE listas_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_listas_precios ENABLE ROW LEVEL SECURITY;

-- Políticas para listas_precios
-- Admins ven todas las listas
CREATE POLICY "Admins pueden ver todas las listas"
ON listas_precios FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- Vendedores ven listas activas
DROP POLICY IF EXISTS "Vendedores pueden ver listas activas" ON listas_precios;
CREATE POLICY "Vendedores pueden ver listas activas"
ON listas_precios FOR SELECT
USING (
    activa = true AND (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE id = auth.uid()
            AND rol IN ('admin', 'vendedor')
        )
    )
);

-- Solo admins pueden modificar listas
DROP POLICY IF EXISTS "Solo admins pueden modificar listas" ON listas_precios;
CREATE POLICY "Solo admins pueden modificar listas"
ON listas_precios FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- Políticas para precios_productos
-- Admins ven todos los precios
DROP POLICY IF EXISTS "Admins pueden ver todos los precios" ON precios_productos;
CREATE POLICY "Admins pueden ver todos los precios"
ON precios_productos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- Vendedores ven precios de listas activas
DROP POLICY IF EXISTS "Vendedores pueden ver precios de listas activas" ON precios_productos;
CREATE POLICY "Vendedores pueden ver precios de listas activas"
ON precios_productos FOR SELECT
USING (
    activo = true AND (
        EXISTS (
            SELECT 1 FROM listas_precios lp
            WHERE lp.id = precios_productos.lista_precio_id
            AND lp.activa = true
        ) AND (
            EXISTS (
                SELECT 1 FROM usuarios
                WHERE id = auth.uid()
                AND rol IN ('admin', 'vendedor')
            )
        )
    )
);

-- Solo admins pueden modificar precios
DROP POLICY IF EXISTS "Solo admins pueden modificar precios" ON precios_productos;
CREATE POLICY "Solo admins pueden modificar precios"
ON precios_productos FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- Políticas para clientes_listas_precios
-- Admins ven todas las asignaciones
DROP POLICY IF EXISTS "Admins pueden ver todas las asignaciones" ON clientes_listas_precios;
CREATE POLICY "Admins pueden ver todas las asignaciones"
ON clientes_listas_precios FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- Vendedores ven asignaciones de clientes activos
DROP POLICY IF EXISTS "Vendedores pueden ver asignaciones de clientes" ON clientes_listas_precios;
CREATE POLICY "Vendedores pueden ver asignaciones de clientes"
ON clientes_listas_precios FOR SELECT
USING (
    activa = true AND (
        EXISTS (
            SELECT 1 FROM clientes c
            WHERE c.id = clientes_listas_precios.cliente_id
            AND c.activo = true
        ) AND (
            EXISTS (
                SELECT 1 FROM usuarios
                WHERE id = auth.uid()
                AND rol IN ('admin', 'vendedor')
            )
        )
    )
);

-- Solo admins pueden modificar asignaciones
DROP POLICY IF EXISTS "Solo admins pueden modificar asignaciones" ON clientes_listas_precios;
CREATE POLICY "Solo admins pueden modificar asignaciones"
ON clientes_listas_precios FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid()
        AND rol = 'admin'
    )
);

-- ===========================================
-- ACTUALIZAR FUNCIÓN: fn_convertir_presupuesto_a_pedido
-- Para copiar lista_precio_id del presupuesto al pedido
-- ===========================================

-- Buscar y actualizar la función si existe
DO $$
BEGIN
    -- Verificar si la función existe y actualizar
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'fn_convertir_presupuesto_a_pedido'
    ) THEN
        -- La función será actualizada en una migración separada
        -- Por ahora solo agregamos el campo a la tabla
        NULL;
    END IF;
END $$;

COMMIT;

