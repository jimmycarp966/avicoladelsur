-- ===========================================
-- MIGRACIÓN: Crear tabla movimientos_cuenta_corriente
-- Fecha: 21/12/2025
-- Descripción: Tabla para registrar movimientos de cuenta corriente de clientes
--              (cargos por entregas no pagadas, abonos por pagos posteriores)
-- ===========================================

BEGIN;

-- Crear tabla de movimientos de cuenta corriente
CREATE TABLE IF NOT EXISTS movimientos_cuenta_corriente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cargo', 'abono', 'ajuste')),
    monto DECIMAL(12,2) NOT NULL,
    saldo_anterior DECIMAL(12,2), -- Saldo antes del movimiento
    saldo_posterior DECIMAL(12,2), -- Saldo después del movimiento
    descripcion TEXT,
    referencia_tipo VARCHAR(50), -- 'entrega', 'pago', 'ajuste_manual', etc.
    referencia_id UUID, -- ID de la entrega, pago, etc.
    factura_id UUID REFERENCES facturas(id),
    usuario_id UUID REFERENCES auth.users(id), -- Quien registró el movimiento
    fecha_movimiento TIMESTAMPTZ DEFAULT NOW(),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_movimientos_cc_cliente ON movimientos_cuenta_corriente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_cc_fecha ON movimientos_cuenta_corriente(fecha_movimiento);
CREATE INDEX IF NOT EXISTS idx_movimientos_cc_tipo ON movimientos_cuenta_corriente(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_cc_referencia ON movimientos_cuenta_corriente(referencia_tipo, referencia_id);

-- Agregar campo saldo_cuenta_corriente a clientes si no existe
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS saldo_cuenta_corriente DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN clientes.saldo_cuenta_corriente IS 'Saldo actual de cuenta corriente del cliente (positivo = debe, negativo = a favor)';

-- Trigger para actualizar saldo del cliente automáticamente
CREATE OR REPLACE FUNCTION fn_actualizar_saldo_cuenta_corriente()
RETURNS TRIGGER AS $$
DECLARE
    v_saldo_anterior DECIMAL(12,2);
    v_saldo_nuevo DECIMAL(12,2);
BEGIN
    -- Obtener saldo actual del cliente
    SELECT COALESCE(saldo_cuenta_corriente, 0) 
    INTO v_saldo_anterior
    FROM clientes 
    WHERE id = NEW.cliente_id;

    -- Calcular nuevo saldo según tipo de movimiento
    IF NEW.tipo = 'cargo' THEN
        v_saldo_nuevo := v_saldo_anterior + NEW.monto;
    ELSIF NEW.tipo = 'abono' THEN
        v_saldo_nuevo := v_saldo_anterior - NEW.monto;
    ELSE -- ajuste
        v_saldo_nuevo := v_saldo_anterior + NEW.monto; -- Puede ser positivo o negativo
    END IF;

    -- Guardar saldos en el movimiento
    NEW.saldo_anterior := v_saldo_anterior;
    NEW.saldo_posterior := v_saldo_nuevo;

    -- Actualizar saldo del cliente
    UPDATE clientes 
    SET saldo_cuenta_corriente = v_saldo_nuevo,
        updated_at = NOW()
    WHERE id = NEW.cliente_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asociar trigger
DROP TRIGGER IF EXISTS trg_actualizar_saldo_cc ON movimientos_cuenta_corriente;
CREATE TRIGGER trg_actualizar_saldo_cc
    BEFORE INSERT ON movimientos_cuenta_corriente
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_saldo_cuenta_corriente();

-- RLS para la tabla
ALTER TABLE movimientos_cuenta_corriente ENABLE ROW LEVEL SECURITY;

-- Política: Los administradores pueden ver todo
CREATE POLICY "Admin puede ver movimientos CC" ON movimientos_cuenta_corriente
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id = auth.uid() 
            AND usuarios.rol IN ('admin', 'tesorero')
        )
    );

-- Política: Los vendedores pueden ver movimientos de sus clientes
CREATE POLICY "Vendedor puede ver movimientos de sus clientes" ON movimientos_cuenta_corriente
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes c
            JOIN usuarios u ON u.id = auth.uid()
            WHERE c.id = movimientos_cuenta_corriente.cliente_id
            AND u.rol = 'vendedor'
        )
    );

COMMENT ON TABLE movimientos_cuenta_corriente IS 
'Movimientos de cuenta corriente de clientes.
- cargo: Aumenta deuda (entrega no pagada)
- abono: Disminuye deuda (pago recibido)
- ajuste: Corrección manual (+/-)';

COMMIT;
