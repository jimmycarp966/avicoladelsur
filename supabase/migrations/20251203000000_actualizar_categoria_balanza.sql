-- ===========================================
-- ACTUALIZAR CATEGORÍA "Balanza" A PRODUCTOS ESPECÍFICOS
-- Fecha: 03/12/2025
-- ===========================================

BEGIN;

-- Actualizar categoría a "Balanza" para los productos específicos
UPDATE productos
SET 
    categoria = 'Balanza',
    updated_at = NOW()
WHERE codigo IN ('55', '148', '149', '150', '151', '152', '153', '204', '205', '227', '471');

-- Verificar la actualización
SELECT 
    codigo,
    nombre,
    categoria,
    updated_at
FROM productos
WHERE codigo IN ('55', '148', '149', '150', '151', '152', '153', '204', '205', '227', '471')
ORDER BY codigo;

COMMIT;
