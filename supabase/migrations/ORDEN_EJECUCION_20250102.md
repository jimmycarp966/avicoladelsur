# Orden de Ejecución de Migraciones - 2025-01-02

## Migraciones a Ejecutar

Estas migraciones implementan el sistema de transferencias automáticas y la corrección de sincronización de cajas.

### Orden de Ejecución (CRÍTICO)

**IMPORTANTE**: Ejecutar en este orden exacto para evitar errores de dependencias.

#### 1. Primero: Corrección de Sincronización de Cajas
```sql
-- Archivo: 20250102_fix_sincronizacion_cajas.sql
```
**Qué hace:**
- Crea funciones para recalcular saldos de cajas desde movimientos
- Corrige automáticamente los saldos desincronizados
- Crea tabla de auditoría para movimientos huérfanos

**Dependencias:** Ninguna (puede ejecutarse primero)

**Ejecutar:**
```bash
# En Supabase SQL Editor o psql
\i supabase/migrations/20250102_fix_sincronizacion_cajas.sql
```

---

#### 2. Segundo: Sistema de Transferencias Automáticas
```sql
-- Archivo: 20250102_transferencias_automaticas.sql
```
**Qué hace:**
- Agrega campos `origen` y `cantidad_sugerida` a transferencias
- Crea función `fn_crear_solicitud_transferencia_automatica`
- Crea función `fn_evaluar_stock_bajo_y_crear_solicitudes`
- Crea función `fn_reservar_stock_solicitud_automatica`
- Crea trigger `trg_evaluar_stock_bajo` en tabla `lotes`
- Actualiza constraint de estados para incluir `solicitud_automatica`

**Dependencias:** 
- Requiere que exista `fn_calcular_turno_fecha_entrega` (de `20251202_transferencias_flujo_presupuestos.sql`)
- Requiere tabla `transferencias_stock` (de `20251130_transferencias_sucursales.sql`)

**Ejecutar:**
```bash
\i supabase/migrations/20250102_transferencias_automaticas.sql
```

---

#### 3. Tercero: Generación de Pedidos desde Transferencias
```sql
-- Archivo: 20250102_pedidos_desde_transferencias.sql
```
**Qué hace:**
- Agrega campo `transferencia_id` a tabla `pedidos`
- Crea función `fn_crear_pedido_desde_transferencia`
- Crea trigger `trg_crear_pedido_transferencia` que genera pedidos automáticamente

**Dependencias:**
- Requiere tabla `transferencias_stock` (de migraciones anteriores)
- Requiere tabla `pedidos` (de migraciones anteriores)

**Ejecutar:**
```bash
\i supabase/migrations/20250102_pedidos_desde_transferencias.sql
```

---

#### 4. Cuarto: Integración Completa con Presupuestos
```sql
-- Archivo: 20250102_integrar_transferencias_automaticas_presupuestos.sql
```
**Qué hace:**
- Actualiza constraint de estados para incluir todos los estados necesarios
- Asegura compatibilidad entre flujo antiguo y nuevo

**Dependencias:**
- Requiere que las migraciones anteriores estén ejecutadas

**Ejecutar:**
```bash
\i supabase/migrations/20250102_integrar_transferencias_automaticas_presupuestos.sql
```

---

## Verificación Post-Ejecución

Después de ejecutar todas las migraciones, ejecutar estos scripts de verificación:

### 1. Verificar Sincronización de Cajas
```sql
\i supabase/verificar_sincronizacion_cajas.sql
```

### 2. Corregir Cajas Desincronizadas (si es necesario)
```sql
SELECT fn_corregir_sincronizacion_cajas();
```

### 3. Probar Transferencias Automáticas
```sql
\i supabase/test_transferencias_automaticas.sql
```

---

## Resumen Rápido

```bash
# Orden de ejecución:
1. 20250102_fix_sincronizacion_cajas.sql
2. 20250102_transferencias_automaticas.sql
3. 20250102_pedidos_desde_transferencias.sql
4. 20250102_integrar_transferencias_automaticas_presupuestos.sql

# Verificación:
- supabase/verificar_sincronizacion_cajas.sql
- SELECT fn_corregir_sincronizacion_cajas();
- supabase/test_transferencias_automaticas.sql
```

---

## Notas Importantes

1. **Las migraciones usan `BEGIN;` y `COMMIT;`** - Si alguna falla, se hace rollback automático
2. **El trigger se activa inmediatamente** - Después de ejecutar `20250102_transferencias_automaticas.sql`, el sistema comenzará a detectar stock bajo automáticamente
3. **Las solicitudes automáticas requieren aprobación** - Aparecerán en `/sucursales/transferencias/solicitudes`
4. **Las transferencias aprobadas aparecen en "Presupuestos del Día"** - Con estado `en_almacen`

---

## Si Algo Sale Mal

Si alguna migración falla:

1. Revisar el mensaje de error
2. Verificar que las migraciones anteriores estén ejecutadas
3. Verificar que las tablas y funciones requeridas existan:
   ```sql
   -- Verificar funciones requeridas
   SELECT proname FROM pg_proc WHERE proname IN (
       'fn_calcular_turno_fecha_entrega',
       'fn_crear_transferencia_stock',
       'fn_preparar_transferencia'
   );
   
   -- Verificar tablas
   SELECT tablename FROM pg_tables WHERE tablename IN (
       'transferencias_stock',
       'transferencia_items',
       'pedidos',
       'tesoreria_cajas'
   );
   ```

