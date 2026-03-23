-- ===========================================
-- MIGRACIÓN: Calcular Peso Total de Rutas Automáticamente
-- Fecha: 18/12/2025
-- Objetivo: Crear función y trigger para calcular peso_total_kg de rutas automáticamente
--           desde los pedidos asignados en detalles_ruta
-- ===========================================

BEGIN;

-- ===========================================
-- FUNCIÓN: fn_recalcular_peso_ruta
-- Calcula el peso total de una ruta sumando los pesos de los pedidos asignados
-- ===========================================

CREATE OR REPLACE FUNCTION fn_recalcular_peso_ruta(p_ruta_id UUID)
RETURNS DECIMAL(10,3) AS $$
DECLARE
    v_peso_total DECIMAL(10,3) := 0;
BEGIN
    -- Calcular peso total sumando los pesos de los pedidos asignados
    -- El peso de un pedido se calcula desde detalles_pedido:
    -- - Si tiene peso_final, usar peso_final
    -- - Si no tiene peso_final, usar cantidad
    SELECT COALESCE(SUM(
        CASE
            WHEN dp.peso_final IS NOT NULL THEN dp.peso_final
            ELSE dp.cantidad
        END
    ), 0)
    INTO v_peso_total
    FROM detalles_ruta dr
    JOIN pedidos p ON p.id = dr.pedido_id
    JOIN detalles_pedido dp ON dp.pedido_id = p.id
    WHERE dr.ruta_id = p_ruta_id;

    -- Actualizar peso total en la ruta
    UPDATE rutas_reparto
    SET peso_total_kg = v_peso_total,
        updated_at = NOW()
    WHERE id = p_ruta_id;

    RETURN v_peso_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIÓN TRIGGER: fn_recalcular_peso_ruta_trigger
-- Se ejecuta cuando se inserta/actualiza/elimina en detalles_ruta
-- ===========================================

CREATE OR REPLACE FUNCTION fn_recalcular_peso_ruta_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_ruta_id UUID;
BEGIN
    -- Obtener el ruta_id del registro afectado
    v_ruta_id := COALESCE(NEW.ruta_id, OLD.ruta_id);

    -- Recalcular peso de la ruta
    IF v_ruta_id IS NOT NULL THEN
        PERFORM fn_recalcular_peso_ruta(v_ruta_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER: Recalcular peso al modificar detalles_ruta
-- ===========================================

DROP TRIGGER IF EXISTS trg_recalcular_peso_ruta ON detalles_ruta;
CREATE TRIGGER trg_recalcular_peso_ruta
AFTER INSERT OR UPDATE OR DELETE ON detalles_ruta
FOR EACH ROW EXECUTE FUNCTION fn_recalcular_peso_ruta_trigger();

-- ===========================================
-- ACTUALIZAR PESO DE RUTAS EXISTENTES
-- ===========================================

DO $$
DECLARE
    v_ruta RECORD;
BEGIN
    FOR v_ruta IN
        SELECT id FROM rutas_reparto
    LOOP
        PERFORM fn_recalcular_peso_ruta(v_ruta.id);
    END LOOP;
END $$;

-- ===========================================
-- COMENTARIOS
-- ===========================================

COMMENT ON FUNCTION fn_recalcular_peso_ruta(UUID) IS 'Calcula y actualiza el peso total de una ruta sumando los pesos de los pedidos asignados';
COMMENT ON FUNCTION fn_recalcular_peso_ruta_trigger() IS 'Trigger que recalcula el peso de la ruta cuando se modifica detalles_ruta';
COMMENT ON TRIGGER trg_recalcular_peso_ruta ON detalles_ruta IS 'Recalcula automáticamente el peso_total_kg de la ruta al asignar/remover pedidos';

COMMIT;

