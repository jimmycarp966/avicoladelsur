-- ===========================================
-- NUMERACION FACTURAS -> COMPROBANTES (COMP)
-- Fecha: 2026-02-17
-- Objetivo:
--   - Cambiar prefijo de nuevas emisiones de FAC a COMP.
--   - Mantener compatibilidad con historicos FAC.
-- ===========================================

BEGIN;

INSERT INTO numeradores_secuenciales (tipo, contador, prefijo)
VALUES ('factura', 0, 'COMP')
ON CONFLICT (tipo) DO UPDATE
SET prefijo = 'COMP',
    updated_at = NOW();

CREATE OR REPLACE FUNCTION fn_inicializar_contador(
    p_tipo VARCHAR(20)
) RETURNS BIGINT AS $$
DECLARE
    v_max_numero BIGINT := 0;
BEGIN
    CASE p_tipo
        WHEN 'presupuesto' THEN
            SELECT MAX(
                CASE
                    WHEN numero_presupuesto ~ '^PR-[0-9]+$' THEN
                        SUBSTRING(numero_presupuesto FROM 4)::BIGINT
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM presupuestos;

        WHEN 'pedido' THEN
            SELECT MAX(
                CASE
                    WHEN numero_pedido ~ '^PED-[0-9]+$' THEN
                        SUBSTRING(numero_pedido FROM 5)::BIGINT
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM pedidos;

        WHEN 'factura' THEN
            SELECT MAX(
                CASE
                    WHEN numero_factura ~ '^(FAC|COMP)-[0-9]+$' THEN
                        split_part(numero_factura, '-', 2)::BIGINT
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM facturas;

        WHEN 'ruta' THEN
            SELECT MAX(
                CASE
                    WHEN numero_ruta ~ '^RUT-[0-9]+$' THEN
                        SUBSTRING(numero_ruta FROM 5)::BIGINT
                    ELSE 0
                END
            ) INTO v_max_numero
            FROM rutas_reparto;

        ELSE
            RAISE EXCEPTION 'Tipo de numerador invalido: %', p_tipo;
    END CASE;

    UPDATE numeradores_secuenciales
    SET contador = GREATEST(contador, COALESCE(v_max_numero, 0)),
        updated_at = NOW()
    WHERE tipo = p_tipo;

    RETURN COALESCE(v_max_numero, 0);
END;
$$ LANGUAGE plpgsql;

SELECT fn_inicializar_contador('factura');

COMMIT;

