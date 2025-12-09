-- ===========================================
-- CONFIGURACIÓN DE ROLES: VENDEDOR Y ALMACENISTA
-- Fecha: 2025-12-29
-- ===========================================
-- Este script configura los usuarios vendedor y almacenista
-- y crea todas las políticas RLS necesarias para cada rol.
--
-- IMPORTANTE: Los usuarios deben crearse primero en Supabase Dashboard
-- (Authentication > Users) antes de ejecutar este script.
-- Emails: vendedor@avicoladelsur.com y almacenista@avicoladelsur.com
-- ===========================================

-- ===========================================
-- PARTE 1: CREACIÓN DE USUARIOS EN TABLA usuarios
-- ===========================================

-- Temporalmente desactivar RLS para configurar usuarios
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- Crear/actualizar usuario VENDEDOR
INSERT INTO usuarios (id, email, nombre, apellido, telefono, rol, activo, created_at, updated_at)
SELECT 
    au.id,
    'vendedor@avicoladelsur.com' as email,
    'Vendedor' as nombre,
    'Sistema' as apellido,
    NULL as telefono,
    'vendedor' as rol,
    true as activo,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'vendedor@avicoladelsur.com'
ON CONFLICT (email) DO UPDATE 
SET 
    id = EXCLUDED.id,
    nombre = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    rol = EXCLUDED.rol,
    activo = EXCLUDED.activo,
    updated_at = NOW();

-- Crear/actualizar usuario ALMACENISTA
INSERT INTO usuarios (id, email, nombre, apellido, telefono, rol, activo, created_at, updated_at)
SELECT 
    au.id,
    'almacenista@avicoladelsur.com' as email,
    'Almacenista' as nombre,
    'Sistema' as apellido,
    NULL as telefono,
    'almacenista' as rol,
    true as activo,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users au
WHERE au.email = 'almacenista@avicoladelsur.com'
ON CONFLICT (email) DO UPDATE 
SET 
    id = EXCLUDED.id,
    nombre = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    rol = EXCLUDED.rol,
    activo = EXCLUDED.activo,
    updated_at = NOW();

-- Reactivar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Verificar que los usuarios se crearon correctamente
SELECT id, email, nombre, apellido, rol, activo 
FROM usuarios 
WHERE email IN ('vendedor@avicoladelsur.com', 'almacenista@avicoladelsur.com');

-- ===========================================
-- PARTE 2: POLÍTICAS RLS PARA VENDEDOR
-- ===========================================

-- Función helper para verificar rol (reutilizar si existe, sino usar directo)
-- Usamos get_user_role() que ya existe en 20251215_fix_rls_sucursales.sql

-- PRODUCTOS: Solo lectura para vendedor
DROP POLICY IF EXISTS "vendedor_read_products" ON productos;
CREATE POLICY "vendedor_read_products" ON productos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- CLIENTES: Vendedor puede crear, leer y editar (no eliminar)
DROP POLICY IF EXISTS "vendedor_clientes_select" ON clientes;
DROP POLICY IF EXISTS "vendedor_clientes_insert" ON clientes;
DROP POLICY IF EXISTS "vendedor_clientes_update" ON clientes;

CREATE POLICY "vendedor_clientes_select" ON clientes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_clientes_insert" ON clientes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_clientes_update" ON clientes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- PEDIDOS: Vendedor puede crear, leer y editar todos los pedidos (no eliminar)
DROP POLICY IF EXISTS "vendedor_pedidos_select" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_insert" ON pedidos;
DROP POLICY IF EXISTS "vendedor_pedidos_update" ON pedidos;

CREATE POLICY "vendedor_pedidos_select" ON pedidos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_pedidos_insert" ON pedidos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_pedidos_update" ON pedidos
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- DETALLES_PEDIDO: Vendedor puede crear, leer y editar
DROP POLICY IF EXISTS "vendedor_detalles_pedido_select" ON detalles_pedido;
DROP POLICY IF EXISTS "vendedor_detalles_pedido_insert" ON detalles_pedido;
DROP POLICY IF EXISTS "vendedor_detalles_pedido_update" ON detalles_pedido;

CREATE POLICY "vendedor_detalles_pedido_select" ON detalles_pedido
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pedidos p
            JOIN usuarios u ON u.id = auth.uid()
            WHERE p.id = detalles_pedido.pedido_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

CREATE POLICY "vendedor_detalles_pedido_insert" ON detalles_pedido
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pedidos p
            JOIN usuarios u ON u.id = auth.uid()
            WHERE p.id = detalles_pedido.pedido_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

CREATE POLICY "vendedor_detalles_pedido_update" ON detalles_pedido
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM pedidos p
            JOIN usuarios u ON u.id = auth.uid()
            WHERE p.id = detalles_pedido.pedido_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

-- COTIZACIONES: Vendedor puede crear, leer y editar (no eliminar)
DROP POLICY IF EXISTS "vendedor_cotizaciones_select" ON cotizaciones;
DROP POLICY IF EXISTS "vendedor_cotizaciones_insert" ON cotizaciones;
DROP POLICY IF EXISTS "vendedor_cotizaciones_update" ON cotizaciones;

