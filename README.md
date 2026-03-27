# Avicola del Sur ERP

Actualizado: 2026-03-27

Repositorio principal del sistema integral de Avicola del Sur. El proyecto corre sobre Next.js + Supabase y hoy combina:

- backoffice administrativo por dominios
- app de sucursal
- PWA de repartidor
- catalogo publico con integracion a WhatsApp
- tesoreria y conciliacion
- RRHH con Hik-Connect
- capa experimental WebMCP

## Estado actual

La estructura viva del producto ya no es solamente "admin + bot". Hoy existen varias superficies operativas:

| Superficie | Rutas principales | Codigo fuente |
| --- | --- | --- |
| Backoffice admin | `/dashboard`, `/almacen`, `/ventas`, `/reparto`, `/tesoreria`, `/rrhh`, `/sucursales`, `/reportes` | `src/app/(admin)` |
| App repartidor | `/home`, `/checkin`, `/ruta-diaria`, `/ruta/[ruta_id]`, `/entregas`, `/perfil` | `src/app/(repartidor)` |
| App sucursal | `/sucursal/dashboard`, `/sucursal/ventas`, `/sucursal/inventario`, `/sucursal/transferencias`, `/sucursal/tesoreria` | `src/app/sucursal` |
| Catalogo publico | `/catalogo` | `src/app/catalogo` |
| Conciliacion bancaria | `/tesoreria/conciliacion`, `/tesoreria/conciliacion/importar`, `/tesoreria/conciliacion/revisar`, `/tesoreria/conciliacion/historial` | `src/app/tesoreria/conciliacion` |
| Bot y webhooks | `/api/bot`, `/api/webhooks/whatsapp-meta` | `src/app/api/bot`, `src/app/api/webhooks` |
| WebMCP experimental | `/api/webmcp/tools`, `/api/webmcp/execute`, `/api/webmcp/auditoria` | `src/lib/webmcp`, `src/app/api/webmcp` |
| Utilidades publicas | `/factura/[id]`, `/seguimiento/presupuesto/[numero]`, `/offline`, `/unauthorized`, `/diagnostico-google-maps` | `src/app` |

## Modulos funcionales

| Modulo | Cobertura actual |
| --- | --- |
| Almacen | productos, lotes, pedidos, presupuestos del dia, pesaje, recepcion, produccion, control de stock, documentos |
| Ventas | clientes, presupuestos, listas de precios, comprobantes, facturas, cuenta corriente, reclamos |
| Reparto | planificacion semanal, historial, rutas, optimizacion, monitor, vehiculos, checklist, mantenimiento |
| Tesoreria | cajas, cierre de caja, movimientos, cuentas corrientes, tesoro, validar rutas, proveedores, conciliacion |
| RRHH | empleados, legajo, horarios Hik-Connect, licencias, adelantos, evaluaciones, mensajes, novedades, reportes, liquidaciones configurables |
| Sucursales | sucursales, transferencias, solicitudes, dashboards y operaciones locales |
| Reportes | ventas, pedidos, reparto, almacen, stock, tesoreria, clientes, empleados, produccion, bot e IA |
| IA | predicciones, clasificacion de gastos, validacion de cobros, chat/reportes IA, procesamiento documental, analisis de pesaje |

## Integraciones activas

### WhatsApp

El sistema soporta multiples proveedores. La seleccion operativa sale de `WHATSAPP_PROVIDER`.

- `kapso`
- `meta`
- `twilio`
- `auto`

`/api/bot` sigue aceptando payloads de Kapso, Meta, Twilio y Botpress. La documentacion que asuma un solo proveedor o una sola via de webhook esta desactualizada.

### Ruteo y optimizacion

Orden real del motor de rutas:

1. OpenRouteService
2. Google Directions
3. optimizador local

Para optimizacion avanzada, el sistema intenta:

1. Google Cloud Optimization API
2. Google Fleet Routing
3. flujo base ORS -> Google -> local

### Google Cloud e IA

El repo usa Google Cloud para varias capas:

- Gemini para capacidades generativas y enriquecimientos asistidos
- Vertex AI para algunas predicciones
- Document AI para procesamiento documental
- Google Maps para UI y servicios de mapas
- Dialogflow, Speech-to-Text y AutoML como integraciones opcionales o parciales

### RRHH / Hik-Connect

RRHH tiene sincronizacion de marcaciones desde Hik-Connect, mapeo de personas, backfill historico y reglas operativas que ya impactan liquidaciones, descansos y asistencia.

## Stack real

