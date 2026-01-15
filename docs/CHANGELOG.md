# Changelog - Avícola del Sur ERP

## 2026-01-14 — Antigravity
**Feat: Optimización Bot WhatsApp & Registro de Clientes**

Se implementaron mejoras críticas en el flujo de ventas vía WhatsApp y el registro de nuevos clientes:

- **Registro de Clientes con códigos numéricos consecutivos**: Ahora el sistema busca automáticamente el último código numérico y asigna el siguiente (ej: 1500 -> 1501).
- **Geocodificación PostGIS**: Al registrar un cliente desde el bot, la dirección se geocodifica automáticamente para obtener coordenadas de entrega.
- **Asignación de zona_id**: Corrección en el INSERT de clientes para persistir correctamente el ID de la zona.
- **Toma de pedidos con lectura dinámica de productos**: El bot ahora consulta la lista real de productos activos de Supabase, eliminando la dependencia de listas estáticas/mockeadas.
- **Búsqueda Inteligente de Productos (`findProductoByCode`)**: Búsqueda en 3 pasos (Código exacto -> Nombre parcial -> Prefijo) para maximizar la resolución de items mencionados por el cliente.
- **Lógica de Insistencia**: El bot ahora solicita productos explícitamente si detecta intención de pedido sin items válidos.

**Archivos modificados:**
- `src/app/api/bot/route.ts` (Zonas con localidades, findProductoByCode, lógica de registro)
- `src/actions/ventas.actions.ts` (crearClienteDesdeBotAction con zona_id, coordenadas y códigos consecutivos)
- `src/lib/vertex/agent.ts` (extraerProductosDelMensaje dinámico e insistencia en pedidos)
- `src/lib/vertex/prompts/system-prompt.ts` (Actualización de instrucciones de productos)

---


## 2026-01-14 — Antigravity
**Feat: ORS Optimization API - Optimización Inteligente de Rutas de Reparto**

Se integró OpenRouteService (ORS) Optimization API para calcular el orden óptimo de visitas en las rutas de reparto, considerando calles reales de OpenStreetMap:

- **ORS Optimization**: Nueva función `optimizeRouteORS()` que usa el algoritmo VROOM (TSP solver) para reordenar paradas.
- **Fallback Chain**: ORS → Google Directions → Local optimizer.
- **Sincronización de Marcadores**: Los números en el mapa ahora reflejan el orden de visita optimizado, no el orden original de la base de datos.
- **Logs Detallados**: Consola muestra orden original vs optimizado para verificación.

**Ventajas:**
- Rutas más cortas y rápidas
- Considera sentidos de calle (editados por el usuario en OSM)
- Considera restricciones de tránsito reales

**Archivos modificados:**
- `src/lib/rutas/ors-directions.ts` (funciones `optimizeRouteORS`, `getOptimizedRoute`)
- `src/components/reparto/MonitorMap.tsx` (sincronización de orden optimizado)
- `src/lib/services/ruta-optimizer.ts` (ORS como proveedor principal, Google como fallback)

---

## 2026-01-12 — Antigravity
**Fix: Conversión de Pedidos Mayoristas Pesables**

Se corrigió un error crítico en la conversión de presupuestos a pedidos donde los productos pesables vendidos a clientes mayoristas ignoraban el peso real de balanza y aplicaban incorrectamente una conversión fija por bulto (ej. 1 caja = 10kg).

- **Lógica corregida**: `fn_convertir_presupuesto_a_pedido` ahora prioriza `peso_final` si el item es pesable, incluso para clientes mayoristas.
- **Visualización mejorada**: `fn_obtener_pedido_completo` actualizado para agrupar correctamente productos y mostrar pesos reales en el resumen del pedido.
- **Corrección de datos**: Se ejecutó un script para corregir los pedidos afectados por este error.

