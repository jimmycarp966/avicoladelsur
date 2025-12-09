-- ===========================================
-- Actualizar Políticas RLS para Rol "encargado_sucursal"
-- Fecha: 17/01/2025
-- Objetivo: Agregar políticas RLS específicas para encargado_sucursal
-- que solo puede ver/modificar datos de su sucursal asignada
-- ===========================================
-- NOTA: Se ejecuta sin transacción explícita para evitar deadlocks
-- Cada operación se ejecuta de forma independiente con manejo de errores

-- ===========================================
-- TESORERÍA: Cajas, Movimientos y Cierres
-- ===========================================

-- Actualizar políticas de tesoreria_cajas
DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_cajas" ON tesoreria_cajas;
    CREATE POLICY "encargado_sucursal_cajas" ON tesoreria_cajas
    FOR ALL
    USING (
        get_user_role() = 'encargado_sucursal' AND
        (sucursal_id = get_user_sucursal_id() OR sucursal_id IS NULL)
    )
    WITH CHECK (
        get_user_role() = 'encargado_sucursal' AND
        (sucursal_id = get_user_sucursal_id() OR sucursal_id IS NULL)
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_cajas: %', SQLERRM;
END $$;

-- Actualizar políticas de tesoreria_movimientos
DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_movimientos" ON tesoreria_movimientos;
    CREATE POLICY "encargado_sucursal_movimientos" ON tesoreria_movimientos
    FOR ALL
    USING (
        get_user_role() = 'encargado_sucursal' AND
        EXISTS (
            SELECT 1 FROM tesoreria_cajas tc
            WHERE tc.id = tesoreria_movimientos.caja_id
            AND (tc.sucursal_id = get_user_sucursal_id() OR tc.sucursal_id IS NULL)
        )
    )
    WITH CHECK (
        get_user_role() = 'encargado_sucursal' AND
        EXISTS (
            SELECT 1 FROM tesoreria_cajas tc
            WHERE tc.id = tesoreria_movimientos.caja_id
            AND (tc.sucursal_id = get_user_sucursal_id() OR tc.sucursal_id IS NULL)
        )
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_movimientos: %', SQLERRM;
END $$;

-- Actualizar políticas de cierres_caja
DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_cierres" ON cierres_caja;
    CREATE POLICY "encargado_sucursal_cierres" ON cierres_caja
    FOR ALL
    USING (
        get_user_role() = 'encargado_sucursal' AND
        EXISTS (
            SELECT 1 FROM tesoreria_cajas tc
            WHERE tc.id = cierres_caja.caja_id
            AND (tc.sucursal_id = get_user_sucursal_id() OR tc.sucursal_id IS NULL)
        )
    )
    WITH CHECK (
        get_user_role() = 'encargado_sucursal' AND
        EXISTS (
            SELECT 1 FROM tesoreria_cajas tc
            WHERE tc.id = cierres_caja.caja_id
            AND (tc.sucursal_id = get_user_sucursal_id() OR tc.sucursal_id IS NULL)
        )
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_cierres: %', SQLERRM;
END $$;

-- ===========================================
-- SUCURSALES: Solo lectura de su sucursal
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_access_own" ON sucursales;
    CREATE POLICY "encargado_sucursal_access_own" ON sucursales
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal' AND
        id = get_user_sucursal_id()
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_access_own: %', SQLERRM;
END $$;

-- ===========================================
-- ALERTAS DE STOCK: Solo de su sucursal
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_alertas" ON alertas_stock;
    CREATE POLICY "encargado_sucursal_alertas" ON alertas_stock
    FOR ALL
    USING (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_id = get_user_sucursal_id()
    )
    WITH CHECK (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_id = get_user_sucursal_id()
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_alertas: %', SQLERRM;
END $$;

-- ===========================================
-- TRANSFERENCIAS: Solo recibir (no crear)
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_transferencias" ON transferencias_stock;
    DROP POLICY IF EXISTS "encargado_sucursal_recibir_transferencias" ON transferencias_stock;
    
    CREATE POLICY "encargado_sucursal_transferencias" ON transferencias_stock
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal' AND
        (sucursal_origen_id = get_user_sucursal_id() OR sucursal_destino_id = get_user_sucursal_id())
    );
    
    CREATE POLICY "encargado_sucursal_recibir_transferencias" ON transferencias_stock
    FOR UPDATE
    USING (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_destino_id = get_user_sucursal_id()
    )
    WITH CHECK (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_destino_id = get_user_sucursal_id()
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando políticas de transferencias: %', SQLERRM;
END $$;

-- ===========================================
-- CONTEOS DE STOCK: Solo de su sucursal
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_conteos" ON conteos_stock;
    CREATE POLICY "encargado_sucursal_conteos" ON conteos_stock
    FOR ALL
    USING (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_id = get_user_sucursal_id()
    )
    WITH CHECK (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_id = get_user_sucursal_id()
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_conteos: %', SQLERRM;
END $$;

-- ===========================================
-- PRESUPUESTOS: Solo lectura (pero pueden crear ventas POS)
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_presupuestos" ON presupuestos;
    CREATE POLICY "encargado_sucursal_presupuestos" ON presupuestos
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal' AND
        (sucursal_id IS NULL OR sucursal_id = get_user_sucursal_id())
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_presupuestos: %', SQLERRM;
END $$;

-- ===========================================
-- PEDIDOS: Solo lectura de su sucursal
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_pedidos" ON pedidos;
    CREATE POLICY "encargado_sucursal_pedidos" ON pedidos
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal' AND
        (sucursal_id IS NULL OR sucursal_id = get_user_sucursal_id())
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_pedidos: %', SQLERRM;
END $$;

-- ===========================================
-- CLIENTES: Acceso limitado a clientes de su sucursal
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_clientes" ON clientes;
    CREATE POLICY "encargado_sucursal_clientes" ON clientes
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_clientes: %', SQLERRM;
END $$;

-- ===========================================
-- PRODUCTOS: Solo lectura (necesario para POS)
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_productos" ON productos;
    CREATE POLICY "encargado_sucursal_productos" ON productos
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_productos: %', SQLERRM;
END $$;

-- ===========================================
-- LOTES: Solo lectura de lotes de su sucursal
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_lotes" ON lotes;
    CREATE POLICY "encargado_sucursal_lotes" ON lotes
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal' AND
        (sucursal_id IS NULL OR sucursal_id = get_user_sucursal_id())
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_lotes: %', SQLERRM;
END $$;

-- ===========================================
-- VENTAS SUCURSAL: Acceso completo para crear ventas POS
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_ventas" ON ventas_sucursal;
    CREATE POLICY "encargado_sucursal_ventas" ON ventas_sucursal
    FOR ALL
    USING (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_id = get_user_sucursal_id()
    )
    WITH CHECK (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_id = get_user_sucursal_id()
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_ventas: %', SQLERRM;
END $$;

-- ===========================================
-- AUDITORÍA: Solo de su sucursal
-- ===========================================

DO $$
BEGIN
    DROP POLICY IF EXISTS "encargado_sucursal_auditoria" ON auditoria_listas_precios;
    CREATE POLICY "encargado_sucursal_auditoria" ON auditoria_listas_precios
    FOR SELECT
    USING (
        get_user_role() = 'encargado_sucursal' AND
        sucursal_id = get_user_sucursal_id()
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creando política encargado_sucursal_auditoria: %', SQLERRM;
END $$;
