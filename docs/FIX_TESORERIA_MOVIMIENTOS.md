# Fix: Error "tesoreria_movimientos does not exist"

## Problema

Al ejecutar las migraciones de reportes, aparece el error:
```
ERROR: 42P01: relation "tesoreria_movimientos" does not exist
```

## Solución

He actualizado los archivos SQL para que verifiquen si la tabla `tesoreria_movimientos` existe antes de usarla. Los cambios incluyen:

### Archivo: `20251204_reportes_ventas.sql`

1. **Índice condicional:**
   - El índice `idx_tesoreria_movimientos_fecha_metodo` solo se crea si la tabla existe

2. **Función `fn_kpis_ventas`:**
   - La sección de recaudación por método de pago solo se ejecuta si la tabla existe

### Archivo: `20251205_materialized_views_reportes.sql`

1. **Materialized View `mv_recaudacion_por_metodo`:**
   - Solo se crea si la tabla `tesoreria_movimientos` existe

2. **Función `fn_refresh_materialized_views_reportes`:**
   - Verifica si la materialized view existe antes de refrescarla

## Opciones

### Opción 1: Ejecutar migraciones base primero (Recomendado)

La tabla `tesoreria_movimientos` se crea en la migración:
- `supabase/migrations/20251114_hito_intermedio.sql`

Ejecuta primero todas las migraciones base en orden cronológico antes de ejecutar las de reportes.

### Opción 2: Crear la tabla manualmente

Si necesitas ejecutar los reportes sin las migraciones base, puedes crear la tabla manualmente:

```sql
CREATE TABLE IF NOT EXISTS tesoreria_cajas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID,
  nombre VARCHAR(120) NOT NULL,
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_actual NUMERIC(14,2) NOT NULL DEFAULT 0,
  moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tesoreria_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caja_id UUID NOT NULL REFERENCES tesoreria_cajas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
  descripcion TEXT,
  origen_tipo VARCHAR(50),
  origen_id UUID,
  metodo_pago VARCHAR(30) DEFAULT 'efectivo',
  user_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Opción 3: Ejecutar sin la tabla (Funcional pero limitado)

Con los cambios realizados, puedes ejecutar las migraciones de reportes sin la tabla `tesoreria_movimientos`. Los reportes funcionarán pero:

- No mostrarán datos de recaudación por método de pago
- No se creará la materialized view `mv_recaudacion_por_metodo`
- El resto de funcionalidades de reportes funcionará normalmente

## Verificación

Después de ejecutar las migraciones, verifica:

```sql
-- Verificar que las funciones se crearon
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE 'fn_%ventas%';

-- Verificar materialized views (mv_recaudacion_por_metodo puede no existir)
SELECT matviewname 
FROM pg_matviews 
WHERE matviewname LIKE 'mv_%';
```

## Nota

Los reportes funcionarán correctamente incluso sin la tabla `tesoreria_movimientos`, simplemente no mostrarán datos de métodos de pago hasta que la tabla exista.

