# Verificación de Página de Ventas (POS) de Sucursal

**Fecha:** 16/12/2025  
**Objetivo:** Verificar si la página de ventas de sucursal está diseñada correctamente como POS para mostrador presencial

---

## 📋 Requisitos Confirmados

### 1. Flujo y Funcionalidad Principal
- ✅ **POS mostrador presencial** - Ventas rápidas en mostrador
- ✅ **Métodos de pago:** Efectivo, Transferencia, Mercado Pago, Tarjeta
- ✅ **Multipago:** Sí, permitir dividir pago en varios métodos
- ✅ **Recargos por método:** Sí, aplicar recargos según método de pago
- ✅ **Venta genérica:** Sí, permitir venta sin cliente (mostrador genérico)
- ✅ **Lista de precios:** Seleccionable manualmente en el momento
- ✅ **IVA:** Precios con IVA incluido, desglosar en factura A/B
- ✅ **Descuento stock:** Inmediato con lotes/FIFO automático
- ✅ **Bloqueo crédito:** Bloquear si cliente excede límite cuenta corriente
- ✅ **Sin borradores:** Venta debe completarse en el momento
- ✅ **Apertura/cierre caja:** Exigir apertura y arqueo/cierre al finalizar turno
- ✅ **Impresión:** Ticket térmico 80mm
- ✅ **Devoluciones:** Con reintegro a stock y caja automático
- ✅ **Sin descuentos:** No requiere descuentos por línea ni globales

### 2. Búsqueda y Productos
- ✅ **Búsqueda:** Escáner de código de barras + búsqueda por texto
- ✅ **Productos:** Mixtos (balanza/granel y unidades fijas)
- ✅ **Dispositivo:** Principalmente desktop (PC/notebook con teclado y mouse)

### 3. Roles y Acceso
- ✅ **Rol principal:** Vendedor de sucursal
- ✅ **Sucursal fija:** Usuario tiene sucursal asignada (RLS)

---

## 🔍 Estado Actual de la Implementación

### Archivos Principales Revisados

1. **`src/app/sucursal/ventas/page.tsx`** - Página principal
2. **`src/components/sucursales/POSSucursal.tsx`** - Componente POS (NO usado actualmente)
3. **`src/components/sucursales/NuevaVentaForm.tsx`** - Formulario usado actualmente
4. **`src/components/sucursales/SucursalVentasContent.tsx`** - Contenedor de la página
5. **`src/actions/ventas-sucursal.actions.ts`** - Acciones con control de listas
6. **`src/actions/sucursales.actions.ts`** - Acciones generales de sucursal
7. **`supabase/migrations/20251202_modelo_control_sucursales.sql`** - Función RPC `fn_registrar_venta_sucursal`

---

## ✅ Funcionalidades Implementadas

### 1. Estructura de la Página
- ✅ Página existe en `/sucursal/ventas`
- ✅ Estadísticas del día (ventas, total, productos, clientes)
- ✅ Formulario de nueva venta integrado
- ✅ Lista de ventas del día

### 2. Gestión de Productos
- ✅ Búsqueda por texto (nombre/código) en `NuevaVentaForm`
- ✅ Selección de productos con dropdown
- ✅ Validación de stock disponible antes de agregar
- ✅ Visualización de stock disponible por producto
- ✅ Soporte para productos con cantidades decimales (balanza)

### 3. Carrito y Totales
- ✅ Carrito con múltiples productos
- ✅ Edición de cantidades
- ✅ Cálculo automático de subtotales y total
- ✅ Eliminación de productos del carrito

### 4. Control de Stock y Lotes
- ✅ **Función RPC `fn_registrar_venta_sucursal` implementa:**
  - ✅ Descuento inmediato de stock por sucursal
  - ✅ Control FIFO automático (lotes ordenados por fecha_vencimiento + fecha_ingreso)
  - ✅ Descuento por lote hasta agotar cantidad
  - ✅ Registro de movimientos_stock con trazabilidad
  - ✅ Validación de stock insuficiente

### 5. Listas de Precios
- ✅ `POSSucursal.tsx` tiene selector de lista de precios
- ✅ Actualización automática de precios al cambiar lista
- ✅ Función `obtenerPrecioProductoAction` obtiene precio de lista específica
- ✅ Control de tipo de lista (mayorista/minorista/distribuidor)
- ⚠️ **NO está en NuevaVentaForm** (el formulario actualmente usado)

