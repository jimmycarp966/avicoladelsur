# Plan: Merma Líquida Proporcional + Optimización Salida de Cajones

Implementar distribución proporcional de merma líquida entre productos generados y optimizar el flujo de salida de stock para calcular automáticamente el peso cuando se trata de cajones.

## Análisis del Estado Actual

**Cálculo actual en `fn_completar_orden_produccion`:**
- Merma total = peso_total_entrada - peso_total_salida
- Merma líquida = merma_total - desperdicio_sólido
- Se guarda en `ordenes_produccion.merma_kg` a nivel de orden
- **NO** se distribuye entre productos individuales

**Campos disponibles:**
- `orden_produccion_entradas.merma_real_kg`: existe pero no se usa actualmente
- `orden_produccion_entradas.es_desperdicio_solido`: marca productos que son desperdicio sólido

## Implementación Propuesta

### PARTE 1: Merma Líquida Proporcional por Producto

#### 1. Modificar `fn_completar_orden_produccion`

**Lógica de cálculo proporcional:**

```
Paso 1: Calcular merma líquida total
  v_merma_liquida = v_merma_total - v_desperdicio_solido

Paso 2: Calcular peso total de productos NO desperdicio
  v_peso_productos = SUM(peso_kg) WHERE es_desperdicio_solido = false

Paso 3: Calcular factor de distribución
  v_factor = v_merma_liquida / v_peso_productos
  (ej: 1kg merma / 19kg productos = 0.0526 kg merma por kg producto)

Paso 4: Distribuir merma a cada producto
  FOR EACH entrada WHERE es_desperdicio_solido = false:
    v_merma_producto = entrada.peso_kg * v_factor
    UPDATE orden_produccion_entradas
    SET merma_real_kg = v_merma_producto
    WHERE id = entrada.id
```

### PARTE 2: Optimización Salida de Cajones en Producción

**Problema actual:**
- En PASO 2 de producción, al agregar salida de stock, el usuario debe ingresar manualmente el peso
- Si el producto es un cajón de 20 kg, tiene que seleccionar producto, lote, cantidad y luego escribir "20" en peso_kg

**Solución propuesta:**

#### 1. Modificar UI de producción (`nueva/page.tsx`)

**Cambios en el formulario de salida:**

```typescript
// Cuando se selecciona un producto:
const productoSeleccionado = productos.find(p => p.id === productoSalidaId)

// Si el producto tiene venta_mayor_habilitada = true
if (productoSeleccionado?.venta_mayor_habilitada) {
  // Mostrar campo "Cantidad de cajones"
  // Calcular automáticamente: peso_kg = cantidad * kg_por_unidad_mayor
  // Permitir edición manual del peso si es necesario
}
```

**UX propuesta:**
- Campo 1: Producto (select)
- Campo 2: Lote (select)
- Campo 3: Cantidad (number)
- Campo 4: Peso (kg) - **AUTOCALCULADO** si el producto tiene `venta_mayor_habilitada`
  - Mostrar badge: "1 caja = {kg_por_unidad_mayor} kg"
  - Fórmula: `peso_kg = cantidad * kg_por_unidad_mayor`
  - Permitir edición manual con toggle "Editar peso manualmente"

#### 2. Activar automáticamente venta_mayor_habilitada para cajones

**Criterio para identificar cajones:**
- Productos cuyo `nombre` contiene "cajón" o "cajon"
- O productos con `categoria = "Cajones"` (si existe)
- O productos con `codigo` que contiene "CAJ"

**Migración SQL:**
```sql
-- Activar venta_mayor_habilitada para productos que son cajones
UPDATE productos
SET venta_mayor_habilitada = true,
    unidad_mayor_nombre = 'caja',
    kg_por_unidad_mayor = 20.0
WHERE activo = true
  AND (
    LOWER(nombre) LIKE '%cajon%'
    OR LOWER(nombre) LIKE '%cajón%'
    OR LOWER(categoria) = 'cajones'
    OR LOWER(codigo) LIKE '%caj%'
  )
  AND venta_mayor_habilitada = false;
```

