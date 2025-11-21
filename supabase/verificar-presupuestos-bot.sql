-- =====================================================
-- VERIFICAR PRESUPUESTOS CREADOS DESDE EL BOT
-- =====================================================
-- Este script verifica que los presupuestos creados desde el bot
-- tengan usuario_vendedor asignado y estén visibles

-- Ver todos los presupuestos sin usuario_vendedor (deberían ser 0)
SELECT 
    id,
    numero_presupuesto,
    estado,
    created_at,
    usuario_vendedor,
    cliente_id
FROM presupuestos
WHERE usuario_vendedor IS NULL
ORDER BY created_at DESC;

-- Ver los últimos 5 presupuestos creados
SELECT 
    p.id,
    p.numero_presupuesto,
    p.estado,
    p.created_at,
    p.usuario_vendedor,
    u.nombre as vendedor_nombre,
    u.rol as vendedor_rol,
    c.nombre as cliente_nombre
FROM presupuestos p
LEFT JOIN usuarios u ON p.usuario_vendedor = u.id
LEFT JOIN clientes c ON p.cliente_id = c.id
ORDER BY p.created_at DESC
LIMIT 5;

-- Verificar si hay usuarios admin disponibles
SELECT 
    id,
    email,
    nombre,
    apellido,
    rol,
    activo
FROM usuarios
WHERE rol = 'admin' AND activo = true
ORDER BY created_at ASC;

