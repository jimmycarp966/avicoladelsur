-- =========================================
-- FIX: corregir nombres de tablas en control de stock por turnos
-- Error visto al iniciar un conteo: relation "ordenes_produccion_salidas" does not exist
-- La función fn_verificar_produccion_en_curso quedó apuntando a tablas inexistentes
-- después del refactor a orden_produccion_salidas / orden_produccion_entradas.
-- =========================================

CREATE OR REPLACE FUNCTION fn_verificar_produccion_en_curso()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ordenes JSON;
    v_cantidad INTEGER;
    v_cajones INTEGER;
BEGIN
    SELECT
        json_agg(id),
        COUNT(*)::integer,
        COALESCE(SUM(
            CASE
                WHEN estado = 'en_proceso' THEN
                    GREATEST(
                        0,
                        (
                            SELECT COALESCE(SUM(cantidad), 0)
                            FROM orden_produccion_salidas
                            WHERE orden_id = op.id
                        ) -
                        (
                            SELECT COALESCE(SUM(cantidad), 0)
                            FROM orden_produccion_entradas
                            WHERE orden_id = op.id
                        )
                    )
                ELSE 0
            END
        ), 0)::integer
    INTO v_ordenes, v_cantidad, v_cajones
    FROM ordenes_produccion op
    WHERE op.estado = 'en_proceso';

    RETURN json_build_object(
        'en_curso', v_cantidad > 0,
        'ordenes_ids', COALESCE(v_ordenes, '[]'::json),
        'cantidad_ordenes', COALESCE(v_cantidad, 0),
        'cajones_faltantes', COALESCE(v_cajones, 0)
    );
END;
$$;
