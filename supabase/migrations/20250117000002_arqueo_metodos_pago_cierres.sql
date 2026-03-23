-- ===========================================
-- Agregar arqueo por métodos de pago a cierres_caja
-- Fecha: 17/01/2025
-- Objetivo: Permitir registrar arqueo por métodos de pago al cerrar caja
-- ===========================================

BEGIN;

-- Crear tabla cierres_caja si no existe (solo si tesoreria_cajas existe)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_cajas') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cierres_caja') THEN
            CREATE TABLE cierres_caja (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                caja_id UUID NOT NULL REFERENCES tesoreria_cajas(id),
                fecha DATE NOT NULL,
                saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
                saldo_final NUMERIC(14,2),
                total_ingresos NUMERIC(14,2) DEFAULT 0,
                total_egresos NUMERIC(14,2) DEFAULT 0,
                cobranzas_cuenta_corriente NUMERIC(14,2) DEFAULT 0,
                gastos NUMERIC(14,2) DEFAULT 0,
                retiro_tesoro NUMERIC(14,2) DEFAULT 0,
                estado VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(caja_id, fecha)
            );

            -- Crear índices
            CREATE INDEX IF NOT EXISTS idx_cierres_caja_caja_fecha ON cierres_caja(caja_id, fecha);
            CREATE INDEX IF NOT EXISTS idx_cierres_caja_estado ON cierres_caja(estado);
            
            -- Habilitar RLS
            ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;
        END IF;
    END IF;
END $$;

-- Agregar columnas de arqueo por métodos de pago si no existen (solo si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cierres_caja') THEN
        -- Agregar columnas si no existen
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cierres_caja' AND column_name = 'arqueo_efectivo') THEN
            ALTER TABLE cierres_caja ADD COLUMN arqueo_efectivo NUMERIC(14,2) DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cierres_caja' AND column_name = 'arqueo_transferencia') THEN
            ALTER TABLE cierres_caja ADD COLUMN arqueo_transferencia NUMERIC(14,2) DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cierres_caja' AND column_name = 'arqueo_tarjeta') THEN
            ALTER TABLE cierres_caja ADD COLUMN arqueo_tarjeta NUMERIC(14,2) DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cierres_caja' AND column_name = 'arqueo_qr') THEN
            ALTER TABLE cierres_caja ADD COLUMN arqueo_qr NUMERIC(14,2) DEFAULT 0;
        END IF;

        -- Actualizar cierres existentes para que tengan valores por defecto
        UPDATE cierres_caja 
        SET 
            arqueo_efectivo = COALESCE(arqueo_efectivo, 0),
            arqueo_transferencia = COALESCE(arqueo_transferencia, 0),
            arqueo_tarjeta = COALESCE(arqueo_tarjeta, 0),
            arqueo_qr = COALESCE(arqueo_qr, 0)
        WHERE arqueo_efectivo IS NULL 
           OR arqueo_transferencia IS NULL 
           OR arqueo_tarjeta IS NULL 
           OR arqueo_qr IS NULL;

        -- Agregar comentarios
        COMMENT ON COLUMN cierres_caja.arqueo_efectivo IS 'Monto en efectivo contado físicamente al cerrar la caja';
        COMMENT ON COLUMN cierres_caja.arqueo_transferencia IS 'Monto en transferencias contado físicamente al cerrar la caja';
        COMMENT ON COLUMN cierres_caja.arqueo_tarjeta IS 'Monto en tarjeta contado físicamente al cerrar la caja';
        COMMENT ON COLUMN cierres_caja.arqueo_qr IS 'Monto en QR/Mercado Pago contado físicamente al cerrar la caja';
    END IF;
END $$;

COMMIT;

