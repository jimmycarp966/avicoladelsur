# ANÁLISIS EXHAUSTIVO: PEDIDOS → REPARTO DIARIO

## 📋 RESUMEN EJECUTIVO

**Estado Actual**: El sistema tiene la base para el flujo de pedidos → reparto, pero **FALTAN campos críticos** para soportar:
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
```

**❌ FALTA:**
- `turno VARCHAR(20)` (mañana/tarde) - **CRÍTICO**
- `zona_id UUID` (referencia directa a zonas) - **IMPORTANTE** (actualmente se obtiene vía cliente)

#### ✅ `rutas_reparto` (Tabla existente)
```sql
- id, numero_ruta, vehiculo_id, repartidor_id
- fecha_ruta DATE  ✅ (existe)
- estado VARCHAR (planificada, en_curso, completada, cancelada)
- peso_total_kg, distancia_estimada_km, etc.
```

**❌ FALTA:**
- `turno VARCHAR(20)` (mañana/tarde) - **CRÍTICO**
- `zona_id UUID` (zona estipulada para esta ruta) - **IMPORTANTE**

#### ✅ `detalles_ruta` (Tabla existente)
```sql
- ruta_id, pedido_id, orden_entrega
- estado_entrega, coordenadas_entrega
```

**✅ OK**: Esta tabla está bien, relaciona pedidos con rutas.

---

### 2. FLUJO ACTUAL DE CONVERSIÓN PRESUPUESTO → PEDIDO

**Ubicación**: `supabase/migrations/20251120_hito_presupuestos.sql` - Función `fn_convertir_presupuesto_a_pedido`

```sql
-- Línea 221-230: Creación de pedido
INSERT INTO pedidos (
    numero_pedido, cliente_id, usuario_vendedor, fecha_entrega_estimada,
    estado, tipo_pedido, origen, total, subtotal, observaciones,
    presupuesto_id
) VALUES (
    v_numero_pedido, v_presupuesto.cliente_id, v_presupuesto.usuario_vendedor,
    v_presupuesto.fecha_entrega_estimada, 'preparando', 'venta', 'presupuesto',
    v_presupuesto.total_final, v_presupuesto.total_final, v_presupuesto.observaciones,
    p_presupuesto_id
)
```

**❌ PROBLEMA**: 
- No se copia `zona_id` del presupuesto al pedido
- No se asigna `turno` al pedido

---

### 3. FLUJO ACTUAL DE CREACIÓN DE RUTAS

**Ubicación**: `src/actions/reparto.actions.ts` - Función `crearRuta`

```typescript
// Línea 105-116: Creación de ruta
const { data: ruta, error: rutaError } = await supabase
  .from('rutas_reparto')
  .insert({
    numero_ruta: numeroRuta,
    vehiculo_id: params.vehiculo_id,
    repartidor_id: params.repartidor_id,
    fecha_ruta: params.fecha_ruta,  // ✅ Solo fecha, sin turno
    estado: 'planificada',
    observaciones: params.observaciones,
  })
```

**❌ PROBLEMA**: 
- No se guarda `turno` en la ruta
- No se guarda `zona_id` en la ruta

---

### 4. FLUJO ACTUAL DE ASIGNACIÓN DE PEDIDOS A RUTA

**Ubicación**: `src/actions/reparto.actions.ts` - Función `asignarPedidosARuta`

```typescript
// Línea 148-158: Obtener pedidos
const { data: pedidos, error: pedidosError } = await supabase
  .from('pedidos')
  .select(`
    id,
    clientes (
      zona_entrega,  // ✅ Obtiene zona del cliente
      coordenadas
    )
  `)
  .in('id', pedidosIds)
  .eq('estado', 'preparando')  // ✅ Filtra por estado
