-- ===========================================
-- FIX: Corregir fecha de conteos y validar múltiples conteos en proceso
-- Fecha: 2025-01-16
-- Problemas:
--   1. fecha_conteo usa CURRENT_DATE (UTC) en lugar de fecha Argentina
--   2. No hay validación para evitar múltiples conteos en proceso
-- Solución:
--   1. Usar fn_today_argentina() para la fecha
--   2. Validar que no exista un conteo en proceso antes de crear uno nuevo
-- ===========================================

CREATE OR REPLACE FUNCTION fn_iniciar_conteo_stock(
    p_sucursal_id UUID,
    p_usuario_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_conteo_id UUID;
    v_producto RECORD;
    v_stock_teorico DECIMAL(10,3);
    v_costo_promedio DECIMAL(10,2);
    v_conteo_existente UUID;
BEGIN
    -- Validar que no haya un conteo en proceso para esta sucursal
    SELECT id INTO v_conteo_existente
    FROM conteos_stock
    WHERE sucursal_id = p_sucursal_id
      AND estado = 'en_proceso'
    LIMIT 1;

    IF v_conteo_existente IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Ya existe un conteo en proceso para esta sucursal. Complétalo o cancélalo antes de iniciar uno nuevo.',
            'conteo_id_existente', v_conteo_existente
        );
    END IF;

    -- Crear registro de conteo usando fecha de Argentina
    INSERT INTO conteos_stock (
        sucursal_id,
        fecha_conteo,
        estado,
        realizado_por
    ) VALUES (
        p_sucursal_id,
        fn_today_argentina(), -- Usar función helper para fecha de Argentina
        'en_proceso',
        p_usuario_id
    ) RETURNING id INTO v_conteo_id;

    -- Crear items para cada producto con stock en la sucursal
    FOR v_producto IN
        SELECT DISTINCT p.id, p.nombre
        FROM productos p
        INNER JOIN lotes l ON l.producto_id = p.id
        WHERE l.sucursal_id = p_sucursal_id
          AND l.cantidad_disponible > 0
          AND p.activo = true
    LOOP
        -- Calcular stock teórico
        SELECT COALESCE(SUM(cantidad_disponible), 0)
        INTO v_stock_teorico
        FROM lotes
        WHERE producto_id = v_producto.id
          AND sucursal_id = p_sucursal_id
          AND estado = 'disponible';

        -- Obtener costo promedio
        v_costo_promedio := fn_obtener_costo_promedio_sucursal(p_sucursal_id, v_producto.id);

        -- Insertar item de conteo
        INSERT INTO conteo_stock_items (
            conteo_id,
            producto_id,
            cantidad_teorica,
            costo_unitario_promedio
        ) VALUES (
            v_conteo_id,
            v_producto.id,
            v_stock_teorico,
            v_costo_promedio
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'conteo_id', v_conteo_id,
        'mensaje', 'Conteo iniciado correctamente'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar también la definición de la tabla para que el default use la función
-- (Aunque la función ya lo maneja, esto asegura consistencia)
ALTER TABLE conteos_stock ALTER COLUMN fecha_conteo SET DEFAULT fn_today_argentina();

-- Comentario
COMMENT ON FUNCTION fn_iniciar_conteo_stock(UUID, UUID) IS 'Inicia un nuevo conteo de stock. Valida que no exista un conteo en proceso y usa fecha de Argentina (GMT-3)';