**Archivos modificados:**
- `supabase/migrations/20260112_fix_conversion_mayorista_pesable.sql` (NUEVO - Hotfix)
- `supabase/migrations/20260112_fix_obtener_pedido_completo_v2.sql` (NUEVO - Fix Agrupación)
- `src/app/(admin)/(dominios)/almacen/pedidos/[id]/page.tsx` (Lógica de agrupación visual)

---

**Feat: Unificación de Zonas y Migración a Lista Mayorista**

Se implementaron mejoras críticas en la lógica de ventas y reparto para simplificar la toma de pedidos y garantizar consistencia en las zonas:
- **Auto-selección Inteligente**: El formulario de "Nuevo Presupuesto" ahora auto-aplica la zona (`zona_id`) y la lista de precios configurada en el cliente al seleccionarlo.
- **Unificación de Zonas**: Se simplificó la lógica en `presupuesto-form.tsx` para usar estrictamente la relación de base de datos, eliminando fallbacks de texto legacy.
- **Migración Masiva de Datos**: Ejecución de script SQL para asignar la lista **MAYORISTA** a todos los clientes activos (204 procesados), desactivando listas secundarias para estandarizar la operación.
- **UI de Preparación**: Corrección de lógica en botones `PresupuestosDiaAcciones.tsx` para validar pesajes pendientes usando la lógica unificada (`esItemPesable`).
- **Arquitectura**: Actualización de diagramas y documentos de arquitectura para reflejar la nueva lógica de auto-aplicación.

**Archivos modificados:**
- `src/actions/almacen.actions.ts`
- `src/actions/presupuestos-dia.actions.ts`
- `src/app/(admin)/(dominios)/almacen/presupuesto/[id]/pesaje/page.tsx`
- `src/components/almacen/PresupuestosDiaAcciones.tsx`
- `supabase/migrations/20260112_fix_logica_pesable_con_requiere_pesaje.sql` (NUEVO)
- `src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/presupuesto-form.tsx`
- `supabase/migrations/20260112_unificar_listas_mayorista.sql` (NUEVO)
- `ARCHITECTURE_SUMMARY.md`
- `ARCHITECTURE.MD`
- `docs/diagrams/architecture.mmd` (NUEVO)

---
**Fix: Restauración de Tablas de Gastos y Migración**

Se corrigió una inconsistencia crítica en la base de datos donde las tablas `gastos` habían desaparecido. La migración de proveedores se ajustó para:
- Recrear `gastos` y `gastos_categorias` si no existen.
- Aplicar correctamente la columna `proveedor_id`.

**Archivos modificados:**
- `supabase/migrations/20260110_proveedores_financiero.sql`

---

## 2026-01-10 — Antigravity
**Feat: Finalización Módulo Tesorería (Proveedores, KPIs, Retiros)**

Se completó integralmente el módulo de Tesorería con enfoque en la gestión financiera de proveedores y control de flujos de efectivo:

1. **Gestión Financiera de Proveedores**:
   - Backend: Nuevas tablas `proveedores_facturas` y `proveedores_pagos`.
   - UI: Tablas de deuda, registro de facturas y pagos (parciales/totales).
   - Vinculación: Opción para asociar gastos generales a proveedores específicos.

2. **Dashboard Ejecutivo Enriquecido**:
   - Nuevos KPIs: "Tesoro Total", "Deuda Proveedores", "Clientes Morosos".
   - Panel de Alertas Financieras para gestión proactiva.

3. **Control de Retiros en Tránsito**:
   - Tracking de remesas desde sucursal pendientes de validación.
   - Alertas visuales para retiros demorados (>24hs).

**Archivos modificados:**
- `src/app/(admin)/(dominios)/tesoreria/**/*`
- `src/actions/tesoreria.actions.ts`
- `src/components/forms/GastoForm.tsx`
- `supabase/migrations/20260110_proveedores_financiero.sql`

---

## 2026-01-09 — Antigravity
**Feat: Mejoras Integrales Módulo Tesorería**

