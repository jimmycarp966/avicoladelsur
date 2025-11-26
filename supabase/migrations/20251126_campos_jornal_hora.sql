-- ===========================================
-- AGREGAR CAMPOS JORNAL, HORA Y NOMBRES A EMPLEADOS
-- Fecha: 2025-11-26
-- ===========================================
-- Agrega campos para almacenar valor jornal con presentismo, valor hora
-- y nombre/apellido (para empleados sin usuario del sistema)

ALTER TABLE rrhh_empleados
ADD COLUMN IF NOT EXISTS nombre VARCHAR(255),
ADD COLUMN IF NOT EXISTS apellido VARCHAR(255),
ADD COLUMN IF NOT EXISTS valor_jornal_presentismo DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS valor_hora DECIMAL(10,2);

-- Comentarios para documentación
COMMENT ON COLUMN rrhh_empleados.nombre IS 'Nombre del empleado (si no tiene usuario_id)';
COMMENT ON COLUMN rrhh_empleados.apellido IS 'Apellido del empleado (si no tiene usuario_id)';
COMMENT ON COLUMN rrhh_empleados.valor_jornal_presentismo IS 'Valor del jornal con presentismo incluido';
COMMENT ON COLUMN rrhh_empleados.valor_hora IS 'Valor de la hora trabajada';

