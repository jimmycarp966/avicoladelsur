# Changelog - AvÃ­cola del Sur ERP
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

## 2026-01-14 â€” Antigravity
**Feat: OptimizaciÃ³n Bot WhatsApp & Registro de Clientes**

Se implementaron mejoras crÃ­ticas en el flujo de ventas vÃ­a WhatsApp y el registro de nuevos clientes:

- **Registro de Clientes con cÃ³digos numÃ©ricos consecutivos**: Ahora el sistema busca automÃ¡ticamente el Ãºltimo cÃ³digo numÃ©rico y asigna el siguiente (ej: 1500 -> 1501).
- **GeocodificaciÃ³n PostGIS**: Al registrar un cliente desde el bot, la direcciÃ³n se geocodifica automÃ¡ticamente para obtener coordenadas de entrega.
- **AsignaciÃ³n de zona_id**: CorrecciÃ³n en el INSERT de clientes para persistir correctamente el ID de la zona.
- **Toma de pedidos con lectura dinÃ¡mica de productos**: El bot ahora consulta la lista real de productos activos de Supabase, eliminando la dependencia de listas estÃ¡ticas/mockeadas.
- **BÃºsqueda Inteligente de Productos (`findProductoByCode`)**: BÃºsqueda en 3 pasos (CÃ³digo exacto -> Nombre parcial -> Prefijo) para maximizar la resoluciÃ³n de items mencionados por el cliente.
- **LÃ³gica de Insistencia**: El bot ahora solicita productos explÃ­citamente si detecta intenciÃ³n de pedido sin items vÃ¡lidos.

**Archivos modificados:**
- `src/app/api/bot/route.ts` (Zonas con localidades, findProductoByCode, lÃ³gica de registro)
- `src/actions/ventas.actions.ts` (crearClienteDesdeBotAction con zona_id, coordenadas y cÃ³digos consecutivos)
- `src/lib/vertex/agent.ts` (extraerProductosDelMensaje dinÃ¡mico e insistencia en pedidos)
- `src/lib/vertex/prompts/system-prompt.ts` (ActualizaciÃ³n de instrucciones de productos)

---


## 2026-01-14 â€” Antigravity
**Feat: ORS Optimization API - OptimizaciÃ³n Inteligente de Rutas de Reparto**

Se integrÃ³ OpenRouteService (ORS) Optimization API para calcular el orden Ã³ptimo de visitas en las rutas de reparto, considerando calles reales de OpenStreetMap:

- **ORS Optimization**: Nueva funciÃ³n `optimizeRouteORS()` que usa el algoritmo VROOM (TSP solver) para reordenar paradas.
- **Fallback Chain**: ORS â†’ Google Directions â†’ Local optimizer.
- **SincronizaciÃ³n de Marcadores**: Los nÃºmeros en el mapa ahora reflejan el orden de visita optimizado, no el orden original de la base de datos.
- **Logs Detallados**: Consola muestra orden original vs optimizado para verificaciÃ³n.

**Ventajas:**
- Rutas mÃ¡s cortas y rÃ¡pidas
- Considera sentidos de calle (editados por el usuario en OSM)
- Considera restricciones de trÃ¡nsito reales

**Archivos modificados:**
- `src/lib/rutas/ors-directions.ts` (funciones `optimizeRouteORS`, `getOptimizedRoute`)
- `src/components/reparto/MonitorMap.tsx` (sincronizaciÃ³n de orden optimizado)
- `src/lib/services/ruta-optimizer.ts` (ORS como proveedor principal, Google como fallback)

---

## 2026-01-12 â€” Antigravity
**Fix: ConversiÃ³n de Pedidos Mayoristas Pesables**

Se corrigiÃ³ un error crÃ­tico en la conversiÃ³n de presupuestos a pedidos donde los productos pesables vendidos a clientes mayoristas ignoraban el peso real de balanza y aplicaban incorrectamente una conversiÃ³n fija por bulto (ej. 1 caja = 10kg).