```

**❌ PROBLEMAS**:
1. No filtra por `fecha_entrega_estimada` (debería coincidir con `fecha_ruta`)
2. No filtra por `turno` (debería coincidir con turno de la ruta)
3. No valida que todos los pedidos sean de la misma zona
4. Ordena por zona pero no valida consistencia

---

### 5. PRESUPUESTOS Y ZONAS

**✅ EXISTE**: 
- `presupuestos.zona_id` (referencia directa a zonas)
- `clientes.zona_entrega` (string, nombre de zona)

**⚠️ INCONSISTENCIA**:
- Presupuestos usan `zona_id` (UUID, relación FK)
- Clientes usan `zona_entrega` (string, texto libre)
- Pedidos no tienen `zona_id` directo

---

## 🎯 REQUERIMIENTOS DEL USUARIO

> "Los pedidos ahora son los que salen en el reparto diariamente. Pueden ser por turno mañana o turno tarde, pero siempre salen pedidos, a zonas estipuladas."

**Interpretación**:
1. ✅ Pedidos se crean diariamente (desde presupuestos convertidos)
2. ❌ **FALTA**: Turnos (mañana/tarde) en rutas y pedidos
3. ✅ Zonas existen pero no se validan al crear rutas
4. ❌ **FALTA**: Validación de que pedidos de una ruta sean del mismo turno y zona

---

## 🔧 CORRECCIONES NECESARIAS

### PRIORIDAD ALTA (Crítico para funcionamiento)

1. **Agregar campo `turno` a `rutas_reparto`**
   - Tipo: `VARCHAR(20) CHECK (turno IN ('mañana', 'tarde'))`
   - Default: NULL (permitir rutas sin turno por compatibilidad)
   - NOT NULL en nuevas rutas

2. **Agregar campo `turno` a `pedidos`**
   - Tipo: `VARCHAR(20) CHECK (turno IN ('mañana', 'tarde'))`
   - Default: NULL (compatibilidad con pedidos existentes)
   - Se copia desde presupuesto al convertir

3. **Agregar campo `zona_id` a `pedidos`**
   - Tipo: `UUID REFERENCES zonas(id)`
   - Se copia desde presupuesto al convertir
   - Facilita filtrado y validación

4. **Agregar campo `zona_id` a `rutas_reparto`**
   - Tipo: `UUID REFERENCES zonas(id)`
   - Zona estipulada para la ruta
   - Valida que todos los pedidos sean de esta zona

### PRIORIDAD MEDIA (Mejoras de validación)

5. **Actualizar `fn_convertir_presupuesto_a_pedido`**
   - Copiar `zona_id` del presupuesto al pedido
   - Copiar `turno` del presupuesto (si existe) o permitir asignarlo

6. **Actualizar `asignarPedidosARuta`**
   - Filtrar pedidos por `fecha_entrega_estimada = fecha_ruta`
   - Filtrar pedidos por `turno = turno_ruta`
   - Filtrar pedidos por `zona_id = zona_ruta`
   - Validar que todos los pedidos seleccionados cumplan estas condiciones

7. **Actualizar `crearRuta`**
   - Requerir `turno` y `zona_id` como parámetros
   - Validar que los pedidos seleccionados sean del mismo turno y zona

### PRIORIDAD BAJA (Mejoras de UI)

8. **Actualizar UI de creación de rutas**
   - Selector de turno (mañana/tarde)
   - Selector de zona
   - Filtrado automático de pedidos disponibles por fecha, turno y zona

9. **Actualizar UI de presupuestos**
   - Campo para asignar turno al presupuesto (opcional)
   - Mostrar turno en lista y detalle

---

## 📊 DIAGRAMA DE FLUJO CORREGIDO

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

- [ ] Migración SQL: Agregar `turno` a `rutas_reparto`
- [ ] Migración SQL: Agregar `turno` a `pedidos`
- [ ] Migración SQL: Agregar `zona_id` a `pedidos`
- [ ] Migración SQL: Agregar `zona_id` a `rutas_reparto`
- [ ] Actualizar `fn_convertir_presupuesto_a_pedido` para copiar zona_id y turno
- [ ] Actualizar `crearRuta` para requerir turno y zona_id
- [ ] Actualizar `asignarPedidosARuta` para filtrar y validar por turno y zona
- [ ] Actualizar tipos TypeScript (`RutaReparto`, `Pedido`)
- [ ] Actualizar schemas Zod (`reparto.schema.ts`, `pedidos.schema.ts`)
- [ ] Actualizar UI de creación de rutas (selector turno y zona)
- [ ] Actualizar UI de presupuestos (campo turno opcional)
- [ ] Actualizar documentación (ARCHITECTURE.MD)

---

## 🚨 NOTAS IMPORTANTES

1. **Compatibilidad hacia atrás**: Los campos nuevos deben ser NULL por defecto para no romper datos existentes.

2. **Validación de datos**: Al crear una ruta, validar que:
   - Todos los pedidos tengan el mismo `turno`
   - Todos los pedidos tengan el mismo `zona_id`
   - Todos los pedidos tengan `fecha_entrega_estimada = fecha_ruta`

3. **Presupuestos sin turno**: Si un presupuesto no tiene turno asignado, el pedido resultante tampoco lo tendrá. Se puede asignar manualmente al crear la ruta.

4. **Zonas**: Asegurar que `presupuestos.zona_id` y `clientes.zona_entrega` estén sincronizados o migrar clientes a usar `zona_id` también.

---

**Fecha de análisis**: 2025-11-20
**Estado**: Pendiente de implementación

