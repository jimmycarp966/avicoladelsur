# ANÁLISIS EXHAUSTIVO: PEDIDOS → REPARTO DIARIO

## 📋 RESUMEN EJECUTIVO

**Estado Actual**: El sistema tiene el flujo de pedidos → reparto **COMPLETO Y FUNCIONAL**. Se han implementado los campos críticos que faltaban anteriormente:
- ✅ Turnos (mañana/tarde) en rutas
- ✅ Turnos en pedidos
- ✅ Filtrado por zona estipulada al crear rutas
- ✅ Validación de que pedidos de una ruta sean del mismo turno y zona

---

## 🔍 ANÁLISIS DETALLADO

### 1. ESTRUCTURA ACTUAL DE TABLAS

#### ✅ `pedidos` (Tabla existente)
```sql
- id, numero_pedido, cliente_id
- fecha_entrega_estimada DATE  ✅ (existe)
- estado VARCHAR (pendiente, confirmado, preparando, enviado, entregado)
- presupuesto_id UUID  ✅ (agregado en hito presupuestos)
- total_final DECIMAL  ✅ (agregado en hito presupuestos)
- pago_estado VARCHAR  ✅ (agregado en hito presupuestos)
- turno VARCHAR(20) ✅ (mañana/tarde)
- zona_id UUID ✅ (referencia directa a zonas)
```

#### ✅ `rutas_reparto` (Tabla existente)
```sql
- id, numero_ruta, vehiculo_id, repartidor_id
- fecha_ruta DATE  ✅ (existe)
- estado VARCHAR (planificada, en_curso, completada, cancelada)
- peso_total_kg, distancia_estimada_km, etc.
- turno VARCHAR(20) ✅ (mañana/tarde)
- zona_id UUID ✅ (zona estipulada para esta ruta)
```

#### ✅ `detalles_ruta` (Tabla existente)
```sql
- ruta_id, pedido_id, orden_entrega
- estado_entrega, coordenadas_entrega
```

---

### 2. FLUJO ACTUAL DE CONVERSIÓN PRESUPUESTO → PEDIDO

**Ubicación**: `supabase/migrations/20251120_hito_presupuestos.sql` y actualizaciones posteriores.

**✅ SOLUCIONADO**: 
- Se copia `zona_id` del presupuesto al pedido.
- Se asigna `turno` al pedido automáticamente o manual.

---

### 3. FLUJO ACTUAL DE CREACIÓN DE RUTAS

**Ubicación**: `src/actions/reparto.actions.ts` - Función `crearRuta`

**✅ SOLUCIONADO**: 
- Se guarda `turno` en la ruta.
- Se guarda `zona_id` en la ruta.
- Se valida que `turno` y `zona_id` sean obligatorios.

---

### 4. FLUJO ACTUAL DE ASIGNACIÓN DE PEDIDOS A RUTA

**Ubicación**: `src/actions/reparto.actions.ts` - Función `asignarPedidosARuta`

**✅ SOLUCIONADO**:
1. Filtra por `fecha_entrega_estimada` (coincide con `fecha_ruta`).
2. Filtra por `turno` (coincide con turno de la ruta).
3. Valida que todos los pedidos sean de la misma zona.

---

### 5. PRESUPUESTOS Y ZONAS

**✅ EXISTE**: 
- `presupuestos.zona_id` (referencia directa a zonas)
- `clientes.zona_entrega` (string, nombre de zona)
- `pedidos.zona_id` (UUID, referencia a zonas)

---

## 🎯 REQUERIMIENTOS DEL USUARIO

> "Los pedidos ahora son los que salen en el reparto diariamente. Pueden ser por turno mañana o turno tarde, pero siempre salen pedidos, a zonas estipuladas."

**Estado**: **CUMPLIDO**. El sistema soporta nativamente turnos y zonas en todo el flujo.

---

## 🔧 CORRECCIONES REALIZADAS

### PRIORIDAD ALTA (Crítico para funcionamiento)

1. **Agregar campo `turno` a `rutas_reparto`** ✅ HECHO
2. **Agregar campo `turno` a `pedidos`** ✅ HECHO
3. **Agregar campo `zona_id` a `pedidos`** ✅ HECHO
4. **Agregar campo `zona_id` a `rutas_reparto`** ✅ HECHO

### PRIORIDAD MEDIA (Mejoras de validación)

5. **Actualizar `fn_convertir_presupuesto_a_pedido`** ✅ HECHO
6. **Actualizar `asignarPedidosARuta`** ✅ HECHO
7. **Actualizar `crearRuta`** ✅ HECHO

### PRIORIDAD BAJA (Mejoras de UI)

8. **Actualizar UI de creación de rutas** ✅ HECHO
9. **Actualizar UI de presupuestos** ✅ HECHO

---

## 📊 DIAGRAMA DE FLUJO ACTUAL

```
PRESUPUESTO (con zona_id, fecha_entrega_estimada, [turno])
    ↓
[Almacén pesa y finaliza]
    ↓
fn_convertir_presupuesto_a_pedido()
    ↓
PEDIDO (estado='preparando', zona_id, fecha_entrega_estimada, turno)
    ↓
[Admin crea RUTA]
    - Selecciona: fecha_ruta, turno, zona_id
    - Selecciona pedidos disponibles (filtrados por fecha, turno, zona)
    ↓
RUTA (fecha_ruta, turno, zona_id)
    ↓
[Asignar pedidos a ruta]
    - Validar: todos los pedidos tienen mismo turno y zona
    - Validar: fecha_entrega_estimada = fecha_ruta
    ↓
DETALLES_RUTA (pedidos asignados)
    ↓
[Repartidor ejecuta ruta]
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Migración SQL: Agregar `turno` a `rutas_reparto`
- [x] Migración SQL: Agregar `turno` a `pedidos`
- [x] Migración SQL: Agregar `zona_id` a `pedidos`
- [x] Migración SQL: Agregar `zona_id` a `rutas_reparto`
- [x] Actualizar `fn_convertir_presupuesto_a_pedido` para copiar zona_id y turno
- [x] Actualizar `crearRuta` para requerir turno y zona_id
- [x] Actualizar `asignarPedidosARuta` para filtrar y validar por turno y zona
- [x] Actualizar tipos TypeScript (`RutaReparto`, `Pedido`)
- [x] Actualizar schemas Zod (`reparto.schema.ts`, `pedidos.schema.ts`)
- [x] Actualizar UI de creación de rutas (selector turno y zona)
- [x] Actualizar UI de presupuestos (campo turno opcional)
- [x] Actualizar documentación (ARCHITECTURE.MD)

---

**Fecha de actualización**: 2025-11-27
**Estado**: Implementado y Verificado