- **LÃ³gica corregida**: `fn_convertir_presupuesto_a_pedido` ahora prioriza `peso_final` si el item es pesable, incluso para clientes mayoristas.
- **VisualizaciÃ³n mejorada**: `fn_obtener_pedido_completo` actualizado para agrupar correctamente productos y mostrar pesos reales en el resumen del pedido.
- **CorrecciÃ³n de datos**: Se ejecutÃ³ un script para corregir los pedidos afectados por este error.

**Archivos modificados:**
- `supabase/migrations/20260112_fix_conversion_mayorista_pesable.sql` (NUEVO - Hotfix)
- `supabase/migrations/20260112_fix_obtener_pedido_completo_v2.sql` (NUEVO - Fix AgrupaciÃ³n)
- `src/app/(admin)/(dominios)/almacen/pedidos/[id]/page.tsx` (LÃ³gica de agrupaciÃ³n visual)

---

**Feat: UnificaciÃ³n de Zonas y MigraciÃ³n a Lista Mayorista**

Se implementaron mejoras crÃ­ticas en la lÃ³gica de ventas y reparto para simplificar la toma de pedidos y garantizar consistencia en las zonas:
- **Auto-selecciÃ³n Inteligente**: El formulario de "Nuevo Presupuesto" ahora auto-aplica la zona (`zona_id`) y la lista de precios configurada en el cliente al seleccionarlo.
- **UnificaciÃ³n de Zonas**: Se simplificÃ³ la lÃ³gica en `presupuesto-form.tsx` para usar estrictamente la relaciÃ³n de base de datos, eliminando fallbacks de texto legacy.
- **MigraciÃ³n Masiva de Datos**: EjecuciÃ³n de script SQL para asignar la lista **MAYORISTA** a todos los clientes activos (204 procesados), desactivando listas secundarias para estandarizar la operaciÃ³n.
- **UI de PreparaciÃ³n**: CorrecciÃ³n de lÃ³gica en botones `PresupuestosDiaAcciones.tsx` para validar pesajes pendientes usando la lÃ³gica unificada (`esItemPesable`).
- **Arquitectura**: ActualizaciÃ³n de diagramas y documentos de arquitectura para reflejar la nueva lÃ³gica de auto-aplicaciÃ³n.

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
**Fix: RestauraciÃ³n de Tablas de Gastos y MigraciÃ³n**

Se corrigiÃ³ una inconsistencia crÃ­tica en la base de datos donde las tablas `gastos` habÃ­an desaparecido. La migraciÃ³n de proveedores se ajustÃ³ para:
- Recrear `gastos` y `gastos_categorias` si no existen.
- Aplicar correctamente la columna `proveedor_id`.

**Archivos modificados:**
- `supabase/migrations/20260110_proveedores_financiero.sql`

---

## 2026-01-10 â€” Antigravity
**Feat: FinalizaciÃ³n MÃ³dulo TesorerÃ­a (Proveedores, KPIs, Retiros)**

Se completÃ³ integralmente el mÃ³dulo de TesorerÃ­a con enfoque en la gestiÃ³n financiera de proveedores y control de flujos de efectivo:

1. **GestiÃ³n Financiera de Proveedores**:
   - Backend: Nuevas tablas `proveedores_facturas` y `proveedores_pagos`.
   - UI: Tablas de deuda, registro de facturas y pagos (parciales/totales).
   - VinculaciÃ³n: OpciÃ³n para asociar gastos generales a proveedores especÃ­ficos.

2. **Dashboard Ejecutivo Enriquecido**:
   - Nuevos KPIs: "Tesoro Total", "Deuda Proveedores", "Clientes Morosos".
   - Panel de Alertas Financieras para gestiÃ³n proactiva.

3. **Control de Retiros en TrÃ¡nsito**:
   - Tracking de remesas desde sucursal pendientes de validaciÃ³n.
   - Alertas visuales para retiros demorados (>24hs).

