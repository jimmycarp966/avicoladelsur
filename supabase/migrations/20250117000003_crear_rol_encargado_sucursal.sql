-- ===========================================
-- Crear Rol "encargado_sucursal" y Migrar Usuarios
-- Fecha: 17/01/2025
-- Objetivo: Separar usuarios de sucursales de vendedores de casa central
-- ===========================================

BEGIN;

-- Comentario sobre el nuevo rol
COMMENT ON COLUMN usuarios.rol IS 'Roles disponibles: admin, vendedor (casa central), encargado_sucursal (sucursales), repartidor, almacenista, tesorero';

-- Migrar automáticamente todos los usuarios que tienen sucursal_id asignado
-- de "vendedor" a "encargado_sucursal"
UPDATE usuarios u
SET rol = 'encargado_sucursal',
    updated_at = NOW()
WHERE u.rol = 'vendedor'
  AND EXISTS (
    SELECT 1 
    FROM rrhh_empleados e 
    WHERE e.usuario_id = u.id 
    AND e.sucursal_id IS NOT NULL
    AND e.activo = true
  );

-- Log de la migración
DO $$
DECLARE
    v_migrados INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_migrados
    FROM usuarios u
    WHERE u.rol = 'encargado_sucursal';
    
    RAISE NOTICE 'Migración completada: % usuarios migrados a rol encargado_sucursal', v_migrados;
END $$;

-- Verificar que no queden usuarios "vendedor" con sucursal asignada
DO $$
DECLARE
    v_pendientes INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_pendientes
    FROM usuarios u
    INNER JOIN rrhh_empleados e ON e.usuario_id = u.id
    WHERE u.rol = 'vendedor'
    AND e.sucursal_id IS NOT NULL
    AND e.activo = true;
    
    IF v_pendientes > 0 THEN
        RAISE WARNING 'Atención: % usuarios con rol vendedor aún tienen sucursal asignada', v_pendientes;
    END IF;
END $$;

COMMIT;

