-- Desactivar RLS temporalmente para que el bot funcione
-- ADVERTENCIA: Esto permite acceso público a estas tablas
-- En producción, deberías crear políticas RLS específicas

-- Desactivar RLS para productos (lectura pública)
ALTER TABLE productos DISABLE ROW LEVEL SECURITY;

-- Desactivar RLS para clientes (el bot necesita buscar por teléfono)
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- Desactivar RLS para pedidos (el bot necesita crear pedidos)
ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;

-- Desactivar RLS para detalles_pedido (el bot necesita crear detalles)
ALTER TABLE detalles_pedido DISABLE ROW LEVEL SECURITY;

-- Verificar que se desactivó
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('productos', 'clientes', 'pedidos', 'detalles_pedido');