**Archivos modificados:**
- `src/app/(admin)/(dominios)/tesoreria/**/*`
- `src/actions/tesoreria.actions.ts`
- `src/components/forms/GastoForm.tsx`
- `supabase/migrations/20260110_proveedores_financiero.sql`

---

## 2026-01-09 â€” Antigravity
**Feat: Mejoras Integrales MÃ³dulo TesorerÃ­a**

Se implementaron tres nuevos submÃ³dulos para completar la gestiÃ³n financiera:

1. **MÃ³dulo de Proveedores** (`/tesoreria/proveedores`):
   - Nueva tabla `proveedores` con RLS y CRUD completo.
   - UI con pÃ¡gina, tabla filtrable y dialog de creaciÃ³n.
   - Enlace agregado en sidebar de TesorerÃ­a.

2. **Retiros de Sucursales** (`rutas_retiros`):
   - Tabla para tracking de efectivo transportado por choferes.
   - Flujo: Egreso inmediato en sucursal â†’ Ingreso en Casa Central al validar ruta.
   - Dialog `NuevoRetiroDialog` en TesorerÃ­a por Sucursal.

3. **GestiÃ³n de Moratoria** (`clientes_recordatorios`):
   - BitÃ¡cora de gestiÃ³n de cobranza con historial de contactos.
   - ClasificaciÃ³n semÃ¡foro (verde/amarillo/rojo) de clientes morosos.
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

## 2026-01-09 â€” Antigravity
**Feat: MigraciÃ³n y AutomatizaciÃ³n de Listas de Precios**

Se completÃ³ la migraciÃ³n masiva y automatizaciÃ³n de listas de precios para mejorar el flujo de ventas:
- **MigraciÃ³n de Datos**: Todos los clientes activos ahora tienen asignada la "Lista Mayorista" por defecto (si no tenÃ­an otra).
- **AutomatizaciÃ³n UI**: El formulario de "Nuevo Presupuesto" detecta y preselecciona automÃ¡ticamente la lista de precios asignada al cliente (priorizando la mÃ¡s importante).
- **Fallback AutomÃ¡tico**: Si un cliente no tiene lista, se intenta asignar "Mayorista" automÃ¡ticamente.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/presupuesto-form.tsx`
- `src/actions/listas-precios.actions.ts`
- `scripts/migrate-clientes-mayorista.ts` (Scripts)

---

## 2026-01-09 â€” Antigravity
**Feat: Reportes de ProducciÃ³n Inteligentes + Validaciones ERP**

ImplementaciÃ³n de reportes de producciÃ³n con anÃ¡lisis inteligente y mÃºltiples validaciones en el mÃ³dulo ERP:

1. **Reportes de ProducciÃ³n** (`/reportes/produccion`):
   - Nueva funciÃ³n `obtenerEstadisticasProduccionAction` con mÃ©tricas de merma, eficiencia y desperdicios
   - Dashboard KPIs: Ã“rdenes completadas, Eficiencia %, Merma LÃ­quida, Desperdicio SÃ³lido
   - Tendencias visuales (Ãºltimos 14 dÃ­as), Top 10 productos y rendimiento por destino
   - Alertas inteligentes automÃ¡ticas (merma >15% o eficiencia <80%)

2. **ValidaciÃ³n ProducciÃ³n Paso 3**: FunciÃ³n `validarDestinosCompletos()` bloquea finalizaciÃ³n si hay destinos sin productos

3. **ImpresiÃ³n Parcial Lista PreparaciÃ³n**: Componente `PrintPreparacionParcial` para imprimir productos pendientes de pesaje

4. **ValidaciÃ³n Barcode Pesajes**: Handler `handleScan` valida coincidencia PLU vs cÃ³digo producto

5. **Campo requiere_pesaje**: Nuevo campo en schema de productos para forzar pesaje incluso en mayorista

**Archivos principales:**
- `src/app/(admin)/(dominios)/reportes/produccion/page.tsx` (NUEVO)
- `src/app/(admin)/(dominios)/reportes/produccion/produccion-reporte-content.tsx` (NUEVO)
- `src/actions/produccion.actions.ts`
- `src/components/almacen/PrintPreparacionParcial.tsx` (NUEVO)
- `src/components/almacen/PesajeItemCard.tsx`
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`

