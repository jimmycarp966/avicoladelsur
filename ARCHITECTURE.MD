# Arquitectura del sistema

Actualizado: 2026-03-27

Este documento describe la fotografia tecnica actual del repo. Cuando haya conflicto con auditorias o notas historicas dentro de `docs/`, este archivo y `ARCHITECTURE_SUMMARY.md` son la referencia principal.

## 1. Panorama general

El sistema esta organizado como un monolito modular en Next.js 16 con Supabase como backend principal. El producto ya no es una sola app administrativa: hoy conviven varias superficies que comparten autenticacion, datos, integraciones externas y reglas de negocio.

Superficies activas:

- backoffice admin por dominios
- app de repartidor
- app de sucursal
- catalogo publico
- conciliacion bancaria
- bot de WhatsApp y webhooks
- WebMCP experimental

## 2. Capas del repo

| Capa | Ubicacion | Responsabilidad |
| --- | --- | --- |
| Presentacion | `src/app`, `src/components` | paginas, layouts, formularios, tablas, mapas, PWA |
| BFF / Orquestacion | `src/actions` | validaciones, permisos, llamadas a Supabase y servicios |
| Dominio e integraciones | `src/lib` | logica reusable, integraciones externas, schemas y helpers |
| Datos | `supabase/migrations`, `src/types`, clientes Supabase | modelo relacional, RLS, funciones, tipos |
| Operacion | `scripts`, `docs`, `.harness`, `tools/harness-core` | setup, mantenimiento, QA, documentacion, guardrails |

## 3. Apps y rutas

### 3.1 Backoffice admin

Codigo: `src/app/(admin)`

Dominios actuales:

- `almacen`
- `ventas`
- `reparto`
- `tesoreria`
- `rrhh`
- `sucursales`
- `reportes`

Ademas del arbol por dominios, existen superficies admin transversales:

- `/dashboard`
- `/dashboard/predicciones`
- `/dashboard/ia-capacidades`
- `/notificaciones`
- `/notificaciones/configuracion`
- `/admin/bot-chat`
- `/test-camera`

### 3.2 App repartidor

Codigo: `src/app/(repartidor)`

Rutas relevantes:

- `/home`
- `/checkin`
- `/ruta-diaria`
- `/ruta/[ruta_id]`
- `/ruta/[ruta_id]/mapa`
- `/ruta/[ruta_id]/entrega/[entrega_id]`
- `/entregas`
- `/perfil`

### 3.3 App sucursal

Codigo: `src/app/sucursal`

Rutas relevantes:

- `/sucursal/dashboard`
- `/sucursal/ventas`
- `/sucursal/inventario`
- `/sucursal/inventario/conteos`
- `/sucursal/inventario/stock-minimo`
- `/sucursal/transferencias`
- `/sucursal/tesoreria`
- `/sucursal/reportes`
- `/sucursal/reportes/auditoria`
- `/sucursal/alerts`
- `/sucursal/novedades`
- `/sucursal/configuracion`

### 3.4 Publico y utilidades

- `/catalogo`
- `/factura/[id]`
- `/seguimiento/presupuesto/[numero]`
- `/offline`
- `/unauthorized`
- `/diagnostico-google-maps`
- `/test-almacen`
- `/prueba`
- `/prueba-mapa`

### 3.5 Conciliacion bancaria

Codigo: `src/app/tesoreria/conciliacion`

Rutas:

- `/tesoreria/conciliacion`
- `/tesoreria/conciliacion/importar`
- `/tesoreria/conciliacion/revisar`
- `/tesoreria/conciliacion/historial`

## 4. Dominios funcionales

### Almacen

Cobertura viva:

- productos
- lotes y ajustes
- recepcion
- produccion y rendimientos
- presupuestos del dia
- pesaje
- pedidos y en preparacion
- control de stock
- documentos

### Ventas

Cobertura viva:

- clientes
- cuenta corriente
- presupuestos
- listas de precios
- comprobantes
- facturas
- reclamos

### Reparto

Cobertura viva:

- planificacion semanal
- historial de planificacion
- rutas
- optimizacion
- monitor
- vehiculos
- checklist
- mantenimiento

### Tesoreria

Cobertura viva:

- cajas
- cierre de caja
- movimientos
- cuentas corrientes
- tesoro
- validar rutas
- proveedores
- vista por sucursal
- conciliacion

### RRHH

Cobertura viva:

- empleados y legajo
- horarios y asistencia desde Hik-Connect
- licencias con adjuntos
- adelantos con planes y cuotas
- evaluaciones
- mensajes internos
- novedades
- reportes
- liquidaciones con reglas por periodo y puesto

### Sucursales

Cobertura viva:

- sucursales
- transferencias
- solicitudes
- settings por sucursal
- panel local de sucursal

### Reportes

Pantallas actuales:

- almacen
- bot
- clientes
- empleados
- ia
- pedidos
- produccion
- reparto
- stock
- sucursales
- tesoreria
- ventas

## 5. API y familias de endpoints

El repo expone varias familias de Route Handlers. Las mas importantes hoy son:

