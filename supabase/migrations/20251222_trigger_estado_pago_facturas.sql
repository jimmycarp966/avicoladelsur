-- ===========================================
-- MIGRACIÓN: Trigger automático para estado de pago de facturas
-- Fecha: 21/12/2025
-- Descripción: Actualiza automáticamente estado_pago según monto_pagado
-- ===========================================

BEGIN;

-- Trigger function para actualizar estado_pago automáticamente
CREATE OR REPLACE FUNCTION fn_actualizar_estado_pago_factura()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular saldo pendiente
    NEW.saldo_pendiente := NEW.total - COALESCE(NEW.monto_pagado, 0);
    
    -- Determinar estado de pago
    IF NEW.estado = 'anulada' THEN
        NEW.estado_pago := 'anulada';
    ELSIF COALESCE(NEW.monto_pagado, 0) >= NEW.total THEN
        NEW.estado_pago := 'pagada';
        NEW.saldo_pendiente := 0;
    ELSIF COALESCE(NEW.monto_pagado, 0) > 0 THEN
        NEW.estado_pago := 'parcial';
    ELSE
        NEW.estado_pago := 'pendiente';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en tabla facturas
DROP TRIGGER IF EXISTS trg_actualizar_estado_pago_factura ON facturas;
CREATE TRIGGER trg_actualizar_estado_pago_factura
    BEFORE INSERT OR UPDATE ON facturas
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_estado_pago_factura();

-- =====================================================
-- ACTUALIZAR FACTURAS EXISTENTES
-- Basado en el estado del pedido asociado
-- =====================================================

-- 1. Inicializar campos para facturas que no los tienen
UPDATE facturas
SET 
    monto_pagado = COALESCE(monto_pagado, 0),
    saldo_pendiente = COALESCE(saldo_pendiente, total),
    estado_pago = COALESCE(estado_pago, 'pendiente')
WHERE monto_pagado IS NULL OR saldo_pendiente IS NULL OR estado_pago IS NULL;

-- 2. Marcar como PAGADA las facturas cuyo pedido está en estado 'entregado' o 'completado'
UPDATE facturas f
SET 
    monto_pagado = f.total,
    saldo_pendiente = 0,
    estado_pago = 'pagada'
FROM pedidos p
WHERE f.pedido_id = p.id
  AND p.estado IN ('entregado', 'completado')
  AND f.estado_pago = 'pendiente';

-- 3. Marcar como ANULADA las facturas cuyo pedido fue cancelado
UPDATE facturas f
SET 
    estado_pago = 'anulada',
    monto_pagado = 0,
    saldo_pendiente = 0
FROM pedidos p
WHERE f.pedido_id = p.id
  AND p.estado = 'cancelado';

-- 4. También marcar como anulada si la propia factura está anulada
UPDATE facturas
SET estado_pago = 'anulada'
WHERE estado = 'anulada' AND estado_pago != 'anulada';

COMMENT ON FUNCTION fn_actualizar_estado_pago_factura IS 
'Trigger que actualiza automáticamente estado_pago y saldo_pendiente de facturas.
- pagada: monto_pagado >= total
- parcial: monto_pagado > 0 pero < total  
- pendiente: monto_pagado = 0
- anulada: factura cancelada';

COMMIT;
