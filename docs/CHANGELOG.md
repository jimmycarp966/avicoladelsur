# Changelog - Avícola del Sur ERP


## 2026-01-08 — Antigravity
**Feat: Configuración de Desperdicios en Destinos de Producción**

Se agregaron controles en la interfaz de "Destinos de Producción" para gestionar la clasificación de productos como desperdicio:
- **Toggles UI**: Menú desplegable en cada producto asociado para marcar/desmarcar "Es Desperdicio" y "Es Desperdicio Sólido".
- **Visualización**: Icono de reciclaje ♻️ para identificar visualmente los productos marcados como desperdicio.
- **Acciones**: Integración con `actualizarDesperdicioProductoAction` para persistir los cambios.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/destinos/page.tsx`
- `ARCHITECTURE_SUMMARY.md`

**Refinamieto UI (Desperdicio vs Merma):**
Se ajustó el Resumen de Orden de Producción para separar explícitamente el **Desperdicio Sólido** (hueso, piel) de la **Merma Líquida** (pérdida de proceso), mejorando la claridad operativa.

---

## 2026-01-08 — Antigravity
**Feat: Módulo de Conciliación Bancaria Automática**

Se implementó un módulo completo para la conciliación de movimientos bancarios con pagos esperados:
- **Conciliación Inteligente**: Motor de reglas (Monto, Fecha, DNI/CUIT) + Integración con IA (Gemini) para casos complejos.
- **Importación Flexible**: Soporte para CSV, Excel y lectura visual de PDF/Imágenes mediante IA sin almacenamiento en disco.
- **UI Dedicada**: Dashboard de 3 columnas para revisión eficiente, página de importación y herramientas de conciliación masiva.
- **Seguridad**: Tablas con RLS restringidas a roles 'admin' y 'tesorero'.

**Archivos principales:**
- `src/app/tesoreria/conciliacion/*`
- `src/lib/conciliacion/motor-conciliacion.ts`
- `src/lib/conciliacion/gemini-matcher.ts`
- `src/actions/conciliacion.actions.ts`
- `supabase/migrations/20260107223000_conciliacion_bancaria.sql`

---


## 2026-01-07 — Antigravity
**Feat: Mejoras integrales Módulo Producción (Rendimientos, Predicciones, UI)**

Se implementaron mejoras para optimizar el flujo de producción y control de mermas:
- **Rendimientos Esperados**: Nueva tabla y configuración para definir rendimientos estándar por destino/producto/proveedor.
- **Predicción IA**: Sugerencia automática de pesos en "Entradas de Stock" basada en configuración histórica.
- **Alertas de Desviación**: Feedback visual inmediato (amarillo/rojo) al desviarse de la tolerancia configurada.
- **Navegación Libre**: Pestañas en Paso 3 para procesar destinos en cualquier orden.
- **Desperdicios Sólidos**: Flag para diferenciar desperdicios sólidos ("Piel") de merma líquida en el cálculo final.
- **Resumen Mejorado**: Visualización con tarjetas y alertas diferidas en el paso final.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`
- `src/app/(admin)/(dominios)/almacen/produccion/rendimientos/page.tsx`
- `src/actions/rendimientos.actions.ts`
- `src/actions/produccion.actions.ts`
- `supabase/migrations/20260107_rendimientos_esperados_produccion.sql`

---

## 2026-01-07 — Antigravity
**Fix: Pantalla negra en escáner móvil y separación lógica video/scanner**

Se implementó una solución robusta para el escaneo de códigos de barras en dispositivos móviles (iOS/Android) que soluciona la pantalla negra:
- **Gestión nativa del video**: El componente controla directamente el elemento `<video>` sin interferencia de la librería de escaneo.
- **Canvas decoding**: Los frames se capturan en un canvas invisible y se pasan manualmente al decodificador ZXing.
- **User Gesture**: Se requiere interacción explícita ("Iniciar Cámara") para cumplir políticas de autoplay de iOS.

**Archivos modificados:**
- `src/components/barcode/BarcodeScanner.tsx`

---

## 2026-01-05 — Gemini
**feat: Búsqueda en selectores de productos - Nueva Orden de Producción**

Agregado campo de búsqueda en los selectores de productos de `/almacen/produccion/nueva`:
- **Paso 2 (Salidas Stock)**: Filtrar productos por código o nombre
- **Paso 3 (Entradas Stock)**: Filtrar productos por código o nombre

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`

---

## 2026-01-05 — Gemini
**Fix: Página de notificaciones quedaba en "Cargando..."**

La página `/notificaciones` se quedaba en estado de carga infinita porque la tabla `notificaciones` no tenía el campo `categoria` que la UI esperaba.

**Cambios:**
- Agregada migración `20260105_agregar_categoria_notificaciones.sql` que añade el campo `categoria` a la tabla `notificaciones`

**Acción requerida:** Ejecutar la migración en Supabase SQL Editor.

---

## 2026-01-05 — Daniel
**Optimización del escáner de códigos de barras**

Se mejoró el componente `BarcodeScanner.tsx` con las siguientes optimizaciones:

- Reducción del intervalo de escaneo de 100ms a 50ms para mayor velocidad
- Implementación de debounce (1.5s) para evitar escaneos duplicados
- Agregado control de antorcha/flash para condiciones de poca luz
- Vibración táctil al detectar código (feedback para el usuario)
- Mayor resolución de cámara (hasta 1920x1080)
- Mejor configuración de enfoque continuo, exposición y balance de blancos
- Guía visual mejorada con esquinas verdes destacadas
- Mejor detección de cámara trasera en diferentes dispositivos/idiomas
- Manejo de error `OverconstrainedError` para dispositivos con limitaciones

**Archivos modificados:**
- `src/components/barcode/BarcodeScanner.tsx`

---

## 2026-01-05 — Daniel
**Fix: Error de TypeScript con propiedad 'torch'**

Se corrigió el error de TypeScript `"Object literal may only specify known properties, and 'torch' does not exist in type 'MediaTrackConstraintSet'"` mediante un cast explícito a `MediaTrackConstraints`.

La propiedad `torch` es una API experimental de navegadores (Chrome/Android) que no está en los tipos oficiales de TypeScript, pero funciona correctamente en runtime.

**Archivos modificados:**
- `src/components/barcode/BarcodeScanner.tsx`

---

## 2026-01-05 — Gemini
**feat: Flujo secuencial y filtrado de destinos en Orden de Producción**

Se refinó el proceso de "Nueva Orden de Producción" implementando un flujo secuencial estricto por destino:
- **Lógica paso a paso**: Se procesan los destinos de uno en uno (ej. Filet -> Pechuga).
- **Filtrado contextual**: El selector de productos de entrada (generados) ahora muestra únicamente los productos permitidos para el destino activo.
- **Corrección de estado**: Refactorización de `handleAgregarEntrada` y `useEffect` correspondiente para usar `currentDestinoId` y garantizar la integridad de datos.
- **Feedback visual**: Mensajes de éxito que confirman el destino afectado.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`
- `ARCHITECTURE_SUMMARY.md`
