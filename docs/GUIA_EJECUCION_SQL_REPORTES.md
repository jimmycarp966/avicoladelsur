# Guía de Ejecución SQL - Módulo de Reportes

## Archivos SQL a Ejecutar

Se crearon **2 archivos de migración** para el módulo de reportes que deben ejecutarse en el siguiente orden:

### 1. Primero: Funciones RPC e Índices
**Archivo:** `supabase/migrations/20251204_reportes_ventas.sql`

**Contenido:**
- Índices para optimización de consultas
- Funciones RPC para cálculos de reportes de ventas:
  - `fn_kpis_ventas()` - KPIs principales
  - `fn_ventas_por_periodo()` - Agrupación por día/semana/mes
  - `fn_ventas_por_zona()` - Ventas por zona
  - `fn_top_productos()` - Ranking de productos
  - `fn_top_vendedores()` - Ranking de vendedores
  - `fn_ventas_por_metodo_pago()` - Desglose por método de pago
  - `fn_heatmap_ventas()` - Datos para heatmap
  - `fn_clientes_nuevos_recurrentes()` - Análisis de clientes

### 2. Segundo: Materialized Views
**Archivo:** `supabase/migrations/20251205_materialized_views_reportes.sql`

**Contenido:**
- Materialized views para optimización:
  - `mv_kpis_ventas_diarias` - KPIs de ventas por día
  - `mv_stock_critico` - Productos con stock crítico
  - `mv_rotacion_inventario` - Rotación por categoría
  - `mv_eficiencia_reparto` - Eficiencia de reparto
  - `mv_recaudacion_por_metodo` - Recaudación por método
- Función `fn_refresh_materialized_views_reportes()` para refrescar todas las vistas

---

## Métodos de Ejecución

### Opción 1: Supabase CLI (Recomendado)

Si usas Supabase CLI, las migraciones se ejecutan automáticamente:

```bash
# Asegúrate de estar en el directorio del proyecto
cd "D:\Daniel\Paginas\Clientes\Avicola del Sur"

# Aplicar migraciones pendientes
supabase db push

# O si prefieres ejecutar manualmente
supabase migration up
```

### Opción 2: Supabase Dashboard (SQL Editor)

1. **Ir al SQL Editor en Supabase Dashboard:**
   - Abre tu proyecto en https://supabase.com/dashboard
   - Ve a **SQL Editor** en el menú lateral

2. **Ejecutar primera migración:**
   - Abre el archivo `supabase/migrations/20251204_reportes_ventas.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **Run** o presiona `Ctrl+Enter`
   - Verifica que no haya errores

3. **Ejecutar segunda migración:**
   - Abre el archivo `supabase/migrations/20251205_materialized_views_reportes.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **Run** o presiona `Ctrl+Enter`
   - Verifica que no haya errores

### Opción 3: psql (Línea de comandos)

```bash
# Conectar a tu base de datos Supabase
psql "postgresql://postgres:[TU_PASSWORD]@[TU_HOST]:5432/postgres"

# Ejecutar primera migración
\i supabase/migrations/20251204_reportes_ventas.sql

# Ejecutar segunda migración
\i supabase/migrations/20251205_materialized_views_reportes.sql
```

### Opción 4: Desde tu aplicación (Next.js)

Si tienes un script de migración en tu proyecto:

```bash
npm run migrate
# o
yarn migrate
```

---

## Verificación Post-Ejecución

Después de ejecutar ambos archivos, verifica que todo esté correcto:

### 1. Verificar Funciones RPC

```sql
-- Verificar que las funciones existen
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE 'fn_%'
    AND routine_name LIKE '%ventas%'
ORDER BY routine_name;
```

Deberías ver:
- `fn_kpis_ventas`
- `fn_ventas_por_periodo`
- `fn_ventas_por_zona`
- `fn_top_productos`
- `fn_top_vendedores`
- `fn_ventas_por_metodo_pago`
- `fn_heatmap_ventas`
- `fn_clientes_nuevos_recurrentes`

### 2. Verificar Materialized Views

```sql
-- Verificar que las materialized views existen
SELECT 
    schemaname,
    matviewname
FROM pg_matviews
WHERE schemaname = 'public'
    AND matviewname LIKE 'mv_%'
ORDER BY matviewname;
```

Deberías ver:
- `mv_kpis_ventas_diarias`
- `mv_stock_critico`
- `mv_rotacion_inventario`
- `mv_eficiencia_reparto`
- `mv_recaudacion_por_metodo`

### 3. Verificar Índices

```sql
-- Verificar índices creados
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    AND (
        indexname LIKE '%pedidos%' OR
        indexname LIKE '%tesoreria%' OR
        indexname LIKE '%presupuestos%'
    )
ORDER BY indexname;
```

### 4. Probar una Función RPC

```sql
-- Probar función de KPIs de ventas
SELECT * FROM fn_kpis_ventas(
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE,
    NULL,
    NULL,
    NULL
);
```

### 5. Refrescar Materialized Views

```sql
-- Refrescar todas las materialized views
SELECT fn_refresh_materialized_views_reportes();
```

---

## Notas Importantes

1. **Orden de ejecución:** Es importante ejecutar primero `20251204_reportes_ventas.sql` y luego `20251205_materialized_views_reportes.sql`

2. **Materialized Views:** Las materialized views necesitan ser refrescadas periódicamente. Puedes:
   - Ejecutar manualmente: `SELECT fn_refresh_materialized_views_reportes();`
   - Configurar un cron job en Supabase para refrescarlas automáticamente

3. **Performance:** Los índices y materialized views mejorarán significativamente el rendimiento de los reportes, especialmente con grandes volúmenes de datos.

4. **Errores comunes:**
   - Si ves errores de "ya existe", es normal si ya ejecutaste las migraciones antes
   - Los `IF NOT EXISTS` en los scripts previenen errores por duplicados
   - Si hay errores de permisos, verifica que el usuario tenga permisos para crear funciones y vistas

---

## Refrescar Materialized Views Automáticamente

Para configurar refresco automático de las materialized views, puedes usar pg_cron en Supabase:

```sql
-- Refrescar cada hora
SELECT cron.schedule(
    'refresh-reportes-views',
    '0 * * * *', -- Cada hora
    $$SELECT fn_refresh_materialized_views_reportes()$$
);

-- Refrescar cada 15 minutos (solo stock crítico)
SELECT cron.schedule(
    'refresh-stock-critico',
    '*/15 * * * *', -- Cada 15 minutos
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_critico$$
);
```

**Nota:** pg_cron requiere habilitación en Supabase. Verifica si está disponible en tu plan.

---

## Soporte

Si encuentras errores al ejecutar las migraciones, verifica:
1. Que las tablas base existan (pedidos, productos, clientes, etc.)
2. Que tengas permisos suficientes
3. Que no haya conflictos con migraciones anteriores