Se implementaron tres nuevos submódulos para completar la gestión financiera:

1. **Módulo de Proveedores** (`/tesoreria/proveedores`):
   - Nueva tabla `proveedores` con RLS y CRUD completo.
   - UI con página, tabla filtrable y dialog de creación.
   - Enlace agregado en sidebar de Tesorería.

2. **Retiros de Sucursales** (`rutas_retiros`):
   - Tabla para tracking de efectivo transportado por choferes.
   - Flujo: Egreso inmediato en sucursal → Ingreso en Casa Central al validar ruta.
   - Dialog `NuevoRetiroDialog` en Tesorería por Sucursal.

3. **Gestión de Moratoria** (`clientes_recordatorios`):
   - Bitácora de gestión de cobranza con historial de contactos.
   - Clasificación semáforo (verde/amarillo/rojo) de clientes morosos.
   - Dialog `RecordatoriosDialog` integrado en Cuentas Corrientes.

**Archivos nuevos:**
- `src/actions/proveedores.actions.ts`
- `src/app/(admin)/(dominios)/tesoreria/proveedores/*`
- `src/app/(admin)/(dominios)/tesoreria/sucursales/nuevo-retiro-dialog.tsx`
- `src/app/(admin)/(dominios)/tesoreria/cuentas-corrientes/recordatorios-dialog.tsx`

**Migraciones aplicadas:**
- `add_proveedores_table`
- `add_rutas_retiros_table`
- `add_clientes_recordatorios_table`

---

## 2026-01-09 — Antigravity
**Feat: Migración y Automatización de Listas de Precios**

Se completó la migración masiva y automatización de listas de precios para mejorar el flujo de ventas:
- **Migración de Datos**: Todos los clientes activos ahora tienen asignada la "Lista Mayorista" por defecto (si no tenían otra).
- **Automatización UI**: El formulario de "Nuevo Presupuesto" detecta y preselecciona automáticamente la lista de precios asignada al cliente (priorizando la más importante).
- **Fallback Automático**: Si un cliente no tiene lista, se intenta asignar "Mayorista" automáticamente.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/presupuesto-form.tsx`
- `src/actions/listas-precios.actions.ts`
- `scripts/migrate-clientes-mayorista.ts` (Scripts)

---

## 2026-01-09 — Antigravity
**Feat: Reportes de Producción Inteligentes + Validaciones ERP**

Implementación de reportes de producción con análisis inteligente y múltiples validaciones en el módulo ERP:

1. **Reportes de Producción** (`/reportes/produccion`):
   - Nueva función `obtenerEstadisticasProduccionAction` con métricas de merma, eficiencia y desperdicios
   - Dashboard KPIs: Órdenes completadas, Eficiencia %, Merma Líquida, Desperdicio Sólido
   - Tendencias visuales (últimos 14 días), Top 10 productos y rendimiento por destino
   - Alertas inteligentes automáticas (merma >15% o eficiencia <80%)

2. **Validación Producción Paso 3**: Función `validarDestinosCompletos()` bloquea finalización si hay destinos sin productos

3. **Impresión Parcial Lista Preparación**: Componente `PrintPreparacionParcial` para imprimir productos pendientes de pesaje

4. **Validación Barcode Pesajes**: Handler `handleScan` valida coincidencia PLU vs código producto

5. **Campo requiere_pesaje**: Nuevo campo en schema de productos para forzar pesaje incluso en mayorista

**Archivos principales:**
- `src/app/(admin)/(dominios)/reportes/produccion/page.tsx` (NUEVO)
- `src/app/(admin)/(dominios)/reportes/produccion/produccion-reporte-content.tsx` (NUEVO)
- `src/actions/produccion.actions.ts`
- `src/components/almacen/PrintPreparacionParcial.tsx` (NUEVO)
- `src/components/almacen/PesajeItemCard.tsx`
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`

---

