# Changelog - Avicola del Sur ERP
## 2026-02-26 - Codex
**Feat(rrhh): autovinculacion Hik + backfill operativo de asistencia**

Se documenta la entrega para estabilizar la integracion RRHH con Hikvision:

- **Mapeo persistente Hik -> RRHH**:
  - Nueva tabla `public.rrhh_hik_person_map` para guardar vinculaciones estables entre `personCode/employeeNo` y `rrhh_empleados`.
  - El mapeo queda unificado para consulta de horarios y procesos de liquidacion automatica.
- **Backfill operativo**:
  - Se agrega script `scripts/rrhh-hik-backfill.js` para reprocesar rangos historicos de marcaciones.
  - Nuevo comando: `npm run rrhh:hik:backfill -- --from=YYYY-MM-DD --to=YYYY-MM-DD --apply`.
  - Soporta modo dry-run y opcion para no crear placeholders (`--no-create-placeholders`).
- **Resguardo funcional**:
  - Si `rrhh_hik_person_map` aun no existe, se mantiene fallback por `HIK_CONNECT_PERSON_MAP`.
- **Migraciones SQL aplicadas**:
  - `supabase/migrations/20260226_rrhh_fix_origen_auto_licencia_descanso.sql`
  - `supabase/migrations/20260228_rrhh_hik_person_map.sql`

**Archivos principales modificados:**
- `hikvision.md`
- `package.json`
- `scripts/rrhh-hik-backfill.js`
- `src/actions/rrhh-horarios.actions.ts`
- `src/lib/services/hik-mapping.service.ts`
- `src/lib/services/rrhh-liquidaciones-automaticas.ts`
- `supabase/migrations/20260226_rrhh_fix_origen_auto_licencia_descanso.sql`
- `supabase/migrations/20260228_rrhh_hik_person_map.sql`

---
## 2026-02-18 - Codex
**Feat: Tesoreria por sucursal + combustible y mantenimiento de reparto**

Se documentan los cambios funcionales y de datos implementados para tesoreria, reparto y vehiculos:

- **Tesoreria**:
  - Vista operativa unificada en `/tesoreria/por-sucursal` y ajustes de navegacion.
  - Renombre funcional de "deposito bancario" a "transferencia" en el flujo de movimientos.
  - "Promesas del dia" en cuentas corrientes y nuevo campo horario `hora_proximo_contacto` (operativa GMT-3).
- **Reparto / Cierre de ruta**:
  - Al finalizar una ruta se registra si hubo carga de combustible.
  - Si hubo carga, se registran litros y se calcula consumo `km/l` con formula `km_recorridos / litros_cargados`.
  - El resultado queda persistido para reportes de ruta.
- **Vehiculos y checklist**:
  - Validaciones de vigencia para seguro y campos independientes de vencimiento `SENASA` y `VTV`.
  - Nuevo dato de `km_inicial` por vehiculo (carga unica), mas capacidad/litros actuales de combustible.
  - Nueva pagina de programacion de mantenimiento por vehiculo.
  - Checklist actualizado: aceite en pasos de 10, limpieza interior/exterior (mala|buena|excelente), luces observacion libre y presion PSI numerica.

**Migracion SQL aplicada:**
- `supabase/migrations/20260218110000_reparto_tesoreria_combustible_recordatorios.sql`

**Archivos principales modificados:**
- `src/actions/reparto.actions.ts`
- `src/actions/reportes-reparto.actions.ts`
- `src/actions/tesoreria.actions.ts`
- `src/app/(admin)/(dominios)/reparto/vehiculos/[id]/mantenimiento/page.tsx`
- `src/app/(admin)/(dominios)/tesoreria/por-sucursal/page.tsx`
- `src/app/(repartidor)/ruta/[ruta_id]/ruta-hoja-content.tsx`
- `src/components/tables/VehiculosTable.tsx`
- `src/lib/schemas/reparto.schema.ts`
- `src/types/domain.types.ts`
- `supabase/migrations/20260218110000_reparto_tesoreria_combustible_recordatorios.sql`

---
## 2026-02-17 - Codex
**Feat: Cierre operativo transversal (RRHH, Ventas, Almacen, Sucursales, Notificaciones)**