CREATE POLICY "vendedor_cotizaciones_select" ON cotizaciones
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_cotizaciones_insert" ON cotizaciones
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_cotizaciones_update" ON cotizaciones
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- DETALLES_COTIZACION: Vendedor puede crear, leer y editar
DROP POLICY IF EXISTS "vendedor_detalles_cotizacion_select" ON detalles_cotizacion;
DROP POLICY IF EXISTS "vendedor_detalles_cotizacion_insert" ON detalles_cotizacion;
DROP POLICY IF EXISTS "vendedor_detalles_cotizacion_update" ON detalles_cotizacion;

CREATE POLICY "vendedor_detalles_cotizacion_select" ON detalles_cotizacion
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cotizaciones c
            JOIN usuarios u ON u.id = auth.uid()
            WHERE c.id = detalles_cotizacion.cotizacion_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

CREATE POLICY "vendedor_detalles_cotizacion_insert" ON detalles_cotizacion
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM cotizaciones c
            JOIN usuarios u ON u.id = auth.uid()
            WHERE c.id = detalles_cotizacion.cotizacion_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

CREATE POLICY "vendedor_detalles_cotizacion_update" ON detalles_cotizacion
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM cotizaciones c
            JOIN usuarios u ON u.id = auth.uid()
            WHERE c.id = detalles_cotizacion.cotizacion_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

-- FACTURAS: Vendedor puede ver y crear
DROP POLICY IF EXISTS "vendedor_facturas_select" ON facturas;
DROP POLICY IF EXISTS "vendedor_facturas_insert" ON facturas;

CREATE POLICY "vendedor_facturas_select" ON facturas
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_facturas_insert" ON facturas
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- FACTURA_ITEMS: Vendedor puede ver y crear
DROP POLICY IF EXISTS "vendedor_factura_items_select" ON factura_items;
DROP POLICY IF EXISTS "vendedor_factura_items_insert" ON factura_items;

CREATE POLICY "vendedor_factura_items_select" ON factura_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM facturas f
            JOIN usuarios u ON u.id = auth.uid()
            WHERE f.id = factura_items.factura_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

CREATE POLICY "vendedor_factura_items_insert" ON factura_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM facturas f
            JOIN usuarios u ON u.id = auth.uid()
            WHERE f.id = factura_items.factura_id
            AND u.rol IN ('admin', 'vendedor')
            AND u.activo = true
        )
    );

-- LOTES: Vendedor puede ver (para consultar stock)
DROP POLICY IF EXISTS "vendedor_lotes_select" ON lotes;

CREATE POLICY "vendedor_lotes_select" ON lotes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- MOVIMIENTOS_STOCK: Vendedor puede ver (para consultar movimientos)
DROP POLICY IF EXISTS "vendedor_movimientos_stock_select" ON movimientos_stock;

CREATE POLICY "vendedor_movimientos_stock_select" ON movimientos_stock
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- LISTAS_PRECIOS: Vendedor puede ver
DROP POLICY IF EXISTS "vendedor_listas_precios_select" ON listas_precios;

CREATE POLICY "vendedor_listas_precios_select" ON listas_precios
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- PRECIOS_PRODUCTOS: Vendedor puede ver (no modificar)
DROP POLICY IF EXISTS "vendedor_precios_productos_select" ON precios_productos;

CREATE POLICY "vendedor_precios_productos_select" ON precios_productos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- RECLAMOS: Vendedor puede ver
DROP POLICY IF EXISTS "vendedor_reclamos_select" ON reclamos;

CREATE POLICY "vendedor_reclamos_select" ON reclamos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- VEHICULOS: Vendedor puede ver
DROP POLICY IF EXISTS "vendedor_vehiculos_select" ON vehiculos;

CREATE POLICY "vendedor_vehiculos_select" ON vehiculos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- RUTAS_REPARTO: Vendedor puede ver
DROP POLICY IF EXISTS "vendedor_rutas_reparto_select" ON rutas_reparto;

CREATE POLICY "vendedor_rutas_reparto_select" ON rutas_reparto
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- SUCURSALES: Vendedor puede ver
DROP POLICY IF EXISTS "vendedor_sucursales_select" ON sucursales;

CREATE POLICY "vendedor_sucursales_select" ON sucursales
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- GASTOS: Vendedor puede ver
DROP POLICY IF EXISTS "vendedor_gastos_select" ON gastos;

CREATE POLICY "vendedor_gastos_select" ON gastos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- CUENTAS_CORRIENTES: Vendedor puede ver y modificar
DROP POLICY IF EXISTS "vendedor_cuentas_corrientes_select" ON cuentas_corrientes;
DROP POLICY IF EXISTS "vendedor_cuentas_corrientes_update" ON cuentas_corrientes;