### 6. Control de Costos y Márgenes
- ✅ Función RPC calcula costo promedio por sucursal
- ✅ Registro de margen bruto por venta
- ✅ Auditoría de uso de listas en `auditoria_listas_precios`
- ✅ Cálculo de costo_total y margen_bruto_total

### 7. Registro de Ventas
- ✅ Creación de pedido con estado 'completado'
- ✅ Tipo de pedido 'venta' con origen 'sucursal'
- ✅ Registro de usuario vendedor y cajero
- ✅ Número de pedido automático (formato: VTA-SUC-YYYYMMDD-HHMM-XXXX)

---

## ❌ Funcionalidades Faltantes (Brechas)

### 1. Métodos de Pago y Multipago
- ❌ **Multipago:** `NuevaVentaForm` solo permite un método de pago
- ❌ **Mercado Pago:** No está en las opciones (solo efectivo, transferencia, tarjeta, cuenta_corriente)
- ❌ **Recargos por método:** No hay sistema de recargos configurable
- ❌ **División de pago:** No hay UI para dividir en múltiples métodos

**Requisito:** Efectivo, Transferencia, MP, Tarjeta + multipago + recargos  
**Actual:** Solo un método, sin MP ni recargos

### 2. Cliente Opcional (Venta Genérica)
- ❌ **Cliente obligatorio:** `NuevaVentaForm` exige cliente (zod schema: `clienteId: z.string().min(1)`)
- ❌ **Venta genérica:** No hay opción para venta sin cliente

**Requisito:** Permitir venta genérica sin cliente  
**Actual:** Cliente es obligatorio

### 3. Lista de Precios Seleccionable
- ⚠️ **Selector disponible:** `POSSucursal.tsx` tiene selector pero NO se usa
- ❌ **No en formulario actual:** `NuevaVentaForm` NO tiene selector de lista
- ❌ **Precios fijos:** Usa `precioVenta` del producto directamente

**Requisito:** Seleccionar lista de precios en el momento  
**Actual:** No hay selector en el formulario usado

### 4. Control de Crédito y Límites
- ❌ **Validación de límite:** No hay validación antes de procesar venta a cuenta corriente
- ❌ **Bloqueo automático:** No hay verificación de límite de crédito o estado de deuda

**Requisito:** Bloquear venta a crédito si excede límite  
**Actual:** No hay validación

### 5. Apertura/Cierre de Caja
- ❌ **Validación de apertura:** No hay verificación de que la caja esté abierta
- ❌ **Cierre de turno:** No hay integración con sistema de cierres de caja
- ⚠️ **Sistema existe:** Hay `crearCierreCajaAction` y `cerrarCierreCajaAction` pero no se usan en POS

**Requisito:** Exigir caja abierta y arqueo/cierre  
**Actual:** No hay validación

### 6. Movimientos de Caja Automáticos
- ❌ **No se crean movimientos:** La función RPC `fn_registrar_venta_sucursal` NO crea movimientos de caja
- ❌ **Solo actualiza pedido:** Solo registra `pago_estado` en el pedido
- ❌ **Sin impacto en tesorería:** No hay movimiento en `tesoreria_movimientos`
- ❌ **Sin actualización de saldo:** No actualiza `saldo_actual` de la caja

**Requisito:** Crear movimiento de caja automático al registrar venta  
**Actual:** No se crea movimiento de caja

### 7. Escáner de Código de Barras
- ❌ **No implementado:** Solo hay búsqueda por texto
- ❌ **No hay captura:** No hay input con soporte para escáner
- ❌ **No hay API:** No hay endpoint para buscar por código rápidamente

**Requisito:** Escáner de código de barras + búsqueda texto  
**Actual:** Solo búsqueda por texto

### 8. Impresión Térmica
- ❌ **No implementado:** No hay sistema de impresión
- ❌ **No hay generación de ticket:** No se genera comprobante
- ❌ **No hay PDF:** No hay opción de descargar/imprimir comprobante

**Requisito:** Impresión térmica 80mm  
**Actual:** No hay impresión

