# 🏢 Modelo de Control para Sucursales - Documentación Completa

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Problema Resuelto](#problema-resuelto)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Flujo de Operación Diaria](#flujo-de-operación-diaria)
5. [Sistema de Precios y Listas](#sistema-de-precios-y-listas)
6. [Cálculo de Costo Real](#cálculo-de-costo-real)
7. [Conteos Físicos de Stock](#conteos-físicos-de-stock)
8. [Auditoría y Reportes](#auditoría-y-reportes)
9. [Detección de Desvíos](#detección-de-desvíos)
10. [Vista desde Casa Central](#vista-desde-casa-central)
11. [Casos de Uso](#casos-de-uso)
12. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

El **Modelo de Control para Sucursales** es un sistema integral que permite a casa central tener visibilidad completa y control sobre las operaciones de las sucursales, especialmente en lo relacionado con:

- **Control de precios mayorista/minorista**: Evitar que se manipulen precios para quedarse con diferencias
- **Stock y valorización real**: Saber exactamente cuánto stock y a qué costo tiene cada sucursal
- **Auditoría de ventas**: Registrar qué lista de precios se usa en cada venta
- **Conteos físicos**: Ciclo semanal de conteo con ajustes automáticos de mermas normales
- **Detección de fraude**: Alertas automáticas de comportamientos sospechosos

---

## Problema Resuelto

### Situación Anterior

Antes de implementar este modelo, el sistema tenía las siguientes limitaciones:

1. **Falta de control de precios**: 
   - Las sucursales podían vender un producto como "mayorista" cuando en realidad era minorista
   - La diferencia de precio se quedaba en el bolsillo del cajero o de la sucursal
   - No había forma de detectar este comportamiento

2. **Stock sin valorización real**:
   - No se sabía el costo real del stock en cada sucursal
   - No se podía valorizar el inventario a precio de costo
   - Difícil tomar decisiones de negocio sin esta información

3. **Falta de auditoría**:
   - No había registro de qué tipo de precio se usaba en cada venta
   - Imposible detectar patrones de uso indebido de listas de precios
   - No se podía medir la rentabilidad real por tipo de venta

4. **Conteos manuales sin control**:
   - Los conteos físicos no estaban integrados al sistema
   - No había forma de comparar stock teórico vs físico
   - Las mermas no se registraban automáticamente

### Solución Implementada

El nuevo modelo resuelve todos estos problemas mediante:

1. **Registro automático de lista de precios** en cada venta
2. **Cálculo de costo real** por sucursal usando costo promedio ponderado
3. **Auditoría completa** de uso de listas con reportes y alertas
4. **Conteos físicos integrados** con ajustes automáticos de mermas normales
5. **Detección automática** de comportamientos sospechosos

---

## Arquitectura del Sistema

### Componentes Principales

#### 1. Base de Datos

**Tablas Nuevas:**

- `conteos_stock`: Registro de conteos físicos realizados
- `conteo_stock_items`: Detalle de productos contados en cada conteo
- `ajustes_stock`: Ajustes de merma/sobrante derivados de conteos
- `auditoria_listas_precios`: Registro de qué lista se usó en cada venta

**Campos Agregados a Tablas Existentes:**

- `detalles_pedido`: 
  - `costo_unitario`: Costo del producto al momento de la venta
  - `margen_bruto`: Diferencia entre precio y costo
  - `lista_precio_id`: ID de la lista de precios usada
  - `tipo_lista`: Tipo de lista (mayorista, minorista, distribuidor)

- `pedidos`:
  - `costo_total`: Costo total de los productos vendidos
  - `margen_bruto_total`: Margen bruto total de la venta
  - `usuario_cajero_id`: Usuario que realizó la venta

#### 2. Funciones RPC (PostgreSQL)

**Gestión de Costos:**
- `fn_obtener_costo_promedio_sucursal()`: Calcula costo promedio ponderado

**Ventas:**
- `fn_registrar_venta_sucursal()`: Registra venta con control completo de precios, costo y margen

**Conteos:**
- `fn_iniciar_conteo_stock()`: Inicia un nuevo conteo físico
- `fn_completar_conteo_stock()`: Completa conteo y genera ajustes automáticos

**Reportes:**
- `fn_reporte_uso_listas_sucursal()`: Reporte de uso de listas por usuario
- `fn_reporte_margenes_sucursal()`: Reporte de márgenes por día y tipo de lista
- `fn_detectar_comportamiento_sospechoso()`: Detecta patrones de fraude

#### 3. Server Actions (Next.js)

Archivo: `src/actions/ventas-sucursal.actions.ts`

Funciones principales:
- `registrarVentaSucursalConControlAction()`: Registra venta con control completo
- `iniciarConteoStockAction()`: Inicia conteo físico
- `obtenerConteoStockAction()`: Obtiene conteo con items
- `actualizarCantidadContadaAction()`: Actualiza cantidad contada de un item
- `completarConteoStockAction()`: Completa conteo y genera ajustes
- `obtenerReporteUsoListasAction()`: Obtiene reporte de uso de listas
- `obtenerReporteMargenesAction()`: Obtiene reporte de márgenes
- `obtenerAlertasComportamientoAction()`: Obtiene alertas de comportamiento sospechoso

#### 4. Componentes UI

- **`POSSucursal.tsx`**: POS mejorado con selección de lista de precios
- **`ConteosStockContent.tsx`**: Interfaz para gestión de conteos físicos
- **`AuditoriaListasContent.tsx`**: Reportes de auditoría de uso de listas

#### 5. Páginas

- `/sucursal/ventas`: POS con control de precios
- `/sucursal/inventario/conteos`: Gestión de conteos físicos
- `/sucursal/reportes/auditoria`: Reportes de auditoría

---

## Flujo de Operación Diaria

### 1. Recepción de Mercadería

Cuando casa central envía mercadería a una sucursal:

```
Casa Central → Crear Transferencia Interna
    ↓
Especificar: Producto, Cantidad (kg), Costo Unitario
    ↓
Transferencia aprobada → Stock llega a sucursal
    ↓
Sucursal recibe → Confirma cantidades
    ↓
Sistema crea lotes en sucursal con costo asociado
```

**Importante**: El costo se registra en el momento de la transferencia, permitiendo valorizar el stock a costo real.

### 2. Venta en el POS

#### Paso a Paso:

1. **Abrir POS** (`/sucursal/ventas`)
   - El sistema muestra productos disponibles con stock actual

2. **Seleccionar Cliente**
   - Búsqueda por nombre o código
   - El cliente puede tener listas de precios asignadas automáticamente

3. **Seleccionar Lista de Precios**
   - **Mayorista**: Para clientes que compran grandes cantidades
   - **Minorista**: Para ventas al público general
   - **Distribuidor**: Para clientes especiales
   - El sistema muestra el tipo de lista seleccionada

4. **Agregar Productos al Carrito**
   - Búsqueda por nombre o código
   - Ingreso de cantidad en kg
   - El sistema muestra:
     - Stock disponible
     - Precio según lista seleccionada
     - Subtotal

5. **Procesar Venta**
   - Al hacer clic en "Cobrar", el sistema:
     - Valida stock disponible
     - Calcula costo promedio ponderado de cada producto
     - Calcula precio según lista seleccionada
     - Calcula margen bruto (precio - costo)
     - Descuenta stock usando FIFO (lote más antiguo primero)
     - Registra en `pedidos` y `detalles_pedido`:
       - Precio unitario
       - Costo unitario
       - Margen bruto
       - Lista de precios usada
       - Tipo de lista
     - Registra en `auditoria_listas_precios`:
       - Usuario que vendió
       - Cliente
       - Lista usada
       - Cantidad total
       - Monto total
       - Fecha y hora

#### Ejemplo de Venta:

```
Producto: Pollo N°8
Cantidad: 10 kg
Lista seleccionada: Mayorista
Precio lista mayorista: $1,200/kg
Costo promedio sucursal: $800/kg

Resultado:
- Precio total: $12,000
- Costo total: $8,000
- Margen bruto: $4,000 (33.3%)
- Registrado como: tipo_lista = "mayorista"
```

### 3. Registro Automático

Cada venta genera automáticamente:

1. **Registro en `pedidos`**:
   ```sql
   {
     total: 12000,
     costo_total: 8000,
     margen_bruto_total: 4000,
     lista_precio_id: "uuid-lista-mayorista",
     usuario_cajero_id: "uuid-usuario"
   }
   ```

2. **Registro en `detalles_pedido`** (por cada producto):
   ```sql
   {
     precio_unitario: 1200,
     costo_unitario: 800,
     margen_bruto: 4000,
     lista_precio_id: "uuid-lista-mayorista",
     tipo_lista: "mayorista"
   }
   ```

3. **Registro en `auditoria_listas_precios`**:
   ```sql
   {
     sucursal_id: "uuid-sucursal",
     usuario_id: "uuid-usuario",
     cliente_id: "uuid-cliente",
     lista_precio_id: "uuid-lista-mayorista",
     tipo_lista: "mayorista",
     cantidad_total: 10,
     monto_total: 12000,
     fecha_venta: "2025-12-02T14:30:00Z"
   }
   ```

---

## Sistema de Precios y Listas

### Estructura de Listas de Precios

El sistema maneja múltiples listas de precios:

1. **Lista Minorista**: Precios para venta al público general
2. **Lista Mayorista**: Precios para clientes que compran grandes cantidades
3. **Lista Distribuidor**: Precios especiales para distribuidores
4. **Listas Personalizadas**: Listas creadas específicamente para ciertos clientes

### Asignación de Listas

**Automática por Tipo de Cliente:**
- Si un cliente tiene `tipo_cliente = "mayorista"`, se le asigna automáticamente la lista mayorista
- Si tiene `tipo_cliente = "minorista"`, se le asigna la lista minorista

**Manual:**
- El cajero puede elegir manualmente qué lista usar en cada venta
- Esta elección queda registrada para auditoría

### Cálculo de Precio

El sistema calcula el precio de un producto en una lista así:

1. **Busca precio manual** en `precios_productos`:
   - Si existe un precio específico para ese producto en esa lista → usa ese precio

2. **Si no hay precio manual**, calcula desde margen de ganancia:
   - Obtiene `margen_ganancia` de la lista (ej: 30%)
   - Obtiene `precio_costo` del producto
   - Calcula: `precio = precio_costo × (1 + margen_ganancia / 100)`

3. **Si no hay margen configurado**, usa `precio_venta` del producto como fallback

### Selección de Lista en el POS

En el POS, el cajero:

1. **Ve todas las listas disponibles** en un selector
2. **Puede cambiar la lista** en cualquier momento antes de cobrar
3. **Ve el tipo de lista** claramente marcado (mayorista/minorista)
4. **Los precios se actualizan automáticamente** al cambiar de lista

---

## Cálculo de Costo Real

### Costo Promedio Ponderado

El sistema calcula el costo de un producto en una sucursal usando **costo promedio ponderado**:

```
Costo Promedio = Suma(lote.cantidad × lote.costo) / Suma(lote.cantidad)
```

### Ejemplo Práctico

Sucursal tiene stock de Pollo N°8:

- **Lote 1**: 50 kg a $800/kg (costo total: $40,000)
- **Lote 2**: 30 kg a $900/kg (costo total: $27,000)
- **Lote 3**: 20 kg a $750/kg (costo total: $15,000)

**Cálculo:**
```
Costo Promedio = (40,000 + 27,000 + 15,000) / (50 + 30 + 20)
               = 82,000 / 100
               = $820/kg
```

### Cuándo se Calcula

El costo promedio se calcula:

1. **Al momento de la venta**: Para calcular el margen real
2. **Al iniciar un conteo**: Para valorizar diferencias
3. **En reportes**: Para mostrar valorización de stock

### Actualización del Costo

El costo promedio se actualiza automáticamente cuando:

- Llega nueva mercadería con costo diferente
- Se descuenta stock (FIFO)
- Se hacen ajustes de stock

---

## Conteos Físicos de Stock

### Ciclo Semanal

El sistema está diseñado para hacer conteos físicos **una vez por semana** en cada sucursal.

### Proceso Completo

#### 1. Iniciar Conteo

**Desde:** `/sucursal/inventario/conteos`

**Acción:** Hacer clic en "Nuevo Conteo"

**Lo que hace el sistema:**
- Crea un registro en `conteos_stock` con estado "en_proceso"
- Para cada producto con stock en la sucursal:
  - Calcula stock teórico (suma de `cantidad_disponible` de todos los lotes)
  - Obtiene costo promedio ponderado
  - Crea un item en `conteo_stock_items` con:
    - `cantidad_teorica`: Stock teórico calculado
    - `cantidad_contada`: NULL (pendiente de contar)
    - `costo_unitario_promedio`: Costo promedio

**Resultado:** Lista de productos lista para contar físicamente

#### 2. Contar Físicamente

El usuario en la sucursal:

1. **Toma la lista** del sistema (puede imprimirla o usar en pantalla)
2. **Cuenta físicamente** cada producto
3. **Ingresa la cantidad contada** en el sistema

**En el sistema:**
- Al ingresar la cantidad contada, se calcula automáticamente:
  - `diferencia = cantidad_contada - cantidad_teorica`
  - `valor_diferencia = diferencia × costo_unitario_promedio`

**Ejemplo:**
```
Producto: Pollo N°8
Stock teórico: 100 kg
Cantidad contada: 98 kg
Diferencia: -2 kg
Costo promedio: $820/kg
Valor diferencia: -$1,640
```

#### 3. Completar Conteo

**Acción:** Hacer clic en "Completar Conteo"

**Lo que hace el sistema:**

1. **Procesa cada diferencia:**
   - Calcula porcentaje de diferencia: `|diferencia| × 100 / cantidad_teorica`
   - Si diferencia < 0 → tipo_ajuste = "merma"
   - Si diferencia > 0 → tipo_ajuste = "sobrante"

2. **Evalúa tolerancia:**
   - Tolerancia por defecto: 2%
   - Si `porcentaje_diferencia ≤ 2%`:
     - Marca como "merma normal"
     - Aplica ajuste automáticamente al stock
     - Crea registro en `ajustes_stock` con `aprobado = true`
   - Si `porcentaje_diferencia > 2%`:
     - Marca para revisión
     - Crea registro en `ajustes_stock` con `aprobado = false`
     - NO aplica ajuste automáticamente

3. **Aplica ajustes automáticos:**
   - Para mermas aprobadas automáticamente:
     - Descuenta stock usando FIFO (lote más antiguo primero)
     - Crea movimientos de stock tipo "ajuste"
     - Registra motivo: "Ajuste por conteo físico - Merma normal"

4. **Actualiza conteo:**
   - Estado: "completado"
   - `total_diferencias`: Cantidad de productos con diferencias
   - `total_merma_valor`: Suma de valores de mermas

### Ejemplo Completo de Conteo

**Productos contados:**

| Producto | Teórico | Contado | Diferencia | % | Tipo | Ajuste |
|----------|---------|---------|------------|---|------|--------|
| Pollo N°8 | 100 kg | 98 kg | -2 kg | 2% | Merma | ✅ Automático |
| Pollo N°8 | 50 kg | 45 kg | -5 kg | 10% | Merma | ⚠️ Revisión |
| Pollo N°8 | 30 kg | 32 kg | +2 kg | 6.7% | Sobrante | ⚠️ Revisión |

**Resultado:**
- 1 ajuste automático aplicado (merma de 2%)
- 2 ajustes pendientes de revisión
- Total merma valor: $1,640 (del ajuste automático)

### Tolerancia Configurable

La tolerancia de merma se puede configurar por sucursal. Por defecto es 2%, pero puede ajustarse según:

- Tipo de producto (algunos tienen más merma natural)
- Experiencia histórica de la sucursal
- Políticas de la empresa

---

## Auditoría y Reportes

### Reporte de Uso de Listas por Usuario

**Ubicación:** `/sucursal/reportes/auditoria` → Tab "Uso por Usuario"

**Qué muestra:**

Para cada usuario y tipo de lista:
- Cantidad de ventas realizadas
- Kilogramos totales vendidos
- Monto total vendido
- Porcentaje del total de ventas del día

**Ejemplo:**

| Usuario | Tipo Lista | Ventas | Kg Totales | Monto Total | % del Día |
|---------|------------|--------|------------|-------------|-----------|
| Juan Pérez | Minorista | 45 | 120.5 | $144,600 | 75% |
| Juan Pérez | Mayorista | 15 | 80.2 | $96,240 | 25% |
| María López | Minorista | 30 | 95.0 | $114,000 | 60% |
| María López | Mayorista | 20 | 150.0 | $180,000 | 40% |

**Análisis:**
- Juan Pérez: 25% de sus ventas son mayoristas (normal)
- María López: 40% de sus ventas son mayoristas (alto, revisar)

### Reporte de Márgenes por Día

**Ubicación:** `/sucursal/reportes/auditoria` → Tab "Márgenes por Día"

**Qué muestra:**

Para cada día y tipo de lista:
- Cantidad de ventas
- Venta total
- Costo total
- Margen bruto
- Porcentaje de margen

**Ejemplo:**

| Fecha | Tipo Lista | Ventas | Venta Total | Costo Total | Margen Bruto | % Margen |
|-------|------------|--------|-------------|-------------|--------------|----------|
| 2025-12-02 | Minorista | 75 | $90,000 | $60,000 | $30,000 | 33.3% |
| 2025-12-02 | Mayorista | 35 | $42,000 | $30,000 | $12,000 | 28.6% |

**Análisis:**
- Las ventas minoristas tienen mejor margen (33.3% vs 28.6%)
- Esto es esperado, ya que las ventas mayoristas tienen descuento

### Estadísticas Resumen

El dashboard muestra:

1. **Ventas Minorista**: Total de ventas minoristas en el período
2. **Ventas Mayorista**: Total de ventas mayoristas en el período
3. **% Mayorista**: Porcentaje de ventas mayoristas del total
4. **Margen Promedio**: Margen promedio sobre todas las ventas

---

## Detección de Desvíos

### Alertas Automáticas

El sistema detecta automáticamente comportamientos sospechosos mediante la función `fn_detectar_comportamiento_sospechoso()`.

### Tipos de Alertas

#### 1. Alto % de Ventas Mayoristas

**Cuándo se activa:**
- Un usuario tiene un % de ventas mayoristas que es **1.5x mayor** que el promedio de la sucursal
- El usuario tiene al menos 5 ventas (para ser significativo)

**Ejemplo:**
```
Promedio sucursal: 20% ventas mayoristas
Usuario Juan: 60% ventas mayoristas
60% > 20% × 1.5 (30%) → ALERTA ACTIVADA
```

**Qué muestra:**
- Usuario afectado
- % actual vs promedio
- Descripción del problema
- Fecha de detección

#### 2. Ventas Mayoristas de Bajo Volumen

**Cuándo se activa:**
- Una venta mayorista tiene menos de 10 kg
- Esto sugiere que se está usando precio mayorista para un cliente que no debería tenerlo

**Ejemplo:**
```
Venta mayorista: 5 kg de Pollo N°8
Umbral mínimo: 10 kg
5 kg < 10 kg → ALERTA ACTIVADA
```

**Qué muestra:**
- Usuario que hizo la venta
- Cliente
- Cantidad vendida
- Fecha de la venta

### Frecuencia de Análisis

Las alertas se analizan sobre un período configurable (por defecto: últimos 7 días).

### Acción sobre Alertas

Cuando se detecta una alerta:

1. **Se muestra en el dashboard** de auditoría
2. **Casa central puede revisar** el detalle
3. **Se puede investigar** el comportamiento del usuario
4. **Se puede tomar acción correctiva** si es necesario

---

## Vista desde Casa Central

### Dashboard de Sucursales

Casa central puede ver:

1. **Stock y Valor por Sucursal:**
   - Cantidad de cada producto en kg
   - Costo promedio ponderado
   - Valor total del stock

2. **Ventas y Márgenes:**
   - Ventas totales por sucursal
   - Separado por tipo de lista (mayorista/minorista)
   - Márgenes obtenidos

3. **Alertas de Comportamiento:**
   - Usuarios con % mayorista alto
   - Ventas mayoristas de bajo volumen
   - Otras anomalías detectadas

4. **Conteos y Diferencias:**
   - Último conteo realizado
   - Diferencias detectadas
   - Mermas aplicadas automáticamente
   - Diferencias pendientes de revisión

### Reportes Disponibles

#### 1. Reporte de Uso de Listas

**Para qué sirve:**
- Ver qué cajeros usan más la lista mayorista
- Comparar entre cajeros
- Comparar con promedios históricos
- Detectar patrones anómalos

**Cómo usarlo:**
1. Ir a `/sucursal/reportes/auditoria`
2. Seleccionar período (fecha desde/hasta)
3. Ver tabla de uso por usuario
4. Analizar porcentajes y comparar

#### 2. Reporte de Márgenes

**Para qué sirve:**
- Ver rentabilidad por tipo de venta
- Comparar márgenes entre días
- Identificar tendencias
- Tomar decisiones de precios

**Cómo usarlo:**
1. Ir a `/sucursal/reportes/auditoria`
2. Tab "Márgenes por Día"
3. Ver tabla de márgenes
4. Analizar % de margen por tipo de lista

#### 3. Reporte de Conteos

**Para qué sirve:**
- Ver historial de conteos
- Analizar mermas históricas
- Identificar productos con más diferencias
- Evaluar precisión del stock teórico

**Cómo usarlo:**
1. Ir a `/sucursal/inventario/conteos`
2. Ver historial de conteos
3. Abrir conteo específico para ver detalle
4. Analizar diferencias y mermas

---

## Casos de Uso

### Caso 1: Detección de Uso Indebido de Precio Mayorista

**Situación:**
Un cajero está vendiendo muchos productos como "mayorista" cuando en realidad son ventas minoristas, quedándose con la diferencia.

**Cómo el sistema lo detecta:**

1. **Análisis automático:**
   - El sistema calcula que el promedio de ventas mayoristas en la sucursal es 20%
   - El cajero tiene 70% de ventas mayoristas
   - 70% > 20% × 1.5 (30%) → Alerta activada

2. **Reporte de auditoría:**
   - Casa central ve en el reporte que este cajero tiene 70% mayorista
   - Compara con otros cajeros (todos tienen ~20%)
   - Identifica el patrón anómalo

3. **Investigación:**
   - Revisa ventas específicas del cajero
   - Ve que muchas ventas mayoristas son de bajo volumen (<10 kg)
   - Confirma el uso indebido

4. **Acción:**
   - Se toma acción correctiva con el cajero
   - Se ajustan políticas si es necesario

### Caso 2: Merma Normal vs Merma Anormal

**Situación:**
En un conteo semanal, se detecta que hay menos stock físico que teórico.

**Cómo el sistema lo maneja:**

1. **Conteo realizado:**
   - Stock teórico: 100 kg
   - Stock contado: 98 kg
   - Diferencia: -2 kg (2%)

2. **Evaluación automática:**
   - Porcentaje: 2%
   - Tolerancia: 2%
   - 2% ≤ 2% → Merma normal

3. **Ajuste automático:**
   - Sistema descuenta 2 kg del stock (FIFO)
   - Crea ajuste con `aprobado = true`
   - Registra como "Merma normal (dentro de tolerancia 2%)"

**Si la diferencia fuera mayor:**

1. **Conteo realizado:**
   - Stock teórico: 100 kg
   - Stock contado: 90 kg
   - Diferencia: -10 kg (10%)

2. **Evaluación automática:**
   - Porcentaje: 10%
   - Tolerancia: 2%
   - 10% > 2% → Requiere revisión

3. **Marcado para revisión:**
   - Sistema crea ajuste con `aprobado = false`
   - NO descuenta stock automáticamente
   - Marca como "Diferencia detectada en conteo físico - Requiere revisión"
   - Casa central debe investigar

### Caso 3: Análisis de Rentabilidad por Tipo de Venta

**Situación:**
Casa central quiere saber si es más rentable vender como mayorista o minorista.

**Cómo el sistema lo muestra:**

1. **Reporte de márgenes:**
   - Ventas minoristas: Margen promedio 33.3%
   - Ventas mayoristas: Margen promedio 28.6%

2. **Análisis:**
   - Las ventas minoristas tienen mejor margen
   - Pero las ventas mayoristas pueden ser de mayor volumen
   - Se puede calcular rentabilidad total

3. **Decisión:**
   - Si el objetivo es maximizar margen → priorizar minorista
   - Si el objetivo es volumen → priorizar mayorista
   - Se puede ajustar estrategia según resultados

---

## Preguntas Frecuentes

### ¿Qué pasa si un cajero elige la lista incorrecta?

El sistema **no bloquea** la elección, pero:
- Registra qué lista se usó
- Genera alertas si hay patrones anómalos
- Permite auditoría posterior

**Filosofía:** Control posterior en lugar de bloqueo, para no trabar la operación.

### ¿Cómo se calcula el costo si hay múltiples lotes?

Se usa **costo promedio ponderado**:
- Se suman todos los lotes disponibles
- Se calcula: `Suma(cantidad × costo) / Suma(cantidad)`
- Este costo se usa para todas las ventas

### ¿Qué pasa si el conteo físico da más stock que el teórico?

Se marca como **sobrante** y requiere revisión:
- Puede ser error de conteo
- Puede ser error en el sistema
- Se investiga antes de aplicar ajuste

### ¿Con qué frecuencia se deben hacer conteos?

El sistema está diseñado para **conteos semanales**, pero puede ajustarse según necesidades:
- Productos de alta rotación: más frecuentes
- Productos estables: menos frecuentes

### ¿Las alertas bloquean las ventas?

**No.** Las alertas son informativas:
- Se muestran en reportes
- No bloquean la operación
- Permiten auditoría posterior

### ¿Se puede cambiar la tolerancia de merma?

**Sí.** La tolerancia se puede configurar:
- Por defecto: 2%
- Puede ajustarse por sucursal
- Puede ajustarse por tipo de producto

### ¿Qué información ve casa central en tiempo real?

Casa central puede ver:
- Stock actual por sucursal (actualizado en tiempo real)
- Valor del stock a costo real
- Ventas del día (con tipo de lista usada)
- Márgenes obtenidos
- Alertas de comportamiento

### ¿Cómo se valida que un ajuste de stock es correcto?

Los ajustes automáticos (merma ≤ tolerancia) se aplican directamente.

Los ajustes que requieren revisión:
- Se marcan con `aprobado = false`
- Casa central los revisa
- Puede aprobarlos manualmente
- Una vez aprobados, se aplican al stock

---

## Conclusión

El **Modelo de Control para Sucursales** proporciona:

✅ **Visibilidad completa** del stock y su valor a costo real
✅ **Control de precios** mediante auditoría de uso de listas
✅ **Detección automática** de comportamientos sospechosos
✅ **Conteos físicos integrados** con ajustes automáticos de mermas normales
✅ **Reportes detallados** para toma de decisiones

Todo esto sin trabar la operación diaria de las sucursales, manteniendo un equilibrio entre control y agilidad operativa.

---

*Documentación actualizada: Diciembre 2025*

