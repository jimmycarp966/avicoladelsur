# 🔄 Configuración de Supabase Realtime

Esta guía explica cómo habilitar Supabase Realtime para las tablas que requieren actualizaciones en tiempo real en el sistema ERP de Avícola del Sur.

## ⚠️ IMPORTANTE: Realtime vs Replication

**NO confundir estas dos funcionalidades**:

- **Replication** (pantalla que ves): Replica datos a destinos externos como BigQuery, Iceberg, etc. (NO es lo que necesitamos)
- **Realtime**: Actualizaciones en tiempo real dentro de Supabase usando WebSockets (ESTO es lo que necesitamos)

Para habilitar Realtime, **NO uses la pantalla de Replication**. En su lugar, usa el **SQL Editor** como se explica abajo.

## 📋 Tablas que Requieren Realtime

Las siguientes tablas han sido configuradas para usar Realtime:

1. **`ubicaciones_repartidores`** - Tracking GPS en tiempo real
2. **`presupuestos`** - Actualizaciones en vista de almacén
3. **`presupuesto_items`** - Cambios en pesaje
4. **`pedidos`** - Nuevos pedidos y cambios de estado
5. **`entregas`** - Estado de entregas en rutas
6. **`rutas_reparto`** - Estado de rutas
7. **`detalles_ruta`** - Progreso de entregas
8. **`alertas_stock`** - Nuevas alertas de stock
9. **`tesoreria_movimientos`** - Movimientos de caja
10. **`tesoreria_cajas`** - Cambios en saldo de caja
11. **`transferencias_stock`** - Estado de transferencias entre sucursales
12. **`notificaciones`** - Notificaciones del sistema (ya configurado)

## 🚀 Pasos para Habilitar Realtime

### ✅ Método Recomendado: SQL Editor (Más Fácil y Confiable)

**⚠️ La pantalla de "Replication" que ves es para replicar datos a BigQuery/Iceberg. Para Realtime, usa SQL Editor.**

1. **Abrir SQL Editor en Supabase**:
   - En Supabase Dashboard, ve a **SQL Editor** (menú lateral izquierdo, icono de terminal/consola)
   - O usa este enlace directo: `https://supabase.com/dashboard/project/[TU_PROJECT_ID]/sql/new`

2. **Ejecutar el script SQL**:
   - Abre el archivo `supabase/migrations/20250101_habilitar_realtime_tablas.sql` en tu editor
   - Copia TODO el contenido del archivo
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en **"Run"** (botón azul) o presiona `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

3. **Verificar que funcionó**:
   - Debe mostrar mensajes de éxito para cada `ALTER PUBLICATION`
   - Ejecuta esta query para verificar:
   ```sql
   SELECT schemaname, tablename 
   FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   ORDER BY tablename;
   ```
   - Debe mostrar todas las tablas: `alertas_stock`, `entregas`, `pedidos`, `presupuestos`, `tesoreria_cajas`, `tesoreria_movimientos`, `transferencias_stock`, `ubicaciones_repartidores`, etc.

### 🔍 Método Alternativo: Verificar Publicación Existente

Si ya existe la publicación `supabase_realtime`, puedes verificar qué tablas están incluidas:

```sql
-- Ver todas las tablas en la publicación Realtime
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY tablename;
```

Si alguna tabla falta, agrégalas con:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE nombre_de_la_tabla;
```

### 📝 Nota sobre la Pantalla de Replication

La pantalla de **"Replication"** que ves en Supabase Dashboard es para:
- Replicar datos a destinos externos (BigQuery, Iceberg, etc.)
- Crear read replicas de la base de datos
- **NO es para habilitar Realtime**

Para habilitar Realtime, siempre usa el **SQL Editor** con los comandos `ALTER PUBLICATION`.

## 🔐 Verificación de Políticas RLS

Las políticas RLS (Row Level Security) deben estar configuradas para permitir que los usuarios se suscriban a los cambios según su rol.

### Verificar Políticas Existentes

```sql
-- Ver todas las políticas RLS para una tabla específica
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'ubicaciones_repartidores';
```

### Políticas Requeridas

Las siguientes políticas deben existir para que Realtime funcione correctamente:

1. **`ubicaciones_repartidores`**: 
   - Lectura para `admin`, `almacenista`
   - Inserción para `repartidor`

2. **`presupuestos`**: 
   - Lectura para `admin`, `almacenista`, `vendedor`
   - Actualización para `almacenista`, `admin`

3. **`pedidos`**: 
   - Lectura para `admin`, `almacenista`, `vendedor`
   - Actualización según rol

4. **`entregas`**: 
   - Lectura para `admin`, `repartidor`
   - Actualización para `repartidor`, `admin`