| Capa | Stack |
| --- | --- |
| Runtime | Node 22, npm 10 |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| UI | Radix UI, shadcn/ui, TanStack Table, React Hook Form, Zod |
| Backend | App Router, Route Handlers, Server Actions |
| Datos | Supabase Postgres, Auth, Storage, Realtime |
| Estado cliente | Zustand |
| Reportes / PDFs | pdfkit, xlsx |
| Mapas | Google Maps JS, ORS, Google Directions, GraphHopper opcional |
| IA | Gemini, Vertex AI, Document AI |
| Bot | Kapso, Meta, Twilio, Botpress como compatibilidad |

## Scripts reales

Los comandos documentados abajo existen hoy en `package.json`:

| Script | Uso |
| --- | --- |
| `npm run dev` | desarrollo local |
| `npm run build` | build de produccion |
| `npm run start` | levantar build local |
| `npm run lint` | ESLint |
| `npm run type-check` | chequeo TypeScript |
| `npm run format` | `eslint --fix` |
| `npm run verificar-bot` | verificacion del bot |
| `npm run rrhh:hik:backfill` | reproceso historico de asistencia Hik |
| `npm run harness:init` | bootstrap del harness |
| `npm run harness:validate` | validaciones mecanicas y de guardrails |
| `npm run harness:qa` | QA del harness |
| `npm run harness:run-task` | flujo completo del harness |
| `npm run harness:pr-package` | empaquetado de artefactos de PR |
| `npm run harness:maintenance` | mantenimiento semanal del harness |

Si una guia menciona `npm run ia:sync`, `npm run supabase:migrate` u otros scripts no listados arriba, esa guia ya no refleja este repo.

## Configuracion rapida

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env.local` a partir de `env.example`:

```bash
copy env.example .env.local
```

3. Completar al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`

4. Completar segun features usadas:

- mapas y routing: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_OPENROUTESERVICE_API_KEY`, `GRAPHHOPPER_API_KEY`
- bot: `WHATSAPP_PROVIDER`, `WHATSAPP_*`, `KAPSO_*`, `TWILIO_*`, `BOTPRESS_*`
- Google Cloud / IA: `GOOGLE_GEMINI_API_KEY`, `GOOGLE_GEMINI_MODEL`, `GOOGLE_CLOUD_*`, `GOOGLE_DOCUMENT_AI_*`, `GOOGLE_VERTEX_AI_*`
- cron: `CRON_SECRET`
- RRHH Hik: `HIK_CONNECT_*`, `HIK_ATTENDANCE_DEBOUNCE_MINUTES`
- WebMCP: `NEXT_PUBLIC_WEBMCP_ENABLED`

## Documentacion canonica

Los documentos de referencia actualizados para este repo son:

- `docs/README.md` (indice maestro)
- `README.md`
- `ARCHITECTURE.MD`
- `ARCHITECTURE_SUMMARY.md`
- `RRHH_README.md`
- `docs/IA_CAPABILITIES.md`
- `docs/FLUJO_PRESUPUESTOS_PEDIDOS_RUTAS.md`
- `docs/GOOGLE_CLOUD_SETUP.md`
- `docs/VERCEL_SETUP.md`
- `docs/WHATSAPP_KAPSO_SETUP.md`
- `docs/WHATSAPP_META_SETUP.md`
- `docs/USUARIO_REPARTIDOR.md`
- `supabase/README.md`
- `docs/harness/*`

## Documentacion historica

En `docs/` siguen existiendo auditorias, fixes, planes y notas operativas puntuales. Son utiles como contexto historico, pero no deben tomarse como fuente canonica si contradicen los documentos listados arriba.

En particular:

- `docs/AUDITORIA_GOOGLE_CLOUD.md` queda como historico
- `docs/WHATSAPP_BUTTONS.md` queda como historico
- varios documentos de auditoria/sidebar/fixes representan snapshots viejos

## Estructura del repo

| Ruta | Proposito |
| --- | --- |
| `src/app` | superficies web y APIs |
| `src/actions` | backend-for-frontend y operaciones de dominio |
| `src/lib` | servicios, integraciones, schemas, helpers y capas especializadas |
| `supabase` | migraciones, scripts y documentacion de base de datos |
| `scripts` | utilidades operativas, setup y harness |
| `docs` | documentacion funcional, operativa e historica |
| `tools/harness-core` | fuente del core sincronizable del harness |

## Siguientes lecturas

- Arquitectura detallada: `ARCHITECTURE.MD`
- Resumen tecnico corto: `ARCHITECTURE_SUMMARY.md`
- RRHH: `RRHH_README.md`
- IA: `docs/IA_CAPABILITIES.md`
- Flujo presupuesto -> pedido -> ruta: `docs/FLUJO_PRESUPUESTOS_PEDIDOS_RUTAS.md`
- Google Cloud y despliegue: `docs/GOOGLE_CLOUD_SETUP.md`, `docs/VERCEL_SETUP.md`
- Base de datos: `supabase/README.md`
