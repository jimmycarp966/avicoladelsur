-- ===========================================
-- SCRIPT DE IMPORTACIÓN DE EMPLEADOS
-- Fecha: 2025-11-26
-- ===========================================
-- Importa los 22 empleados de la lista al sistema RRHH
-- Todos se asignan a sucursal "Casa Central"
-- Fecha de ingreso: fecha actual
-- Legajos generados automáticamente (EMP001, EMP002, etc.)

-- Obtener ID de sucursal "Casa Central"
DO $$
DECLARE
    v_sucursal_id UUID;
    v_categoria_repartidor UUID;
    v_categoria_tesoreria UUID;
    v_categoria_almacen UUID;
    v_categoria_asistente_suc UUID;
    v_categoria_encargado_suc UUID;
    v_categoria_produccion UUID;
    v_categoria_ventas UUID;
    v_categoria_rrhh UUID;
    v_categoria_limpieza UUID;
    v_categoria_asist_medio_dia UUID;
    v_legajo_counter INTEGER := 1;
    v_empleados_insertados INTEGER := 0;
    v_total_empleados INTEGER;
BEGIN
    -- Verificar que la tabla rrhh_categorias existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rrhh_categorias') THEN
        RAISE EXCEPTION 'La tabla rrhh_categorias no existe. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    -- Verificar que la tabla rrhh_empleados existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rrhh_empleados') THEN
        RAISE EXCEPTION 'La tabla rrhh_empleados no existe. Ejecuta primero la migración 20251203_modulo_rrhh.sql';
    END IF;

    -- Obtener ID de sucursal
    SELECT id INTO v_sucursal_id
    FROM sucursales
    WHERE nombre = 'Casa Central'
    LIMIT 1;

    -- Si no existe, crear sucursal
    IF v_sucursal_id IS NULL THEN
        INSERT INTO sucursales (nombre, direccion, telefono, activo)
        VALUES ('Casa Central', 'Av. Principal 123, Ciudad Central', '011-1234-5678', true)
        RETURNING id INTO v_sucursal_id;
        RAISE NOTICE 'Sucursal "Casa Central" creada con ID: %', v_sucursal_id;
    ELSE
        RAISE NOTICE 'Sucursal "Casa Central" encontrada con ID: %', v_sucursal_id;
    END IF;

    -- Obtener IDs de categorías y verificar que existan
    SELECT id INTO v_categoria_repartidor FROM rrhh_categorias WHERE nombre = 'Repartidor';
    IF v_categoria_repartidor IS NULL THEN
        RAISE EXCEPTION 'Categoría "Repartidor" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_tesoreria FROM rrhh_categorias WHERE nombre = 'Tesoreria';
    IF v_categoria_tesoreria IS NULL THEN
        RAISE EXCEPTION 'Categoría "Tesoreria" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_almacen FROM rrhh_categorias WHERE nombre = 'Almacen';
    IF v_categoria_almacen IS NULL THEN
        RAISE EXCEPTION 'Categoría "Almacen" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_asistente_suc FROM rrhh_categorias WHERE nombre = 'Asistente Sucursal';
    IF v_categoria_asistente_suc IS NULL THEN
        RAISE EXCEPTION 'Categoría "Asistente Sucursal" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_encargado_suc FROM rrhh_categorias WHERE nombre = 'Encargado Sucursal';
    IF v_categoria_encargado_suc IS NULL THEN
        RAISE EXCEPTION 'Categoría "Encargado Sucursal" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_produccion FROM rrhh_categorias WHERE nombre = 'Produccion';
    IF v_categoria_produccion IS NULL THEN
        RAISE EXCEPTION 'Categoría "Produccion" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_ventas FROM rrhh_categorias WHERE nombre = 'Ventas';
    IF v_categoria_ventas IS NULL THEN
        RAISE EXCEPTION 'Categoría "Ventas" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_rrhh FROM rrhh_categorias WHERE nombre = 'RRHH';
    IF v_categoria_rrhh IS NULL THEN
        RAISE EXCEPTION 'Categoría "RRHH" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_limpieza FROM rrhh_categorias WHERE nombre = 'Limpieza';
    IF v_categoria_limpieza IS NULL THEN
        RAISE EXCEPTION 'Categoría "Limpieza" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    SELECT id INTO v_categoria_asist_medio_dia FROM rrhh_categorias WHERE nombre = 'Asist. 1/2 día Sucursal';
    IF v_categoria_asist_medio_dia IS NULL THEN
        RAISE EXCEPTION 'Categoría "Asist. 1/2 día Sucursal" no encontrada. Ejecuta primero la migración 20251126_categorias_empleados.sql';
    END IF;

    RAISE NOTICE 'Todas las categorías encontradas correctamente. Iniciando importación de empleados...';

    -- Eliminar empleados existentes con legajos EMP001-EMP022 (para evitar duplicados)
    DELETE FROM rrhh_empleados 
    WHERE legajo IN (
        'EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006', 'EMP007', 'EMP008', 
        'EMP009', 'EMP010', 'EMP011', 'EMP012', 'EMP013', 'EMP014', 'EMP015', 'EMP016', 
        'EMP017', 'EMP018', 'EMP019', 'EMP020', 'EMP021', 'EMP022'
    );
    
    GET DIAGNOSTICS v_empleados_insertados = ROW_COUNT;
    IF v_empleados_insertados > 0 THEN
        RAISE NOTICE 'Se eliminaron % empleados con legajos duplicados', v_empleados_insertados;
    END IF;
    v_empleados_insertados := 0;

    -- Insertar empleados
    -- Luis Nuñez - Repartidor
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_repartidor, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Luis', 'Nuñez', CURRENT_DATE, 700000.00, 26923.08, NULL, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Rocío Pedraza - Tesoreria
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_tesoreria, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Rocío', 'Pedraza', CURRENT_DATE, 700000.00, 26923.08, 2991.45, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Jorge Ibañez - Almacen
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_almacen, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Jorge', 'Ibañez', CURRENT_DATE, 650000.00, 25000.00, 2777.78, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Angeles Peralta - Asistente Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_asistente_suc, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Angeles', 'Peralta', CURRENT_DATE, 620000.00, 20666.67, 2296.30, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Laura Acuña - Encargado Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_encargado_suc, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Laura', 'Acuña', CURRENT_DATE, 650000.00, 21666.67, 2407.41, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Lucas Solorzano - Almacen
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_almacen, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Lucas', 'Solorzano', CURRENT_DATE, 650000.00, 25000.00, 2777.78, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Lautaro Diaz - Produccion
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_produccion, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Lautaro', 'Diaz', CURRENT_DATE, 600000.00, 23076.92, 2564.10, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Gabriela Medina - Ventas
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_ventas, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Gabriela', 'Medina', CURRENT_DATE, 650000.00, 25000.00, 3125.00, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Irma Zelaya - Encargado Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_encargado_suc, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Irma', 'Zelaya', CURRENT_DATE, 650000.00, 21666.67, 2407.41, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Ignacio Leguizamón - Asist. 1/2 día Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_asist_medio_dia, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Ignacio', 'Leguizamón', CURRENT_DATE, 310000.00, 10333.33, 1148.15, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Claudia Cruz - Asistente Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_asistente_suc, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Claudia', 'Cruz', CURRENT_DATE, 620000.00, 20666.67, 2296.30, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Graciela Villagra - Encargado Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_encargado_suc, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Graciela', 'Villagra', CURRENT_DATE, 650000.00, 21666.67, 2407.41, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Lara Sueldo - Encargado Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_encargado_suc, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Lara', 'Sueldo', CURRENT_DATE, 650000.00, 21666.67, 2407.41, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Adriana Herrera - Asist. 1/2 día Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_asist_medio_dia, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Adriana', 'Herrera', CURRENT_DATE, 310000.00, 10333.33, 1148.15, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Bravo Morales Anahi - RRHH
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_rrhh, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Anahi', 'Bravo Morales', CURRENT_DATE, 900000.00, 39130.43, 4347.83, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Leonardo Segada - Repartidor
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_repartidor, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Leonardo', 'Segada', CURRENT_DATE, 700000.00, 26923.08, NULL, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Raúl Medina - Produccion
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_produccion, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Raúl', 'Medina', CURRENT_DATE, 600000.00, 23076.92, 2564.10, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Alejandra Pavesi - Limpieza
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_limpieza, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Alejandra', 'Pavesi', CURRENT_DATE, 550000.00, 21153.85, 2350.43, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Figueroa Nahuel - Ventas
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_ventas, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Nahuel', 'Figueroa', CURRENT_DATE, 650000.00, 25000.00, 3125.00, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Jose Campos - Repartidor
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_repartidor, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Jose', 'Campos', CURRENT_DATE, 700000.00, 26923.08, NULL, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    -- Vallejo Jose - Asist. 1/2 día Suc.
    INSERT INTO rrhh_empleados (
        sucursal_id, categoria_id, legajo, nombre, apellido, fecha_ingreso,
        sueldo_actual, valor_jornal_presentismo, valor_hora, activo
    ) VALUES (
        v_sucursal_id, v_categoria_asist_medio_dia, 'EMP' || LPAD(v_legajo_counter::text, 3, '0'),
        'Jose', 'Vallejo', CURRENT_DATE, 310000.00, 10333.33, 2296.30, true
    ) ON CONFLICT (legajo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        categoria_id = EXCLUDED.categoria_id,
        sueldo_actual = EXCLUDED.sueldo_actual,
        valor_jornal_presentismo = EXCLUDED.valor_jornal_presentismo,
        valor_hora = EXCLUDED.valor_hora,
        activo = EXCLUDED.activo;
    v_legajo_counter := v_legajo_counter + 1;
    v_empleados_insertados := v_empleados_insertados + 1;

    
    RAISE NOTICE 'Importación completada: % empleados insertados', v_empleados_insertados;
    
    -- Verificar que los empleados se insertaron correctamente
    SELECT COUNT(*) INTO v_total_empleados
    FROM rrhh_empleados
    WHERE sucursal_id = v_sucursal_id
    AND activo = true;
    
    RAISE NOTICE 'Total de empleados activos en la base de datos: %', v_total_empleados;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error durante la importación: %', SQLERRM;
END $$;

