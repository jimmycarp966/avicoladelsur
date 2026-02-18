-- Cambios integrales Tesoreria + Reparto
-- Fecha: 2026-02-18

-- =========================
-- VEHICULOS
-- =========================
ALTER TABLE IF EXISTS vehiculos
  ADD COLUMN IF NOT EXISTS fecha_vto_senasa DATE,
  ADD COLUMN IF NOT EXISTS fecha_vto_vtv DATE,
  ADD COLUMN IF NOT EXISTS km_inicial INTEGER,
  ADD COLUMN IF NOT EXISTS capacidad_tanque_litros NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS combustible_actual_litros NUMERIC(8,2);

-- =========================
-- CHECKLISTS VEHICULOS
-- =========================
ALTER TABLE IF EXISTS checklists_vehiculos
  ADD COLUMN IF NOT EXISTS aceite_motor_porcentaje INTEGER,
  ADD COLUMN IF NOT EXISTS limpieza_interior_estado TEXT,
  ADD COLUMN IF NOT EXISTS limpieza_exterior_estado TEXT,
  ADD COLUMN IF NOT EXISTS luces_observacion TEXT,
  ADD COLUMN IF NOT EXISTS presion_neumaticos_psi NUMERIC(6,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_checklists_aceite_motor_porcentaje'
  ) THEN
    ALTER TABLE checklists_vehiculos
      ADD CONSTRAINT chk_checklists_aceite_motor_porcentaje
      CHECK (
        aceite_motor_porcentaje IS NULL OR (
          aceite_motor_porcentaje >= 0
          AND aceite_motor_porcentaje <= 100
          AND (aceite_motor_porcentaje % 10) = 0
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_checklists_limpieza_interior_estado'
  ) THEN
    ALTER TABLE checklists_vehiculos
      ADD CONSTRAINT chk_checklists_limpieza_interior_estado
      CHECK (
        limpieza_interior_estado IS NULL
        OR limpieza_interior_estado IN ('mala', 'buena', 'excelente')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_checklists_limpieza_exterior_estado'
  ) THEN
    ALTER TABLE checklists_vehiculos
      ADD CONSTRAINT chk_checklists_limpieza_exterior_estado
      CHECK (
        limpieza_exterior_estado IS NULL
        OR limpieza_exterior_estado IN ('mala', 'buena', 'excelente')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_checklists_presion_neumaticos_psi'
  ) THEN
    ALTER TABLE checklists_vehiculos
      ADD CONSTRAINT chk_checklists_presion_neumaticos_psi
      CHECK (
        presion_neumaticos_psi IS NULL
        OR (presion_neumaticos_psi >= 0 AND presion_neumaticos_psi <= 200)
      );
  END IF;
END $$;

-- =========================
-- RUTAS REPARTO
-- =========================
ALTER TABLE IF EXISTS rutas_reparto
  ADD COLUMN IF NOT EXISTS km_inicio_ruta INTEGER,
  ADD COLUMN IF NOT EXISTS km_fin_ruta INTEGER,
  ADD COLUMN IF NOT EXISTS km_recorridos INTEGER,
  ADD COLUMN IF NOT EXISTS carga_combustible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS litros_cargados NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS consumo_km_l NUMERIC(10,3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_rutas_reparto_km_orden'
  ) THEN
    ALTER TABLE rutas_reparto
      ADD CONSTRAINT chk_rutas_reparto_km_orden
      CHECK (
        km_inicio_ruta IS NULL
        OR km_fin_ruta IS NULL
        OR km_fin_ruta >= km_inicio_ruta
      );
  END IF;
END $$;

-- =========================
-- CLIENTES RECORDATORIOS
-- =========================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'clientes_recordatorios'
  ) THEN
    ALTER TABLE clientes_recordatorios
      ADD COLUMN IF NOT EXISTS hora_proximo_contacto TIME;

    CREATE INDEX IF NOT EXISTS idx_clientes_recordatorios_promesas_dia
      ON clientes_recordatorios (fecha_proximo_contacto, hora_proximo_contacto, estado);
  END IF;
END $$;
