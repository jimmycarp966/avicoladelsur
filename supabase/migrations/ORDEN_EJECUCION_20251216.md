# Orden de Ejecución de Migraciones - Optimizaciones 16/12/2025

## Orden Recomendado

Ejecuta las migraciones en este orden para evitar dependencias:

### 1. Primero: Índices (No tienen dependencias)
```sql
20251216_optimizacion_indices.sql
```
**Razón**: Solo crea índices, no modifica datos ni funciones. Puede ejecutarse en cualquier momento.

---

### 2. Segundo: Mejoras de Estructura (Agregan columnas)
```sql
20251216_mejoras_alertas_stock.sql
```
**Razón**: Agrega columna `prioridad` a `alertas_stock` y actualiza datos existentes. Debe ejecutarse antes de que las funciones la usen.

---

### 3. Tercero: Funciones RPC Optimizadas (Queries)
```sql
20251216_optimizacion_queries_cliente_pedido.sql
```
**Razón**: Crea funciones RPC para optimizar queries de cliente y pedido. No depende de otras migraciones nuevas.

---

### 4. Cuarto: Funciones RPC de Negocio (Presupuestos)
```sql
20251216_optimizacion_presupuestos.sql
```
**Razón**: Crea funciones para validación batch y conversión masiva de presupuestos. Usa funciones existentes como `fn_convertir_presupuesto_a_pedido()`.

---

### 5. Quinto: Funciones RPC de Transferencias
```sql
20251216_optimizacion_transferencias.sql
```
**Razón**: Crea funciones para transferencias entre sucursales. Usa funciones existentes como `fn_aprobar_transferencia()`.

---

### 6. Sexto: Funciones RPC de Validación
```sql
20251216_optimizacion_validacion_cobros.sql
```
**Razón**: Crea función para validación masiva de cobros. No depende de otras migraciones nuevas.

---

### 7. Séptimo: Funciones RPC de Rutas
```sql
20251216_optimizacion_rutas.sql
```
**Razón**: Crea función para validación batch de capacidad de rutas. No depende de otras migraciones nuevas.

---

### 8. Octavo: Materialized Views
```sql
20251216_materialized_views_reportes.sql
```
**Razón**: Crea vistas materializadas para reportes. Puede ejecutarse en cualquier momento, pero mejor después de los índices.

---

### 9. Último: Activación de Jobs (pg_cron)
```sql
20251216_activar_expirar_reservas.sql
```
**Razón**: Intenta activar job de pg_cron. Debe ejecutarse al final porque depende de que `fn_expirar_reservas()` ya exista (de migraciones anteriores).

---

## Resumen del Orden

```
1. 20251216_optimizacion_indices.sql
2. 20251216_mejoras_alertas_stock.sql
3. 20251216_optimizacion_queries_cliente_pedido.sql
4. 20251216_optimizacion_presupuestos.sql
5. 20251216_optimizacion_transferencias.sql
6. 20251216_optimizacion_validacion_cobros.sql
7. 20251216_optimizacion_rutas.sql
8. 20251216_materialized_views_reportes.sql
9. 20251216_activar_expirar_reservas.sql
```

## Notas Importantes

- **Todas las migraciones son idempotentes**: Usan `IF NOT EXISTS` y `CREATE OR REPLACE`, por lo que puedes ejecutarlas múltiples veces sin problemas.

- **Si falla alguna**: Las migraciones están dentro de `BEGIN; ... COMMIT;`, así que si una falla, se revierte toda la transacción.

- **pg_cron**: La última migración intenta activar pg_cron. Si no está disponible en tu instancia de Supabase, simplemente mostrará un NOTICE y continuará. Puedes crear un endpoint API alternativo para ejecutar `fn_expirar_reservas()` periódicamente.

## Cómo Ejecutar

### Opción 1: Supabase Dashboard (Recomendado)
1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Copia y pega el contenido de cada migración en orden
4. Ejecuta cada una

### Opción 2: Supabase CLI
```bash
# Si tienes Supabase CLI configurado
supabase db push
```

### Opción 3: psql directo
```bash
# Si tienes acceso directo a la base de datos
psql -h [host] -U [user] -d [database] -f supabase/migrations/20251216_optimizacion_indices.sql
# ... y así sucesivamente para cada archivo
```

## Verificación Post-Migración

Después de ejecutar todas las migraciones, verifica que todo esté correcto:

```sql
-- Verificar que los índices se crearon
SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%' AND schemaname = 'public' ORDER BY indexname;

-- Verificar que las funciones RPC existen
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'fn_%'
ORDER BY routine_name;

-- Verificar que la columna prioridad existe en alertas_stock
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'alertas_stock' AND column_name = 'prioridad';

-- Verificar materialized views
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';
```

