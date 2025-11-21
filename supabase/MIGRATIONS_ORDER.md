# Orden de Ejecución de Migraciones SQL

## 📋 Resumen

Este documento explica el orden correcto para ejecutar las migraciones SQL del sistema.

---

## ⚠️ IMPORTANTE: Pre-requisitos

**Antes de ejecutar las migraciones, asegúrate de:**

1. ✅ Tener ejecutado `database-schema.sql` (tablas base: productos, clientes, pedidos, usuarios, etc.)
2. ✅ Tener las extensiones habilitadas: `uuid-ossp` y `postgis`
3. ✅ Tener el usuario de servicio configurado correctamente

---

## 📦 Orden de Ejecución (CORRECTO POR DEPENDENCIAS)

### ⚠️ IMPORTANTE: Orden Real vs Cronológico

Aunque los archivos tienen fechas cronológicas, el orden de ejecución debe seguir las **dependencias de tablas**. La tabla `zonas` debe crearse **antes** de que `presupuestos` la referencie.

---

### 1️⃣ **20251114_hito_intermedio.sql** ⭐ BASE FUNDAMENTAL

**¿Qué hace?**
- Crea tablas de tesorería (`tesoreria_cajas`, `tesoreria_movimientos`)
- Crea tablas de gastos (`gastos_categorias`, `gastos`)
- Crea tablas de cuentas corrientes (`cuentas_corrientes`, `cuentas_corrientes_movimientos`)
- Crea funciones RPC para tesorería
- **Dependencias**: Requiere `usuarios`, `productos`, `pedidos` (del schema base)

**Ejecutar primero porque:**
- Es la base para el módulo de tesorería
- Otras migraciones pueden depender de estas tablas/funciones

**Comando:**
```sql
\i supabase/migrations/20251114_hito_intermedio.sql
```

---

### 2️⃣ **20251121_flujo_completo.sql** ⭐ CREA ZONAS (ANTES DE PRESUPUESTOS)

**¿Qué hace?**
- **Crea tabla `zonas`** (si no existe) - **CRÍTICO: debe ejecutarse antes de presupuestos**
- Agrega campos a tablas existentes (`pedidos`, `rutas_reparto`, `presupuestos`)
- Crea tablas nuevas (`zonas_dias`, `tesoro`, `cierres_caja`, `devoluciones`, `recepcion_almacen`)
- Actualiza funciones RPC existentes
- Crea nuevas funciones RPC para el flujo completo
- **Dependencias**: 
  - Requiere `pedidos`, `rutas_reparto`, `checklists_vehiculos`, `tesoreria_cajas` (del schema o migración 1)
  - **NO requiere `presupuestos`** (crea campos con `IF NOT EXISTS`, así que es seguro)

**Ejecutar segundo porque:**
- Crea la tabla `zonas` que es requerida por `presupuestos`
- Agrega campos que pueden ser necesarios antes de crear presupuestos
- Las funciones que modifica se actualizarán después

**Comando:**
```sql
\i supabase/migrations/20251121_flujo_completo.sql
```

---

### 3️⃣ **20251120_hito_presupuestos.sql** ⭐ SISTEMA DE PRESUPUESTOS

**¿Qué hace?**
- Crea tablas de presupuestos (`presupuestos`, `presupuesto_items`, `stock_reservations`)
- Agrega campos a `productos` y `pedidos`
- Crea funciones RPC para presupuestos
- **Dependencias**: 
  - Requiere `clientes`, `productos`, `pedidos`, `usuarios`, `lotes` (del schema base)
  - **Requiere `zonas`** (creada en migración 2) - línea 15: `zona_id UUID REFERENCES zonas(id)`

**Ejecutar tercero porque:**
- Ahora `zonas` ya existe (creada en migración 2)
- Crea la estructura base de presupuestos
- Las funciones se actualizarán después en la migración 4

**Comando:**
```sql
\i supabase/migrations/20251120_hito_presupuestos.sql
```

**Ejecutar porque:**
- Agrega funcionalidades críticas al flujo de presupuestos
- Modifica funciones creadas en migración 2
- Agrega campos necesarios para el flujo completo

**Comando:**
```sql
\i supabase/migrations/20251121_flujo_completo.sql
```

---

### 4️⃣ **20251122_ventas_presupuestos_ajustes.sql** ⭐ AJUSTES FINALES