## 2026-01-08 — Antigravity
**Fix: RLS en Rutas de Reparto y Coordenadas PostGIS**


Se corrigió un error que impedía crear rutas de reparto desde la interfaz de usuario:
- **RLS `rutas_reparto`**: Agregadas políticas `SELECT`, `INSERT`, `UPDATE` y `DELETE` para usuarios autenticados.
- **RLS `detalles_ruta`**: Agregadas políticas `SELECT`, `INSERT`, `UPDATE` y `DELETE` para usuarios autenticados.
- **Función RPC `fn_get_cliente_con_coordenadas`**: Corregida para extraer lat/lng desde tipo **PostGIS geometry** usando `ST_Y()` y `ST_X()` (antes fallaba tratando coordenadas como JSONB).
- **Optimización de rutas**: Ahora funciona correctamente con Google Directions API.

**Scripts SQL ejecutados directamente en Supabase:**
```sql
-- Políticas RLS rutas_reparto
CREATE POLICY "rutas_reparto_select_authenticated" ON rutas_reparto FOR SELECT TO authenticated USING (true);
CREATE POLICY "rutas_reparto_update_authenticated" ON rutas_reparto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Políticas RLS detalles_ruta  
CREATE POLICY "detalles_ruta_select_authenticated" ON detalles_ruta FOR SELECT TO authenticated USING (true);
CREATE POLICY "detalles_ruta_insert_authenticated" ON detalles_ruta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "detalles_ruta_update_authenticated" ON detalles_ruta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "detalles_ruta_delete_authenticated" ON detalles_ruta FOR DELETE TO authenticated USING (true);

-- Fix función coordenadas PostGIS
CREATE OR REPLACE FUNCTION fn_get_cliente_con_coordenadas(p_cliente_id UUID) ...
  ST_Y(c.coordenadas::geometry) as lat,
  ST_X(c.coordenadas::geometry) as lng,
...
```

---

## 2026-01-08 — Antigravity
**Feat: Alias Bancarios para Clientes y Hard Delete**

Se implementó sistema de Identificadores Adicionales (Alias) en Clientes para mejorar la conciliación bancaria inteligente:
- **Base de Datos**: Nueva tabla `clientes_identificadores_adicionales`.
- **UI Cliente**: Sección en formulario para gestionar múltiples DNIs y nombres (ej: cónyuges).
- **Backend Conciliación**: Motor de matching actualizado para buscar por alias y validar nombres alternativos. Ahora persiste etiquetas de matching y permite validación manual sin cliente asignado.
- **Gestión Clientes**: Implementado Hard Delete (borrado físico) con limpieza manual de dependencias (`auditoria_listas_precios`, `identificadores`) para eliminación real de registros.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/ventas/clientes/*`
- `src/actions/ventas.actions.ts`
- `src/lib/conciliacion/cliente-lookup.ts`
- `src/actions/conciliacion.actions.ts`
- `src/components/forms/ClienteForm.tsx`
- `docs/diagrams/architecture.mmd`

---

## 2026-01-08 — Antigravity
**Feat: Configuración de Desperdicios en Destinos de Producción**

Se agregaron controles en la interfaz de "Destinos de Producción" para gestionar la clasificación de productos como desperdicio:
- **Toggles UI**: Menú desplegable en cada producto asociado para marcar/desmarcar "Es Desperdicio" y "Es Desperdicio Sólido".
- **Visualización**: Icono de reciclaje ♻️ para identificar visualmente los productos marcados como desperdicio.
- **Acciones**: Integración con `actualizarDesperdicioProductoAction` para persistir los cambios.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/destinos/page.tsx`
- `ARCHITECTURE_SUMMARY.md`

**Refinamiento UI (Desperdicio vs Merma):**
- Separación visual de "Desperdicio Sólido" y "Merma de Proceso" en el resumen de orden.
- Corrección de cálculo de merma líquida.
- Configuración de flags `es_desperdicio` en destinos.

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