### 9. IVA y Facturación
- ❌ **No hay desglose de IVA:** Precios no muestran si incluyen IVA
- ❌ **No hay selección de tipo:** No hay selector ticket/factura A/factura B
- ⚠️ **Sistema de facturas existe:** Hay `fn_crear_factura_desde_pedido` pero no se usa en POS
- ❌ **Sin desglose:** No hay cálculo ni visualización de IVA

**Requisito:** Precios con IVA incluido, desglosar en factura A/B  
**Actual:** No hay manejo de IVA ni selección de tipo de comprobante

### 10. Devoluciones
- ❌ **No hay funcionalidad:** No hay botón o flujo de devolución desde POS
- ⚠️ **Sistema existe:** Hay `registrarDevolucionAction` pero es para repartidores
- ❌ **No reintegra stock:** No hay función para revertir venta y reintegrar stock/caja

**Requisito:** Devoluciones con reintegro a stock y caja  
**Actual:** No hay funcionalidad de devolución en POS

### 11. UX para Mostrador
- ⚠️ **Formulario tipo lista:** `NuevaVentaForm` es más para entrada manual
- ❌ **No optimizado:** No hay botones grandes, atajos de teclado
- ❌ **No hay vista rápida:** No hay vista tipo "botonera" de productos frecuentes
- ❌ **No hay teclas rápidas:** No hay atajos de teclado (ej: F1 para cobrar)

**Requisito:** Optimizado para desktop con teclado/mouse  
**Actual:** Formulario funcional pero no optimizado para velocidad

---

## 📊 Comparativa: Requisitos vs Implementación

| Requisito | Estado | Prioridad |
|-----------|--------|-----------|
| POS mostrador | ⚠️ Parcial | Alta |
| Métodos de pago (4 tipos) | ❌ Incompleto | Alta |
| Multipago | ❌ No implementado | Alta |
| Recargos por método | ❌ No implementado | Media |
| Venta genérica (sin cliente) | ❌ No implementado | Media |
| Lista de precios seleccionable | ⚠️ Existe pero no usado | Alta |
| IVA incluido + desglose | ❌ No implementado | Alta |
| Descuento stock FIFO | ✅ Implementado | Alta |
| Bloqueo crédito | ❌ No implementado | Alta |
| Apertura/cierre caja | ❌ No implementado | Alta |
| Movimiento de caja automático | ❌ No implementado | Alta |
| Impresión térmica | ❌ No implementado | Media |
| Devoluciones | ❌ No implementado | Media |
| Escáner código barras | ❌ No implementado | Media |
| UX optimizada mostrador | ⚠️ Mejorable | Media |

**Resumen:** 
- ✅ **6 funcionalidades** implementadas correctamente
- ⚠️ **3 funcionalidades** parcialmente implementadas
- ❌ **12 funcionalidades** faltantes completamente

---

## 🔧 Ajustes Necesarios

### Alta Prioridad (Críticos para Operación)

1. **Movimientos de Caja Automáticos**
   - Modificar `fn_registrar_venta_sucursal` para crear movimiento en `tesoreria_movimientos`
   - Actualizar `saldo_actual` de la caja
   - Registrar método de pago y monto

2. **Validación de Apertura de Caja**
   - Verificar que existe cierre abierto antes de permitir ventas
   - Bloquear POS si no hay cierre abierto

3. **Selector de Lista de Precios**
   - Agregar selector a `NuevaVentaForm`
   - Usar `obtenerPrecioProductoAction` para actualizar precios
   - Integrar con `registrarVentaSucursalConControlAction` (ya existe)

4. **Métodos de Pago Completos**
   - Agregar Mercado Pago a opciones
   - Implementar sistema de multipago (UI para dividir)
   - Implementar recargos configurables por método

5. **Validación de Límite de Crédito**
   - Verificar saldo y límite antes de permitir venta a cuenta corriente
   - Bloquear o advertir según configuración

6. **Cliente Opcional**
   - Hacer `clienteId` opcional en schema
   - Permitir crear venta genérica con cliente_id NULL
   - Ajustar función RPC para aceptar cliente NULL

### Media Prioridad (Mejoras de UX y Funcionalidad)