---

## 2026-01-08 â€” Antigravity
**Fix: RLS en Rutas de Reparto y Coordenadas PostGIS**


Se corrigiÃ³ un error que impedÃ­a crear rutas de reparto desde la interfaz de usuario:
- **RLS `rutas_reparto`**: Agregadas polÃ­ticas `SELECT`, `INSERT`, `UPDATE` y `DELETE` para usuarios autenticados.
- **RLS `detalles_ruta`**: Agregadas polÃ­ticas `SELECT`, `INSERT`, `UPDATE` y `DELETE` para usuarios autenticados.
- **FunciÃ³n RPC `fn_get_cliente_con_coordenadas`**: Corregida para extraer lat/lng desde tipo **PostGIS geometry** usando `ST_Y()` y `ST_X()` (antes fallaba tratando coordenadas como JSONB).
- **OptimizaciÃ³n de rutas**: Ahora funciona correctamente con Google Directions API.

**Scripts SQL ejecutados directamente en Supabase:**
```sql
-- PolÃ­ticas RLS rutas_reparto
CREATE POLICY "rutas_reparto_select_authenticated" ON rutas_reparto FOR SELECT TO authenticated USING (true);
CREATE POLICY "rutas_reparto_update_authenticated" ON rutas_reparto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- PolÃ­ticas RLS detalles_ruta  
CREATE POLICY "detalles_ruta_select_authenticated" ON detalles_ruta FOR SELECT TO authenticated USING (true);
CREATE POLICY "detalles_ruta_insert_authenticated" ON detalles_ruta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "detalles_ruta_update_authenticated" ON detalles_ruta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "detalles_ruta_delete_authenticated" ON detalles_ruta FOR DELETE TO authenticated USING (true);

-- Fix funciÃ³n coordenadas PostGIS
CREATE OR REPLACE FUNCTION fn_get_cliente_con_coordenadas(p_cliente_id UUID) ...
  ST_Y(c.coordenadas::geometry) as lat,
  ST_X(c.coordenadas::geometry) as lng,
...
```

---

## 2026-01-08 â€” Antigravity
**Feat: Alias Bancarios para Clientes y Hard Delete**