Se implemento un paquete de mejoras funcionales y de UX/UI solicitado para cerrar el flujo operativo diario:

- **RRHH / Licencias**:
  - Alta de licencias con validacion asistida por IA sobre imagen de certificado.
  - Si no hay certificado, la licencia no se valida.
  - Nuevo flujo de auditoria: si la IA no puede validar con certeza, queda en `pendiente` para revision manual por RRHH.
  - Regla operativa de plazo: presentacion de certificado dentro de 24 hs (con excepciones gestionadas por RRHH).
- **Tesoreria / Proveedores**:
  - Vista de proveedor reforzada con deuda, pagos e historial de movimientos.
  - Sincronizacion operativa entre `almacen/recepcion` y proveedores.
- **Almacen / Recepcion**:
  - Rehecha la pagina de recepcion para mejorar usabilidad y consistencia de datos.
  - Endpoint y acciones ajustadas para sincronizar recepciones con movimientos de proveedor.
- **Notificaciones**:
  - Configuracion por area (ventas, almacen, rrhh).
  - Filtros y activacion por categoria con verificacion funcional de carga.
- **Ventas / Comprobantes**:
  - Se renombra la experiencia de facturacion a **Comprobantes**.
  - Nueva numeracion para emisiones nuevas: `COMP-000000001` (reemplaza prefijo `FAC` en nuevas emisiones).
  - Ajustes de tabla/listado para reflejar el nuevo formato visual.
- **Sucursales y Transferencias**:
  - En detalle de sucursal se agrega codigo visible en inventario.
  - En transferencias se muestra detalle de sucursal y en informacion general se agrega `solicitado_por` automatico.
- **En preparacion (Almacen)**:
  - Orden/filtro para priorizar presupuestos mas antiguos primero.
- **Sesion**:
  - Verificaciones y ajustes en cierre de sesion para mejorar consistencia del boton logout en todos los roles.

**Archivos principales modificados:**
- `src/actions/rrhh.actions.ts`
- `src/app/(admin)/(dominios)/rrhh/licencias/nueva/licencia-form.tsx`
- `src/app/(admin)/(dominios)/rrhh/licencias/page.tsx`
- `src/actions/proveedores.actions.ts`
- `src/actions/almacen.actions.ts`
- `src/app/(admin)/(dominios)/almacen/recepcion/page.tsx`
- `src/app/(admin)/(dominios)/almacen/recepcion/recepcion-almacen-form.tsx`
- `src/app/(admin)/(dominios)/almacen/recepcion/recepcion-almacen-lista.tsx`
- `src/app/api/almacen/recepcion/route.ts`
- `src/app/(admin)/notificaciones/page.tsx`
- `src/app/(admin)/notificaciones/configuracion/page.tsx`
- `src/app/(admin)/(dominios)/ventas/comprobantes/page.tsx`
- `src/components/tables/FacturasTable.tsx`
- `src/components/layout/admin/AdminSidebar.tsx`
- `src/app/(admin)/(dominios)/sucursales/[id]/page.tsx`
- `src/components/sucursales/TransferenciaForm.tsx`
- `src/actions/en-preparacion.actions.ts`
- `src/components/auth/LogoutButton.tsx`
- `src/lib/auth/logout.ts`
- `supabase/migrations/20260217100000_rrhh_licencias_certificados_ia.sql`
- `supabase/migrations/20260217101000_recepcion_proveedores_sync.sql`
- `supabase/migrations/20260217102000_numeracion_comprobantes.sql`

---
## 2026-02-13 - Codex
**Docs: Aclaracion de integracion Hikvision RRHH (marcaciones por API)**

Se actualizo la documentacion operativa de marcaciones para dejar explicito:

- La fuente de marcaciones es la API de Hikvision (Hik-Connect), no una tabla local garantizada en Supabase.
- El estado "No mapeado" depende de la correspondencia entre `employeeNo`/`personCode` y RRHH.
- Recomendacion de usar un identificador dedicado `hik_person_code` para el mapeo estable (sin sobrecargar `dni`).
- Reglas de validacion de calidad de datos para eventos incompletos.

**Archivos modificados:**
- `hikvision.md`
- `docs/CHANGELOG.md`
- `docs/last_update.md`

---

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