7. **Escáner de Código de Barras**
   - Input dedicado para captura rápida
   - Integrar con API de búsqueda por código
   - Auto-agregar producto al escanear

8. **Impresión Térmica**
   - Generar ticket/comprobante en formato 80mm
   - Integrar con impresoras térmicas (USB/serial/red)
   - Opción de reimpresión

9. **IVA y Facturación**
   - Agregar selector de tipo de comprobante (ticket/factura A/B)
   - Calcular y mostrar desglose de IVA
   - Integrar con `fn_crear_factura_desde_pedido` si es factura

10. **Devoluciones**
    - Botón "Devolver" en ventas del día
    - Modal/formulario de devolución
    - Función RPC para revertir venta y reintegrar stock/caja

11. **Optimización UX Mostrador**
    - Botones más grandes y accesibles
    - Atajos de teclado (F1 cobrar, F2 agregar producto, etc.)
    - Vista rápida de productos frecuentes
    - Feedback visual mejorado

---

## 📝 Recomendaciones de Implementación

### Fase 1: Funcionalidades Críticas (1-2 semanas)
1. Movimientos de caja automáticos
2. Validación apertura de caja
3. Selector de lista de precios
4. Métodos de pago completos (sin multipago)
5. Validación límite crédito
6. Cliente opcional

### Fase 2: Mejoras de Operación (1 semana)
7. Escáner de código de barras
8. Impresión térmica básica
9. IVA y selección de comprobante

### Fase 3: Funcionalidades Avanzadas (1 semana)
10. Multipago completo
11. Recargos por método
12. Devoluciones
13. Optimización UX mostrador

---

## 🧪 Pruebas Recomendadas

### Pruebas Manuales Básicas

1. **Venta Normal**
   - [ ] Seleccionar cliente
   - [ ] Agregar productos
   - [ ] Seleccionar lista de precios
   - [ ] Cobrar con efectivo
   - [ ] Verificar descuento de stock
   - [ ] Verificar movimiento de caja

2. **Venta Genérica**
   - [ ] Realizar venta sin seleccionar cliente
   - [ ] Verificar que se permite
   - [ ] Verificar registro correcto

3. **Métodos de Pago**
   - [ ] Cobrar con cada método (efectivo, transferencia, MP, tarjeta)
   - [ ] Verificar movimiento de caja correcto
   - [ ] Verificar recargos aplicados

4. **Control de Stock**
   - [ ] Vender producto con múltiples lotes
   - [ ] Verificar que usa FIFO correcto
   - [ ] Intentar vender más de stock disponible
   - [ ] Verificar bloqueo

5. **Control de Crédito**
   - [ ] Intentar venta a crédito con cliente sin límite
   - [ ] Intentar venta a crédito que excede límite
   - [ ] Verificar bloqueo

6. **Apertura/Cierre de Caja**
   - [ ] Intentar vender sin caja abierta
   - [ ] Verificar bloqueo
   - [ ] Abrir caja y realizar venta
   - [ ] Cerrar caja y verificar arqueo

7. **Escáner**
   - [ ] Escanear código de producto
   - [ ] Verificar que se agrega automáticamente

8. **Impresión**
   - [ ] Imprimir ticket
   - [ ] Imprimir factura A
   - [ ] Imprimir factura B

9. **Devolución**
   - [ ] Devolver venta reciente
   - [ ] Verificar reintegro de stock
   - [ ] Verificar reintegro de caja

---

## 📌 Conclusión

La página de ventas de sucursal **existe y tiene funcionalidad básica**, pero **NO está diseñada como un POS completo para mostrador**. Falta aproximadamente el **70% de las funcionalidades críticas** requeridas para operar como POS presencial.

**Funcionalidades clave faltantes:**
- Movimientos de caja automáticos (crítico)
- Validación de apertura de caja (crítico)
- Selector de lista de precios en formulario (crítico)
- Métodos de pago completos (crítico)
- Cliente opcional (importante)
- Control de crédito (importante)
- Escáner, impresión, IVA, devoluciones (mejoras)

**Recomendación:** Implementar funcionalidades de Fase 1 antes de poner en producción como POS de mostrador.

---

**Documento generado:** 16/12/2025  
**Última revisión de código:** 16/12/2025