**Nota:** Esto actualizará productos existentes. Los nuevos productos de cajones se configuran manualmente al crearlos.

### 2. Estructura de cambios

**Archivo:** `supabase/migrations/20260113_merma_liquida_proporcional.sql`

**Cambios:**
- Actualizar `fn_completar_orden_produccion` con lógica proporcional
- Agregar validación para evitar división por cero
- Mantener compatibilidad con cálculo existente a nivel de orden

### 3. Ejemplo numérico

**Entrada:**
- Merma líquida total: 1 kg (1000 g)
- Productos generados: 19 kg totales
  - Patamuslo: 6 kg
  - Alas: 2 kg
  - Puchero: 3 kg
  - Menudo: 1 kg
  - Filet: 5 kg
  - Trocito: 2 kg

**Cálculo:**
- Factor = 1 kg / 19 kg = 0.05263 kg merma por kg producto
- Patamuslo: 6 × 0.05263 = 0.316 kg (316 g)
- Alas: 2 × 0.05263 = 0.105 kg (105 g)
- Puchero: 3 × 0.05263 = 0.158 kg (158 g)
- Menudo: 1 × 0.05263 = 0.053 kg (53 g)
- Filet: 5 × 0.05263 = 0.263 kg (263 g)
- Trocito: 2 × 0.05263 = 0.105 kg (105 g)
- **Suma:** 1.000 kg ✓

## Riesgos y Mitigaciones

### Riesgo 1: División por cero
**Situación:** No hay productos generados (v_peso_productos = 0)
**Mitigación:** Validar antes de calcular factor, asignar merma_real_kg = 0 si no hay productos

### Riesgo 2: Precisión decimal
**Situación:** Acumulación de errores por redondeo
**Mitigación:** Usar DECIMAL(10,3) para mantener precisión, la suma debe cuadrar

### Riesgo 3: Backward compatibility
**Situación:** Órdenes completadas anteriormente no tienen merma_real_kg
**Mitigación:** El cambio solo afecta nuevas órdenes, las anteriores mantienen su estado

## Pruebas de Verificación

### 1. Prueba unitaria SQL
```sql
-- Crear orden de prueba con datos conocidos
-- Completar orden
-- Verificar:
--   a) merma_real_kg calculada por producto
--   b) SUM(merma_real_kg) = merma_liquida total
--   c) merma_real_kg = 0 para es_desperdicio_solido = true
```

### 2. Prueba edge cases
- Orden con solo desperdicio sólido (merma líquida = 0)
- Orden sin productos generados
- Orden con un solo producto

### 3. Verificación en UI
- Consultar orden completada
- Verificar que muestra merma individual por producto
- Verificar que suma coincide con merma total

## Pasos de Implementación

### PARTE 1: Merma Líquida Proporcional
1. ✅ Analizar código actual de `fn_completar_orden_produccion`
2. ✅ Diseñar algoritmo de distribución proporcional
3. ⏳ Crear migración SQL con función actualizada
4. ⏳ Probar migración en desarrollo
5. ⏳ Verificar cálculos con datos reales

### PARTE 2: Optimización Cajones
1. ✅ Analizar flujo actual de salida de stock en producción
2. ✅ Identificar campos existentes (`kg_por_unidad_mayor`)
3. ⏳ Crear migración para activar `venta_mayor_habilitada` en productos cajones
4. ⏳ Modificar UI de producción para cálculo automático
5. ⏳ Agregar validaciones y UX mejorada
6. ⏳ Probar flujo completo con productos con/sin cajones

### COMÚN
6. ⏳ Actualizar documentación si es necesario

## Archivos a Modificar

### Merma Líquida:
1. `supabase/migrations/20260113_merma_liquida_proporcional.sql` (nuevo)
2. `src/actions/produccion.actions.ts` (sin cambios, usa RPC existente)

### Optimización Cajones:
1. `supabase/migrations/20260113_merma_liquida_proporcional.sql` (activar venta_mayor_habilitada)
2. `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx` (UI de producción)