CREATE POLICY "vendedor_cuentas_corrientes_select" ON cuentas_corrientes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_cuentas_corrientes_update" ON cuentas_corrientes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- CUENTAS_MOVIMIENTOS: Vendedor puede ver y modificar
DROP POLICY IF EXISTS "vendedor_cuentas_movimientos_select" ON cuentas_movimientos;
DROP POLICY IF EXISTS "vendedor_cuentas_movimientos_update" ON cuentas_movimientos;

CREATE POLICY "vendedor_cuentas_movimientos_select" ON cuentas_movimientos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

CREATE POLICY "vendedor_cuentas_movimientos_update" ON cuentas_movimientos
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'vendedor') 
            AND activo = true
        )
    );

-- ===========================================
-- PARTE 3: POLÍTICAS RLS PARA ALMACENISTA
-- ===========================================

-- PRODUCTOS: Almacenista solo lectura
DROP POLICY IF EXISTS "almacenista_productos_select" ON productos;

CREATE POLICY "almacenista_productos_select" ON productos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- LOTES: Almacenista solo lectura
DROP POLICY IF EXISTS "almacenista_lotes_select" ON lotes;

CREATE POLICY "almacenista_lotes_select" ON lotes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- MOVIMIENTOS_STOCK: Almacenista puede ver, crear y editar (registrar movimientos)
DROP POLICY IF EXISTS "almacenista_movimientos_stock_select" ON movimientos_stock;
DROP POLICY IF EXISTS "almacenista_movimientos_stock_insert" ON movimientos_stock;
DROP POLICY IF EXISTS "almacenista_movimientos_stock_update" ON movimientos_stock;

CREATE POLICY "almacenista_movimientos_stock_select" ON movimientos_stock
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

CREATE POLICY "almacenista_movimientos_stock_insert" ON movimientos_stock
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

CREATE POLICY "almacenista_movimientos_stock_update" ON movimientos_stock
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- PRECIOS_PRODUCTOS: Almacenista puede ver (no modificar)
DROP POLICY IF EXISTS "almacenista_precios_productos_select" ON precios_productos;

CREATE POLICY "almacenista_precios_productos_select" ON precios_productos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- LISTAS_PRECIOS: Almacenista puede ver
DROP POLICY IF EXISTS "almacenista_listas_precios_select" ON listas_precios;

CREATE POLICY "almacenista_listas_precios_select" ON listas_precios
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- CHECKLISTS_CALIDAD: Almacenista puede ver
DROP POLICY IF EXISTS "almacenista_checklists_calidad_select" ON checklists_calidad;

CREATE POLICY "almacenista_checklists_calidad_select" ON checklists_calidad
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- FACTURAS: Almacenista puede ver
DROP POLICY IF EXISTS "almacenista_facturas_select" ON facturas;

CREATE POLICY "almacenista_facturas_select" ON facturas
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- FACTURA_ITEMS: Almacenista puede ver
DROP POLICY IF EXISTS "almacenista_factura_items_select" ON factura_items;

CREATE POLICY "almacenista_factura_items_select" ON factura_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM facturas f
            JOIN usuarios u ON u.id = auth.uid()
            WHERE f.id = factura_items.factura_id
            AND u.rol IN ('admin', 'almacenista')
            AND u.activo = true
        )
    );

-- VEHICULOS: Almacenista puede ver
DROP POLICY IF EXISTS "almacenista_vehiculos_select" ON vehiculos;

CREATE POLICY "almacenista_vehiculos_select" ON vehiculos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- RUTAS_REPARTO: Almacenista puede ver
DROP POLICY IF EXISTS "almacenista_rutas_reparto_select" ON rutas_reparto;

CREATE POLICY "almacenista_rutas_reparto_select" ON rutas_reparto
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- SUCURSALES: Almacenista puede ver
DROP POLICY IF EXISTS "almacenista_sucursales_select" ON sucursales;

CREATE POLICY "almacenista_sucursales_select" ON sucursales
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol IN ('admin', 'almacenista') 
            AND activo = true
        )
    );

-- ===========================================
-- VERIFICACIÓN FINAL
-- ===========================================

-- Verificar usuarios creados
SELECT id, email, nombre, apellido, rol, activo 
FROM usuarios 
WHERE email IN ('vendedor@avicoladelsur.com', 'almacenista@avicoladelsur.com')
ORDER BY email;

-- Verificar políticas creadas para vendedor
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE policyname LIKE 'vendedor_%'
ORDER BY tablename, policyname;

-- Verificar políticas creadas para almacenista
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE policyname LIKE 'almacenista_%'
ORDER BY tablename, policyname;

-- ===========================================
-- NOTAS FINALES
-- ===========================================
-- 1. Los usuarios deben crearse primero en Supabase Dashboard
--    (Authentication > Users) con los emails:
--    - vendedor@avicoladelsur.com
--    - almacenista@avicoladelsur.com
--
-- 2. Después de crear los usuarios en Auth, ejecutar este script
--    en el SQL Editor de Supabase
--
-- 3. Verificar que ambos usuarios aparezcan en la tabla usuarios
--    con rol correcto y activo = true
--
-- 4. Las políticas RLS permiten que admin siempre tenga acceso completo
--    además de los permisos específicos de cada rol










