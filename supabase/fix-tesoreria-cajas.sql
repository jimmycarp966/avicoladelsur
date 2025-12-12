-- Fix tesoreria_cajas table issue
-- Run this script in Supabase SQL Editor

-- First, check if the table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tesoreria_cajas') THEN
        -- Create the tesoreria_cajas table if it doesn't exist
        CREATE TABLE tesoreria_cajas (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            sucursal_id UUID,
            nombre VARCHAR(120) NOT NULL,
            saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
            saldo_actual NUMERIC(14,2) NOT NULL DEFAULT 0,
            moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create index for better performance
        CREATE INDEX idx_tesoreria_cajas_sucursal ON tesoreria_cajas(sucursal_id);

        -- Enable RLS
        ALTER TABLE tesoreria_cajas ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "admin_tesoreria_cajas" ON tesoreria_cajas FOR ALL USING (
            EXISTS (
                SELECT 1 FROM usuarios
                WHERE usuarios.id = auth.uid()
                AND usuarios.rol IN ('admin', 'vendedor')
                AND usuarios.activo = true
            )
        );

        -- Insert a default caja if none exists
        INSERT INTO tesoreria_cajas (nombre, saldo_inicial, saldo_actual, moneda)
        VALUES ('Caja Principal', 0, 0, 'ARS')
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Table tesoreria_cajas created successfully';
    ELSE
        RAISE NOTICE 'Table tesoreria_cajas already exists';
    END IF;
END $$;

-- Verify the table exists and has data
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename = 'tesoreria_cajas';

-- Check if there are any records
SELECT COUNT(*) as total_cajas FROM tesoreria_cajas;



























































