-- ===========================================
-- AGREGAR NUEVOS ROLES AL SISTEMA
-- Fecha: 2025-11-26
-- ===========================================
-- Agrega los roles: tesorero y sucursal (encargado de sucursal)
-- Actualiza políticas RLS para incluir estos roles donde corresponda

-- Nota: Los roles se validan en la tabla usuarios, no necesitamos crear una tabla de roles
-- Solo actualizamos las políticas RLS para incluir estos nuevos roles

-- ===========================================
-- POLÍTICAS PARA TESORERÍA
-- ===========================================

-- Actualizar política de tesoreria_cajas para incluir tesorero
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_cajas') THEN
        DROP POLICY IF EXISTS "tesorero_tesoreria_cajas" ON tesoreria_cajas;
        CREATE POLICY "tesorero_tesoreria_cajas" 
            ON tesoreria_cajas FOR ALL 
            USING (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero') 
                    AND activo = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero') 
                    AND activo = true
                )
            );
    END IF;
END $$;

-- Actualizar política de tesoreria_movimientos para incluir tesorero
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_movimientos') THEN
        DROP POLICY IF EXISTS "tesorero_tesoreria_movimientos" ON tesoreria_movimientos;
        CREATE POLICY "tesorero_tesoreria_movimientos" 
            ON tesoreria_movimientos FOR ALL 
            USING (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero') 
                    AND activo = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero') 
                    AND activo = true
                )
            );
    END IF;
END $$;

-- Actualizar política de gastos para incluir tesorero
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gastos') THEN
        DROP POLICY IF EXISTS "tesorero_gastos" ON gastos;
        CREATE POLICY "tesorero_gastos" 
            ON gastos FOR ALL 
            USING (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero') 
                    AND activo = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero') 
                    AND activo = true
                )
            );
    END IF;
END $$;

-- Actualizar política de cuentas_corrientes para incluir tesorero
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cuentas_corrientes') THEN
        DROP POLICY IF EXISTS "tesorero_cuentas_corrientes" ON cuentas_corrientes;
        CREATE POLICY "tesorero_cuentas_corrientes" 
            ON cuentas_corrientes FOR ALL 
            USING (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero', 'vendedor') 
                    AND activo = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM usuarios 
                    WHERE id = auth.uid() 
                    AND rol IN ('admin', 'tesorero', 'vendedor') 
                    AND activo = true
                )
            );
    END IF;
END $$;

-- ===========================================
-- POLÍTICAS PARA ENCARGADO DE SUCURSAL
-- ===========================================

-- Política para ventas (clientes, presupuestos, pedidos)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes') THEN
        DROP POLICY IF EXISTS "sucursal_ventas" ON clientes;
        -- Solo crear si no existe una política que ya incluya vendedor
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'clientes' 
            AND policyname LIKE '%vendedor%'
            AND policyname != 'sucursal_ventas'
        ) THEN
            CREATE POLICY "sucursal_ventas" 
                ON clientes FOR ALL 
                USING (
                    EXISTS (
                        SELECT 1 FROM usuarios 
                        WHERE id = auth.uid() 
                        AND rol IN ('admin', 'vendedor', 'sucursal') 
                        AND activo = true
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM usuarios 
                        WHERE id = auth.uid() 
                        AND rol IN ('admin', 'vendedor', 'sucursal') 
                        AND activo = true
                    )
                );
        ELSE
            -- Si ya existe una política para vendedor, actualizarla para incluir sucursal
            -- Nota: Esto requiere que el usuario actualice manualmente las políticas existentes
            RAISE NOTICE 'Política existente para clientes. Actualizar manualmente para incluir rol sucursal.';
        END IF;
    END IF;
END $$;

-- Política para presupuestos
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuestos') THEN
        DROP POLICY IF EXISTS "sucursal_presupuestos" ON presupuestos;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'presupuestos' 
            AND policyname LIKE '%vendedor%'
            AND policyname != 'sucursal_presupuestos'
        ) THEN
            CREATE POLICY "sucursal_presupuestos" 
                ON presupuestos FOR ALL 
                USING (
                    EXISTS (
                        SELECT 1 FROM usuarios 
                        WHERE id = auth.uid() 
                        AND rol IN ('admin', 'vendedor', 'sucursal') 
                        AND activo = true
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM usuarios 
                        WHERE id = auth.uid() 
                        AND rol IN ('admin', 'vendedor', 'sucursal') 
                        AND activo = true
                    )
                );
        ELSE
            RAISE NOTICE 'Política existente para presupuestos. Actualizar manualmente para incluir rol sucursal.';
        END IF;
    END IF;
END $$;

-- Política para pedidos
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
        DROP POLICY IF EXISTS "sucursal_pedidos" ON pedidos;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'pedidos' 
            AND policyname LIKE '%vendedor%'
            AND policyname != 'sucursal_pedidos'
        ) THEN
            CREATE POLICY "sucursal_pedidos" 
                ON pedidos FOR ALL 
                USING (
                    EXISTS (
                        SELECT 1 FROM usuarios 
                        WHERE id = auth.uid() 
                        AND rol IN ('admin', 'vendedor', 'sucursal') 
                        AND activo = true
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM usuarios 
                        WHERE id = auth.uid() 
                        AND rol IN ('admin', 'vendedor', 'sucursal') 
                        AND activo = true
                    )
                );
        ELSE
            RAISE NOTICE 'Política existente para pedidos. Actualizar manualmente para incluir rol sucursal.';
        END IF;
    END IF;
END $$;

-- Comentario: Los roles 'tesorero' y 'sucursal' ahora están disponibles en el sistema
-- y tienen acceso a las funcionalidades correspondientes según las políticas definidas.