**¿Qué hace?**
- **Reemplaza** la función `fn_convertir_presupuesto_a_pedido` (mejoras y correcciones)
- Agrega validaciones y lógica mejorada
- **Dependencias**: 
  - Requiere `presupuestos`, `presupuesto_items`, `pedidos` (de migraciones anteriores)
  - Requiere `tesoreria_cajas`, `cuentas_corrientes` (de migración 1)

**Ejecutar cuarto porque:**
- Reemplaza una función creada en migración 3 y modificada en migración 2
- Es una actualización/ajuste final

**Comando:**
```sql
\i supabase/migrations/20251122_ventas_presupuestos_ajustes.sql
```

---

### 5️⃣ **20251123_localidades.sql** ⭐ LOCALIDADES

**¿Qué hace?**
- Crea tabla `localidades` y agrega campo `localidad_id` a `clientes`
- **Dependencias**: 
  - Requiere `zonas` (de migración 2)
  - Requiere `clientes` (del schema base)

**Ejecutar quinto porque:**
- Agrega funcionalidad de localidades que complementa zonas

**Comando:**
```sql
\i supabase/migrations/20251123_localidades.sql
```

---

### 6️⃣ **20251124_rutas_tracking.sql** ⭐ RUTAS OPTIMIZADAS Y TRACKING

**¿Qué hace?**
- Crea tablas: `ubicaciones_repartidores`, `rutas_planificadas`, `alertas_reparto`, `vehiculos_estado`
- Crea funciones RPC: `fn_obtener_ultima_ubicacion_por_vehiculo`, `fn_generar_ruta_local`, `fn_marcar_alerta_desvio`, `fn_marcar_alerta_cliente_saltado`
- Implementa RLS para nuevas tablas
- **Dependencias**: 
  - Requiere `usuarios`, `vehiculos`, `rutas_reparto`, `zonas`, `clientes`, `pedidos` (de migraciones anteriores)
  - Requiere función `crear_notificacion` (de migraciones anteriores)

**Ejecutar último porque:**
- Agrega funcionalidad de tracking y optimización de rutas
- Depende de todas las estructuras base anteriores

**Comando:**
```sql
\i supabase/migrations/20251124_rutas_tracking.sql
```

---

### 7️⃣ **20251125_turnos_auto.sql** ⭐ TURNOS AUTOMÁTICOS

**¿Qué hace?**
- Actualiza `fn_convertir_presupuesto_a_pedido` para asignar turno según hora (<= 06:00 → mañana, > 06:00 → tarde)
- Permite convertir presupuestos sin turno (solo exige zona)
- Invoca automáticamente el flujo de asignación de ruta al crear el pedido

**Dependencias:**
- Requiere tablas `presupuestos`, `pedidos`, `rutas_reparto`

**Comando:**
```sql
\i supabase/migrations/20251125_turnos_auto.sql
```

---

### 8️⃣ **20251125_ruta_assignment.sql** ⭐ ASIGNACIÓN AUTOMÁTICA DE RUTAS

**¿Qué hace?**
- Crea la función `fn_asignar_pedido_a_ruta`
- Busca o crea rutas diarias por fecha/zona/turno
- Inserta el pedido en `detalles_ruta`

**Dependencias:**
- Requiere `rutas_reparto`, `vehiculos`, `usuarios`, `detalles_ruta`

**Comando:**
```sql
\i supabase/migrations/20251125_ruta_assignment.sql
```

---

### 9️⃣ **20251126_plan_rutas_semanal.sql** ⭐ PLAN SEMANAL + VEHÍCULOS BASE

**¿Qué hace?**
- Crea la tabla `plan_rutas_semanal` (zona + día semana + turno + vehículo + repartidor)
- Agrega columna `plan_ruta_id` a `rutas_reparto` y políticas RLS
- Inserta vehículos base (Fiorino, Hilux, F-4000)
- Actualiza `fn_asignar_pedido_a_ruta` para usar el plan y validar capacidad
- Actualiza `fn_convertir_presupuesto_a_pedido` para devolver `ruta_id` y delegar la asignación

**Dependencias:**
- Requiere migraciones previas (zonas, vehiculos, rutas_reparto, etc.)

**Comando:**
```sql
\i supabase/migrations/20251126_plan_rutas_semanal.sql
```

---

## 🔄 Orden Recomendado (DEFINITIVO)

### ✅ Orden Correcto por Dependencias (USAR ESTE)

