-- ===========================================
-- FIX: Asegurar que la columna turno existe en presupuestos
-- Fecha: 2025-11-30
-- ===========================================

-- Asegurar que la columna turno existe en presupuestos
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS turno VARCHAR(20) CHECK (turno IN ('mañana', 'tarde'));

