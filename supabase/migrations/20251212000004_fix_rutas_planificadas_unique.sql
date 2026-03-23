-- Agregar constraint UNIQUE en ruta_reparto_id para poder usar ON CONFLICT
-- Esto permite hacer upsert en rutas_planificadas

-- Primero verificar si ya existe el constraint
DO $$
BEGIN
    -- Verificar si existe el constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rutas_planificadas_ruta_reparto_id_key'
    ) THEN
        -- Agregar constraint UNIQUE
        ALTER TABLE rutas_planificadas
        ADD CONSTRAINT rutas_planificadas_ruta_reparto_id_key UNIQUE (ruta_reparto_id);
        
        RAISE NOTICE 'Constraint rutas_planificadas_ruta_reparto_id_key creado';
    ELSE
        RAISE NOTICE 'Constraint rutas_planificadas_ruta_reparto_id_key ya existe';
    END IF;
END
$$;