```bash
# 1. Schema base (si no lo ejecutaste aún)
psql -U postgres -d avicola_db -f supabase/database-schema.sql

# 2. Migraciones en orden correcto (respetando dependencias)
psql -U postgres -d avicola_db -f supabase/migrations/20251114_hito_intermedio.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251121_flujo_completo.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251120_hito_presupuestos.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251122_ventas_presupuestos_ajustes.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251123_localidades.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251124_rutas_tracking.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251125_turnos_auto.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251125_ruta_assignment.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251126_plan_rutas_semanal.sql
```

**Razón del orden:**
1. `20251114_hito_intermedio.sql` → Base de tesorería (sin dependencias críticas)
2. `20251121_flujo_completo.sql` → Crea `zonas` y agrega campos (debe ir antes de presupuestos)
3. `20251120_hito_presupuestos.sql` → Crea presupuestos que referencian `zonas` (ya existe)
4. `20251122_ventas_presupuestos_ajustes.sql` → Ajusta funciones de presupuestos
5. `20251123_localidades.sql` → Agrega localidades (depende de zonas)
6. `20251124_rutas_tracking.sql` → Rutas optimizadas y tracking (depende de todas las anteriores)
7. `20251125_turnos_auto.sql` → Turnos automáticos y hook a asignación de rutas
8. `20251125_ruta_assignment.sql` → Función de asignación automática de rutas

### ⚠️ Orden Cronológico (NO USAR - FALLA)

Si ejecutas en orden cronológico, **fallará** porque `presupuestos` intenta referenciar `zonas` que aún no existe:

```bash
# ❌ NO HACER ESTO - FALLA porque zonas no existe
psql -U postgres -d avicola_db -f supabase/migrations/20251114_hito_intermedio.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251120_hito_presupuestos.sql  # ❌ FALLA AQUÍ
psql -U postgres -d avicola_db -f supabase/migrations/20251121_flujo_completo.sql
psql -U postgres -d avicola_db -f supabase/migrations/20251122_ventas_presupuestos_ajustes.sql
```

**Error esperado:**
```
ERROR: relation "zonas" does not exist
LINE 15: zona_id UUID REFERENCES zonas(id),
```

---

## ✅ Verificación Post-Ejecución

Después de ejecutar todas las migraciones, verifica:

```sql
-- Verificar tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'tesoreria_cajas', 
    'presupuestos', 
    'presupuesto_items', 
    'zonas',
    'devoluciones',
    'tesoro'
  )
ORDER BY table_name;

-- Verificar funciones RPC
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'fn_%'
ORDER BY routine_name;

-- Verificar campos agregados a presupuestos
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'presupuestos' 
  AND column_name IN ('turno', 'metodos_pago', 'recargo_total');
```

---

## 🐛 Problemas Comunes

### Error: "relation 'zonas' does not exist"
**Solución:** Ejecuta `20251121_flujo_completo.sql` antes de `20251120_hito_presupuestos.sql` (crea la tabla `zonas`)

### Error: "relation 'tesoreria_cajas' does not exist"
**Solución:** Ejecuta `20251114_hito_intermedio.sql` primero

### Error: "relation 'presupuestos' does not exist"
**Solución:** Ejecuta `20251120_hito_presupuestos.sql` primero

### Error: "function fn_convertir_presupuesto_a_pedido already exists"
**Solución:** Normal, la migración 4 reemplaza la función. Ejecuta `20251122_ventas_presupuestos_ajustes.sql` para actualizarla.

---

## 📝 Resumen Ejecutivo

**Orden final recomendado:**

1. ✅ `database-schema.sql` (schema base)
2. ✅ `20251114_hito_intermedio.sql` (tesorería base)
3. ✅ `20251121_flujo_completo.sql` (crea zonas y agrega campos)
4. ✅ `20251120_hito_presupuestos.sql` (sistema de presupuestos)
5. ✅ `20251122_ventas_presupuestos_ajustes.sql` (ajustes finales)
6. ✅ `20251123_localidades.sql` (localidades)
7. ✅ `20251124_rutas_tracking.sql` (rutas optimizadas y tracking)
8. ✅ `20251125_turnos_auto.sql` (turnos automáticos)
9. ✅ `20251125_ruta_assignment.sql` (asignación automática de rutas)
10. ✅ `20251126_plan_rutas_semanal.sql` (planificación semanal + vehículos base)

**Nota:** Los archivos 3 y 4 podrían intercambiarse si `20251120_hito_presupuestos.sql` maneja correctamente la ausencia de `zonas`, pero es más seguro crear `zonas` primero.

---

**Última actualización:** 2025-11-22
**Versión del sistema:** 1.0.0

