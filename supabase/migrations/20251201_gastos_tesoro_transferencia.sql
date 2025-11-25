-- ===========================================
-- MIGRACIÓN: Gastos con método de pago y sincronización con tesoro
-- Fecha: 01/12/2025
-- Objetivo: Agregar metodo_pago a gastos y sincronizar con tesoro cuando es transferencia
-- ===========================================

BEGIN;

-- Agregar columna metodo_pago a tabla gastos (solo si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gastos') THEN
    -- Agregar columna metodo_pago si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'gastos' AND column_name = 'metodo_pago'
    ) THEN
      ALTER TABLE gastos
      ADD COLUMN metodo_pago VARCHAR(30) DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'transferencia', 'qr', 'tarjeta'));
    END IF;
  END IF;
END $$;

-- Actualizar función fn_registrar_gasto para incluir metodo_pago y registrar en tesoro si es transferencia
-- Solo crear/actualizar la función si la tabla gastos existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gastos') THEN
    -- Crear o reemplazar la función usando EXECUTE
    EXECUTE '
    CREATE OR REPLACE FUNCTION fn_registrar_gasto(
      p_sucursal_id UUID,
      p_categoria_id UUID,
      p_monto NUMERIC,
      p_creado_por UUID,
      p_comprobante_url TEXT DEFAULT NULL,
      p_descripcion TEXT DEFAULT NULL,
      p_fecha DATE DEFAULT CURRENT_DATE,
      p_afectar_caja BOOLEAN DEFAULT false,
      p_caja_id UUID DEFAULT NULL,
      p_metodo_pago VARCHAR(30) DEFAULT ''efectivo''
    ) RETURNS JSONB AS $func$
    DECLARE
      v_gasto_id UUID;
      v_movimiento JSONB;
      v_movimiento_id UUID;
      v_metodo_pago_val VARCHAR(30);
    BEGIN
      v_metodo_pago_val := COALESCE(p_metodo_pago, ''efectivo'');
      
      -- Insertar gasto (manejar caso donde la columna metodo_pago puede no existir aún)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = ''gastos'' AND column_name = ''metodo_pago''
      ) THEN
        INSERT INTO gastos (
          sucursal_id, categoria_id, monto, comprobante_url,
          descripcion, fecha, creado_por, afecta_caja, caja_id, metodo_pago
        ) VALUES (
          p_sucursal_id, p_categoria_id, p_monto, p_comprobante_url,
          p_descripcion, p_fecha, p_creado_por, p_afectar_caja, p_caja_id, v_metodo_pago_val
        ) RETURNING id INTO v_gasto_id;
      ELSE
        -- Si la columna no existe aún, insertar sin ella
        INSERT INTO gastos (
          sucursal_id, categoria_id, monto, comprobante_url,
          descripcion, fecha, creado_por, afecta_caja, caja_id
        ) VALUES (
          p_sucursal_id, p_categoria_id, p_monto, p_comprobante_url,
          p_descripcion, p_fecha, p_creado_por, p_afectar_caja, p_caja_id
        ) RETURNING id INTO v_gasto_id;
      END IF;

      -- Si afecta caja y hay caja_id, crear movimiento de caja
      IF p_afectar_caja AND p_caja_id IS NOT NULL THEN
        v_movimiento := fn_crear_movimiento_caja(
          p_caja_id,
          ''egreso'',
          p_monto,
          COALESCE(p_descripcion, ''Registro de gasto''),
          ''gasto'',
          v_gasto_id,
          p_creado_por,
          v_metodo_pago_val
        );

        IF (v_movimiento->>''success'')::BOOLEAN IS TRUE THEN
          v_movimiento_id := (v_movimiento->>''movimiento_id'')::UUID;
          UPDATE gastos
          SET caja_movimiento_id = v_movimiento_id
          WHERE id = v_gasto_id;
        ELSE
          RAISE EXCEPTION ''No se pudo registrar movimiento de caja para gasto %'', v_gasto_id;
        END IF;
      END IF;

      -- Si el método de pago es transferencia, registrar en tesoro (solo si la tabla existe)
      IF v_metodo_pago_val = ''transferencia'' THEN
        -- Verificar que la tabla tesoro existe antes de insertar
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = ''tesoro'') THEN
          INSERT INTO tesoro (
            tipo,
            monto,
            descripcion,
            origen_tipo,
            origen_id
          ) VALUES (
            ''transferencia'',
            -p_monto, -- Negativo porque es un egreso del tesoro
            COALESCE(p_descripcion, ''Gasto pagado por transferencia''),
            ''gasto'',
            v_gasto_id
          );
        END IF;
      END IF;

      RETURN jsonb_build_object(
        ''success'', true,
        ''gasto_id'', v_gasto_id
      );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    ';
  END IF;
END $$;

COMMIT;