Se implementÃ³ sistema de Identificadores Adicionales (Alias) en Clientes para mejorar la conciliaciÃ³n bancaria inteligente:
- **Base de Datos**: Nueva tabla `clientes_identificadores_adicionales`.
- **UI Cliente**: SecciÃ³n en formulario para gestionar mÃºltiples DNIs y nombres (ej: cÃ³nyuges).
- **Backend ConciliaciÃ³n**: Motor de matching actualizado para buscar por alias y validar nombres alternativos. Ahora persiste etiquetas de matching y permite validaciÃ³n manual sin cliente asignado.
- **GestiÃ³n Clientes**: Implementado Hard Delete (borrado fÃ­sico) con limpieza manual de dependencias (`auditoria_listas_precios`, `identificadores`) para eliminaciÃ³n real de registros.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/ventas/clientes/*`
- `src/actions/ventas.actions.ts`
- `src/lib/conciliacion/cliente-lookup.ts`
- `src/actions/conciliacion.actions.ts`
- `src/components/forms/ClienteForm.tsx`
- `docs/diagrams/architecture.mmd`

---

## 2026-01-08 â€” Antigravity
**Feat: ConfiguraciÃ³n de Desperdicios en Destinos de ProducciÃ³n**

Se agregaron controles en la interfaz de "Destinos de ProducciÃ³n" para gestionar la clasificaciÃ³n de productos como desperdicio:
- **Toggles UI**: MenÃº desplegable en cada producto asociado para marcar/desmarcar "Es Desperdicio" y "Es Desperdicio SÃ³lido".
- **VisualizaciÃ³n**: Icono de reciclaje â™»ï¸ para identificar visualmente los productos marcados como desperdicio.
- **Acciones**: IntegraciÃ³n con `actualizarDesperdicioProductoAction` para persistir los cambios.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/destinos/page.tsx`
- `ARCHITECTURE_SUMMARY.md`

**Refinamiento UI (Desperdicio vs Merma):**
- SeparaciÃ³n visual de "Desperdicio SÃ³lido" y "Merma de Proceso" en el resumen de orden.
- CorrecciÃ³n de cÃ¡lculo de merma lÃ­quida.
- ConfiguraciÃ³n de flags `es_desperdicio` en destinos.

---

## 2026-01-08 â€” Antigravity
**Feat: MÃ³dulo de ConciliaciÃ³n Bancaria AutomÃ¡tica**

Se implementÃ³ un mÃ³dulo completo para la conciliaciÃ³n de movimientos bancarios con pagos esperados:
- **ConciliaciÃ³n Inteligente**: Motor de reglas (Monto, Fecha, DNI/CUIT) + IntegraciÃ³n con IA (Gemini) para casos complejos.
- **ImportaciÃ³n Flexible**: Soporte para CSV, Excel y lectura visual de PDF/ImÃ¡genes mediante IA sin almacenamiento en disco.
- **UI Dedicada**: Dashboard de 3 columnas para revisiÃ³n eficiente, pÃ¡gina de importaciÃ³n y herramientas de conciliaciÃ³n masiva.
- **Seguridad**: Tablas con RLS restringidas a roles 'admin' y 'tesorero'.

**Archivos principales:**
- `src/app/tesoreria/conciliacion/*`
- `src/lib/conciliacion/motor-conciliacion.ts`
- `src/lib/conciliacion/gemini-matcher.ts`
- `src/actions/conciliacion.actions.ts`
- `supabase/migrations/20260107223000_conciliacion_bancaria.sql`

---


## 2026-01-07 â€” Antigravity
**Feat: Mejoras integrales MÃ³dulo ProducciÃ³n (Rendimientos, Predicciones, UI)**

Se implementaron mejoras para optimizar el flujo de producciÃ³n y control de mermas:
- **Rendimientos Esperados**: Nueva tabla y configuraciÃ³n para definir rendimientos estÃ¡ndar por destino/producto/proveedor.
- **PredicciÃ³n IA**: Sugerencia automÃ¡tica de pesos en "Entradas de Stock" basada en configuraciÃ³n histÃ³rica.
- **Alertas de DesviaciÃ³n**: Feedback visual inmediato (amarillo/rojo) al desviarse de la tolerancia configurada.
- **NavegaciÃ³n Libre**: PestaÃ±as en Paso 3 para procesar destinos en cualquier orden.
- **Desperdicios SÃ³lidos**: Flag para diferenciar desperdicios sÃ³lidos ("Piel") de merma lÃ­quida en el cÃ¡lculo final.
- **Resumen Mejorado**: VisualizaciÃ³n con tarjetas y alertas diferidas en el paso final.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`
- `src/app/(admin)/(dominios)/almacen/produccion/rendimientos/page.tsx`
- `src/actions/rendimientos.actions.ts`
- `src/actions/produccion.actions.ts`
- `supabase/migrations/20260107_rendimientos_esperados_produccion.sql`

---

## 2026-01-07 â€” Antigravity
**Fix: Pantalla negra en escÃ¡ner mÃ³vil y separaciÃ³n lÃ³gica video/scanner**

Se implementÃ³ una soluciÃ³n robusta para el escaneo de cÃ³digos de barras en dispositivos mÃ³viles (iOS/Android) que soluciona la pantalla negra:
- **GestiÃ³n nativa del video**: El componente controla directamente el elemento `<video>` sin interferencia de la librerÃ­a de escaneo.
- **Canvas decoding**: Los frames se capturan en un canvas invisible y se pasan manualmente al decodificador ZXing.
- **User Gesture**: Se requiere interacciÃ³n explÃ­cita ("Iniciar CÃ¡mara") para cumplir polÃ­ticas de autoplay de iOS.

**Archivos modificados:**
- `src/components/barcode/BarcodeScanner.tsx`

---

## 2026-01-05 â€” Gemini
**feat: BÃºsqueda en selectores de productos - Nueva Orden de ProducciÃ³n**

Agregado campo de bÃºsqueda en los selectores de productos de `/almacen/produccion/nueva`:
- **Paso 2 (Salidas Stock)**: Filtrar productos por cÃ³digo o nombre
- **Paso 3 (Entradas Stock)**: Filtrar productos por cÃ³digo o nombre

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`

---

## 2026-01-05 â€” Gemini
**Fix: PÃ¡gina de notificaciones quedaba en "Cargando..."**

La pÃ¡gina `/notificaciones` se quedaba en estado de carga infinita porque la tabla `notificaciones` no tenÃ­a el campo `categoria` que la UI esperaba.

**Cambios:**
- Agregada migraciÃ³n `20260105_agregar_categoria_notificaciones.sql` que aÃ±ade el campo `categoria` a la tabla `notificaciones`

**AcciÃ³n requerida:** Ejecutar la migraciÃ³n en Supabase SQL Editor.

---

## 2026-01-05 â€” Daniel
**OptimizaciÃ³n del escÃ¡ner de cÃ³digos de barras**

Se mejorÃ³ el componente `BarcodeScanner.tsx` con las siguientes optimizaciones:

- ReducciÃ³n del intervalo de escaneo de 100ms a 50ms para mayor velocidad
- ImplementaciÃ³n de debounce (1.5s) para evitar escaneos duplicados
- Agregado control de antorcha/flash para condiciones de poca luz
- VibraciÃ³n tÃ¡ctil al detectar cÃ³digo (feedback para el usuario)
- Mayor resoluciÃ³n de cÃ¡mara (hasta 1920x1080)
- Mejor configuraciÃ³n de enfoque continuo, exposiciÃ³n y balance de blancos
- GuÃ­a visual mejorada con esquinas verdes destacadas
- Mejor detecciÃ³n de cÃ¡mara trasera en diferentes dispositivos/idiomas
- Manejo de error `OverconstrainedError` para dispositivos con limitaciones

**Archivos modificados:**
- `src/components/barcode/BarcodeScanner.tsx`

---

## 2026-01-05 â€” Daniel
**Fix: Error de TypeScript con propiedad 'torch'**

Se corrigiÃ³ el error de TypeScript `"Object literal may only specify known properties, and 'torch' does not exist in type 'MediaTrackConstraintSet'"` mediante un cast explÃ­cito a `MediaTrackConstraints`.

La propiedad `torch` es una API experimental de navegadores (Chrome/Android) que no estÃ¡ en los tipos oficiales de TypeScript, pero funciona correctamente en runtime.

**Archivos modificados:**
- `src/components/barcode/BarcodeScanner.tsx`

---

## 2026-01-05 â€” Gemini
**feat: Flujo secuencial y filtrado de destinos en Orden de ProducciÃ³n**

Se refinÃ³ el proceso de "Nueva Orden de ProducciÃ³n" implementando un flujo secuencial estricto por destino:
- **LÃ³gica paso a paso**: Se procesan los destinos de uno en uno (ej. Filet -> Pechuga).
- **Filtrado contextual**: El selector de productos de entrada (generados) ahora muestra Ãºnicamente los productos permitidos para el destino activo.
- **CorrecciÃ³n de estado**: RefactorizaciÃ³n de `handleAgregarEntrada` y `useEffect` correspondiente para usar `currentDestinoId` y garantizar la integridad de datos.
- **Feedback visual**: Mensajes de Ã©xito que confirman el destino afectado.

**Archivos modificados:**
- `src/app/(admin)/(dominios)/almacen/produccion/nueva/page.tsx`
- `ARCHITECTURE_SUMMARY.md`