5. **`alertas_stock`**: 
   - Lectura para `admin`, `encargado_sucursal`
   - Inserción automática (trigger)

6. **`tesoreria_movimientos`**: 
   - Lectura para `admin`, `tesorero`
   - Inserción para `admin`, `tesorero`

7. **`transferencias_stock`**: 
   - Lectura para `admin`, `encargado_sucursal`
   - Actualización según rol

## 🧪 Pruebas de Realtime

### Prueba 1: Monitor GPS

1. Abrir `/reparto/monitor` en el navegador
2. Desde otra sesión o dispositivo, registrar una nueva ubicación GPS
3. Verificar que la ubicación aparece automáticamente en el monitor sin refresh

### Prueba 2: Dashboard de Sucursal

1. Abrir `/sucursal/dashboard` en el navegador
2. Crear un nuevo pedido desde otra sesión
3. Verificar que las ventas del día se actualizan automáticamente

### Prueba 3: Presupuestos del Día

1. Abrir `/almacen/presupuestos-dia` en el navegador
2. Crear un nuevo presupuesto desde otra sesión
3. Verificar que aparece automáticamente en la lista

### Prueba 4: Alertas de Stock

1. Abrir `/sucursal/alerts` en el navegador
2. Generar una nueva alerta de stock (bajo umbral)
3. Verificar que aparece automáticamente y muestra notificación push si es crítica

## ⚠️ Solución de Problemas

### Realtime no funciona

1. **Verificar que Realtime está habilitado**:
   ```sql
   SELECT schemaname, tablename 
   FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime';
   ```

2. **Verificar políticas RLS**:
   - Asegurarse de que el usuario tiene permisos de lectura en la tabla
   - Verificar que las políticas permiten SELECT

3. **Verificar conexión**:
   - Revisar la consola del navegador para errores
   - Verificar que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` están configuradas

4. **Verificar límites del plan**:
   - Plan gratuito: 2 millones de mensajes/mes
   - Verificar uso en Supabase Dashboard → Settings → Usage

### Errores de permisos

Si ves errores de permisos al suscribirse:

1. Verificar que la tabla tiene políticas RLS habilitadas
2. Verificar que el usuario tiene el rol correcto
3. Verificar que las políticas permiten SELECT para el rol del usuario

### Latencia alta

Si las actualizaciones tardan más de 1 segundo:

1. Verificar la conexión a internet
2. Verificar la región de Supabase (debe estar cerca de los usuarios)
3. Revisar el uso de mensajes Realtime (puede haber límites)

## 📊 Monitoreo de Uso

### Ver uso de Realtime en Supabase Dashboard

1. Ir a **Settings** → **Usage**
2. Buscar la sección **Realtime**
3. Verificar:
   - Mensajes enviados este mes
   - Conexiones simultáneas
   - Límites del plan

### Límites del Plan Gratuito

- ✅ **2 millones de mensajes/mes**: Suficiente para ~66,000 eventos/día
- ✅ **200 conexiones simultáneas**: Suficiente para la mayoría de casos
- ⚠️ **Monitoreo necesario**: Revisar uso mensual para evitar límites

## 🔧 Configuración Avanzada

### Filtrar eventos específicos

Si necesitas filtrar eventos por columnas específicas, puedes usar filtros en las suscripciones:

```typescript
useRealtime({
  table: 'pedidos',
  event: 'INSERT',
  filter: `estado=eq.en_almacen`, // Solo pedidos en almacén
  onInsert: (payload) => {
    // Manejar evento
  }
})
```

### Manejo de reconexión

El hook `useRealtime` maneja automáticamente la reconexión. Si necesitas manejo personalizado:

```typescript
const { unsubscribe } = useRealtime({
  table: 'pedidos',
  event: '*',
  onError: (error) => {
    console.error('Error en Realtime:', error)
    // Lógica de reconexión personalizada
  }
})
```

## 📝 Notas Importantes

1. **RLS es crítico**: Las políticas RLS deben permitir SELECT para que Realtime funcione
2. **Filtros mejoran rendimiento**: Usar filtros específicos reduce mensajes innecesarios
3. **Cleanup adecuado**: Los componentes se desuscriben automáticamente al desmontarse
4. **Fallback a polling**: El código mantiene polling como fallback si Realtime falla

## ✅ Checklist de Verificación

- [ ] Migración SQL ejecutada o tablas habilitadas manualmente
- [ ] Políticas RLS verificadas para todas las tablas
- [ ] Pruebas realizadas en cada módulo con Realtime
- [ ] Notificaciones push funcionando (permisos del navegador)
- [ ] Monitoreo de uso configurado
- [ ] Documentación actualizada

---

**Última actualización**: Enero 2025
**Versión**: 1.0