| Familia | Ejemplos |
| --- | --- |
| Bot y webhooks | `/api/bot`, `/api/webhooks/whatsapp-meta`, `/api/bot/dialogflow`, `/api/bot/transcribe` |
| WebMCP | `/api/webmcp/tools`, `/api/webmcp/execute`, `/api/webmcp/auditoria` |
| Ventas | `/api/ventas/presupuestos/*`, `/api/listas-precios/*`, `/api/productos/buscar` |
| Almacen | `/api/almacen/recepcion`, `/api/almacen/presupuesto/pesaje`, `/api/almacen/presupuesto/convertir-pedido`, `/api/almacen/analizar-peso` |
| Reparto y rutas | `/api/reparto/*`, `/api/rutas/*`, `/api/integrations/google/directions` |
| Tesoreria | `/api/tesoreria/*`, `/api/gastos`, `/api/cuentas_corrientes` |
| RRHH | `/api/rrhh/*`, `/api/cron/rrhh/*` |
| Sucursales | `/api/sucursales/*` |
| Reportes e IA | `/api/reportes/*`, `/api/ia/*`, `/api/predictions/*`, `/api/documents/process` |
| Cron | `/api/cron/notificaciones`, `/api/cron/recordatorios`, `/api/cron/rrhh/*` |

## 6. Integraciones externas

### 6.1 WhatsApp

Proveedor configurable por `WHATSAPP_PROVIDER`.

Modos soportados:

- `kapso`
- `meta`
- `twilio`
- `auto`

El endpoint `/api/bot` sigue aceptando payloads de varios formatos por compatibilidad operativa. Si un documento describe el bot como exclusivamente Twilio o exclusivamente Meta, esta desactualizado.

### 6.2 Google Cloud

Uso actual:

- Gemini
- Vertex AI
- Document AI
- Dialogflow
- Speech-to-Text
- Maps / Directions
- Cloud Optimization y Fleet Routing como opt-in

Recomendacion operativa: definir `GOOGLE_GEMINI_MODEL` explicitamente en ambiente para no depender de fallbacks legacy del codigo.

### 6.3 Motor de rutas

Flujo actual de optimizacion base:

1. ORS
2. Google Directions
3. optimizador local

Flujo actual de optimizacion avanzada:

1. Google Cloud Optimization API
2. Google Fleet Routing
3. flujo base ORS -> Google -> local

### 6.4 RRHH / Hik-Connect

El sistema usa Hik-Connect para leer marcaciones y sincronizarlas con RRHH. La capa vive en:

- `src/actions/rrhh-horarios.actions.ts`
- `src/lib/services/rrhh-horarios.service.ts`
- `src/app/(admin)/(dominios)/rrhh/horarios`
- `scripts/rrhh-hik-backfill.js`

## 7. Datos, RLS y Supabase

### 7.1 Fuente de verdad

La fuente de verdad del modelo es `supabase/migrations`. El directorio ya no debe leerse como un simple bootstrap inicial: contiene la evolucion funcional real del sistema.

### 7.2 Lecturas y escrituras

- lecturas via clientes Supabase server-side
- orquestacion via Server Actions y Route Handlers
- reglas de seguridad via RLS y checks de rol
- operaciones complejas repartidas entre SQL, actions y servicios

### 7.3 Estado de tipos

`src/types/database.types.ts` fue reconciliado manualmente el 2026-03-27 contra migraciones y runtime RRHH. Aun asi, `supabase/migrations` sigue siendo la fuente primaria y hay señales de drift puntual en asistencia Hik (`hora_entrada_manana`, `hora_salida_manana`, `hora_entrada_tarde`, `hora_salida_tarde`) que no aparecen claramente en migraciones versionadas. Para cambios estructurales, usar primero:

- `supabase/migrations`
- consultas reales del codigo
- `src/types/domain.types.ts`

## 8. RRHH: cambios estructurales recientes

Los cambios de marzo 2026 relevantes para arquitectura son:

- adelantos con planes y cuotas
- `rrhh_legajo_eventos`
- `rrhh_descansos_mensuales`
- `rrhh_liquidacion_jornadas`
- `rrhh_liquidacion_tramos_puesto`
- reglas por periodo y puesto
- bucket privado de licencias
- control de asistencia futura dentro del mes actual
- grupo `lun_sab`, extras y suspensiones

La pagina raiz de RRHH ya no actua como dashboard: hoy redirige a `/rrhh/empleados`.

## 9. IA y capacidades

La matriz de capacidades vivas esta documentada en `docs/IA_CAPABILITIES.md`. Hoy conviven:

- endpoints con metadata IA estandarizada
- endpoints legacy bajo `/api/ia/*`
- capacidades primarias de Gemini
- capacidades asistidas
- rutas sin inferencia en tiempo real pero con telemetria IA

Tambien hay endpoints legacy que todavia no exponen el mismo contrato uniforme; por ejemplo `POST /api/almacen/analizar-peso`.

## 10. WebMCP

WebMCP es una capa experimental para exponer herramientas del ERP a agentes desde el frontend. Componentes principales:

- `src/components/providers/WebMCPProvider.tsx`
- `src/lib/webmcp/tool-catalog.ts`
- `src/lib/webmcp/runtime.ts`
- `src/app/api/webmcp/*`

El catalogo mezcla tools de navegacion y tools de API, con roles, riesgo y confirmaciones.

## 11. Harness

La documentacion del harness vive en `docs/harness/*` y sigue razonablemente alineada con `scripts/harness/*`. Esa carpeta debe tratarse como fuente de verdad para el flujo de automatizacion y mantenimiento.

## 12. Reglas para documentacion futura

Para evitar drift:

- preferir tablas y mapas de rutas reales antes que narrativas historicas
- no documentar scripts que no esten en `package.json`
- no documentar providers unicos cuando el codigo soporta varios
- si una nota es auditoria o historico, marcarla explicitamente como tal
- tomar `supabase/migrations` como fuente principal para cambios de datos
