# 🚀 Avícola del Sur ERP - Sistema Integral de Gestión

**Versión:** Febrero 2026 (v2.4.1)  
**Estado:** ✅ PRODUCCIÓN  
**Docs relacionadas:** [Architecture Summary](./ARCHITECTURE_SUMMARY.md) · [Architecture Deep-Dive](./ARCHITECTURE.md) · [Supabase Setup](./SUPABASE_SETUP.md) · [INIT Context](./INIT.md)  
**Última actualización:** 18 de Febrero 2026 (22:00)

**Plataforma unificada** de gestión avícola que integra WMS (Almacén), TMS (Reparto), CRM (Ventas), Carrito Web Público y ERP (Finanzas/RRHH). Potenciada por **Google Gemini AI** para decisiones inteligentes en tiempo real dentro de una arquitectura **server-authoritative** sobre Supabase.

📅 **Acceso Rápido al Catálogo**: [avicoladelsur.vercel.app/catalogo](https://avicoladelsur.vercel.app/catalogo) (Carrito sincronizado con WhatsApp)

---

## 🔗 Navegación Rápida

| Sección | Contenido |
| --- | --- |
| [Pilares del Sistema](#-pilares-del-sistema-auditoria-enero-2026) | Diferenciales funcionales e IA |
| [Novedades 2026-02-18](#-novedades-2026-02-18) | Tesoreria por sucursal, reparto y combustible |
| [Inicio Rápido](#-inicio-rápido) | Onboarding completo (prerrequisitos + setup + scripts) |
| [Arquitectura](#-arquitectura-del-sistema) | Stack, módulos y dominios |
| [Características del Sistema](#-características-del-sistema---completo) | Roadmap de features clave |
| [Troubleshooting](#-troubleshooting-rápido) | Errores comunes y soluciones |

## 🆕 Novedades 2026-02-18

- **Tesoreria**:
  - Se unifica el acceso operativo de cajas con la nueva vista `/tesoreria/por-sucursal`.
  - En movimientos/flujo se renombra "deposito bancario" por "transferencia".
  - En cuentas corrientes se agrega "promesas del dia" y `hora_proximo_contacto` (uso operativo GMT-3).
- **Reparto / Vehiculos**:
  - Se agrega validacion de vigencia de seguro, mas campos `fecha_vto_senasa` y `fecha_vto_vtv`.
  - Se incorpora `km_inicial` del vehiculo (carga unica) y tracking de kilometraje por reparto.
  - Nueva planilla de programacion de mantenimiento por vehiculo.
  - Nuevos campos de combustible: capacidad de tanque y litros actuales.
- **Checklist diario de vehiculo**:
  - Aceite de motor en porcentaje (0-100 en incrementos de 10).
  - Limpieza interior/exterior con escala mala | buena | excelente.
  - Luces con campo libre de observacion.
  - Presion de neumaticos en PSI numerico.
- **Cierre de reparto y consumo**:
  - Al finalizar ruta, se pregunta si se cargo combustible.
  - Si se cargo, se registran litros y se calcula `consumo_km_l = km_recorridos / litros_cargados`.
  - Estos datos quedan persistidos en el reporte de ruta.
- **RRHH / Evaluaciones**:
  - Implementación de **Huella Digital Operativa**: Un panel de soporte de decisión que extrae métricas objetivas del ERP (asistencia, ventas, producción, caja) para fundamentar las evaluaciones de personal.
  - Nuevo semáforo de deuda de clientes integrado en la ficha de empleado.
  - Registro automático de cierre de turno de almacén.
- **Migracion SQL aplicada**:
  - `supabase/migrations/20260218_huella_digital_operativa.sql`

## ✨ Pilares del Sistema (Auditoria Enero 2026)

### 🧠 Inteligencia Artificial Aplicada (Gemini)
- **Validación de Peso**: Gemini 2.5 Flash detecta errores de tipeo en balanzas en tiempo real con análisis de anomalías.
- **Conciliación Bancaria**: Gemini 3.0 Pro analiza extractos bancarios (PDF/Excel) y sugiere matchings contables complejos con >90% precisión.
- **Chatbot de Ventas**: Intérprete de lenguaje natural para toma de pedidos vía WhatsApp e integración con Carritos Web.
- **Memory Bank Inteligente**: Extracción automática de hechos y preferencias con Gemini 2.5 Flash para atención personalizada.
- **Catálogo Web Público**: Sincronización automática de carritos web con el bot de WhatsApp vía códigos únicos (`carritos_pendientes`).
- **Optimización Logística**: Algoritmos híbridos (OpenRouteService + Google Directions + Heurística local) para reparto eficiente.

### 🧩 WebMCP (Experimental)
- Estado: integración experimental para exponer herramientas del ERP a agentes IA desde frontend.
- Activación por flag: `NEXT_PUBLIC_WEBMCP_ENABLED=true`.
- Cobertura: navegación agéntica en admin/repartidor/sucursal y tools de datos por rol.
- Cobertura Fase 2: mutaciones de ventas/almacén/reparto (facturación, pesaje, entregas, devoluciones, optimización de rutas) con permisos por rol.
- Seguridad: control de rol server-side y confirmación granular por riesgo (`none`, `soft`, `hard`).
- Endpoints internos:
  - `GET /api/webmcp/tools` lista tools habilitadas según usuario.
  - `POST /api/webmcp/execute` ejecuta tools de API con allowlist y validación de permisos.
  - `GET /api/webmcp/auditoria` consulta trazabilidad de ejecuciones WebMCP.
- Puntos de código:
  - `src/components/providers/WebMCPProvider.tsx`
  - `src/lib/webmcp/tool-catalog.ts`
  - `src/app/api/webmcp/execute/route.ts`
  - `src/app/api/webmcp/auditoria/route.ts`
  - `supabase/migrations/20260214_webmcp_auditoria.sql`

### 🚛 Logística Avanzada (TMS)
- **Navegación Interactiva**: App de repartidor con selección de rutas alternativas en tiempo real (OpenRouteService con datos OSM actualizados).
- **Decisión Inteligente**: Priorización automática de próximo cliente basada en horario de cierre y distancia.
- **PWA Offline-First**: Tracking GPS continuo (cada 5s), firma digital y cobros sin conexión.
- **Voz Sintética**: Instrucciones de navegación "Turn-by-turn" integradas en la app.
- **Alertas Automáticas**: Detección de desvíos (>200m) y clientes saltados (<100m) en tiempo real.

### 🏭 Producción Científica (WMS)
- **Desposte Controlado**: Comparativa tiempo real de Rendimiento Teórico vs Real.
- **Gestión de Mermas**: Diferenciación precisa entre Merma de Proceso (líquida) y Desperdicio Sólido.
- **Trazabilidad Total**: Seguimiento de lote desde materia prima hasta producto terminado (FIFO).
- **Inventario Distribuido**: Gestión multi-sucursal con transferencias y alertas de stock bajo.
- **Producción Incremental**: Registro parcial de productos terminados (Memory Bank) con barra de progreso y resumen de impresión.
- **Control de Stock por Turnos**: Auditoría física Mañana/Noche con timer de 1 hora y detección de producción activa.

### 💰 Finanzas y Control
- **Conciliación Automatizada**: Motor de ingesta de extractos bancarios con matching inteligente y parser robusto multiformato.
- **Tesorería Blindada**: Arqueos de caja ciegos y validación cruzada de rendiciones de choferes.
- **Gestión de Crédito**: Cuentas corrientes con límites automáticos y cálculo de moras.
- **Sistema de Remitos**: Generación de documentos PDF para entregas, traslados y producción con snapshots de datos e inmutabilidad.

### 🏢 Gestión Multi-Sucursal
- **Auditoría de Precios**: Control estricto de listas Mayorista vs Minorista para evitar fraudes.
- **Conteos Cíclicos**: Sistema de inventario físico semanal con tolerancias configurables.


## 🚀 Inicio Rápido

### 1. Prerrequisitos (Auditoría DevOps)

| Categoría | Requisito |
| --- | --- |
| Runtime | Node.js 22.x, npm 10+, PNPM opcional (bloqueado en `packageManager`) |
| Backend | Proyecto Supabase 15+ con Auth, Storage, Realtime, pg_cron habilitado |
| Integraciones | WhatsApp Business API (Meta) o Twilio, Google Cloud (Maps, Places, Gemini, Predictions), OpenRouteService (Routing OSM), cuenta ngrok |
| Herramientas | Git, Supabase CLI (`npm i -g supabase`), psql, jq |
| Opcional | Botpress (NLU avanzada) |

### 2. Instalación y Setup

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd avicola-del-sur
   ```
2. **Instalar dependencias**
   ```bash
   npm install
   ```
3. **Configurar Supabase**
   - Crear proyecto y ejecutar migraciones siguiendo [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).
   - Aplicar seeds opcionales (`supabase/seed/*.sql`) para demo de rutas, vehículos y listas de precios.
   - Verificar funciones críticas (`fn_convertir_presupuesto_a_pedido`, `fn_asignar_pedido_a_ruta`).
4. **Variables de entorno**
   ```bash
   cp env.example .env.local
   ```
   Completar con claves Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`), Google (`GOOGLE_GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY`), IA (`GEMINI_MODEL_FLASH`, `GEMINI_MODEL_PRO` si se sobreescribe) y WhatsApp (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_TOKEN` o `TWILIO_*`). `GOOGLE_AI_API_KEY` se mantiene solo por compatibilidad legacy. Añadir `NGROK_AUTH_TOKEN` para exponer webhooks locales.
5. **Sincronizar assets IA (opcional)**
   ```bash
   npm run ia:sync
   ```
6. **Ejecutar el proyecto**
   ```bash
   npm run dev
   ```
   Abrir [http://localhost:3000](http://localhost:3000) y verificar acceso a `/dashboard`.

### 3. Scripts Clave

| Script | Uso |
| --- | --- |
| `npm run dev` | Next.js + Server Actions |
| `npm run build && npm start` | Build/preview producción |
| `npm run lint` | ESLint + TS |
| `npm run typecheck` | Revisión estricta TS |
| `npm run verificar-bot` | Diagnóstico de bot WhatsApp |
| `npm run test:sucursales` | Suite rápida de POS sucursales |
| `npm run test:bot:webhook` | Simula mensajes Twilio hacia `/api/bot` (prueba rápida del bot) |
| `npm run supabase:migrate` | Aplica migraciones locales |
| `./scripts/demo-presupuestos.sh` | Flujo Presupuesto→Pedido |
| `./scripts/demo-rutas.sh` | Demostración optimización TMS |

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico
- **Framework**: Next.js 16 (App Router, Server Actions)
- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Server Actions + Supabase (Postgres + Auth + Storage + Realtime)
- **Base de Datos**: Supabase (PostgreSQL) con **184+ migraciones** y funciones RPC optimizadas.
- **Backend**: Next.js Server Actions (seguridad y performance).
- **Frontend**: React 19, Tailwind CSS, Shadcn UI.
- **Mapas**: Google Maps JavaScript API (TMS) + Leaflet (Reportes Heatmap)
- **Routing**: OpenRouteService (ORS) con datos OSM actualizados + fallback a Google/local
- **Bot**: WhatsApp por **Twilio** (Twilio-only por `WHATSAPP_PROVIDER=twilio`; integración Meta opcional)
- **Reportes**: Generación de PDF y Excel en servidor.
- **Estado**: Zustand (solo estado global: sesión, notificaciones)
- **Formularios**: React Hook Form + Zod validation
- **Tablas**: TanStack Table (paginación, filtros, sorting)
- **PDF**: pdfkit + Supabase Storage
- **GPS**: Navigator API + polling cada 5s
- **Optimización**: OpenRouteService (ORS) con fallback a Google/local

### Estructura Modular
- **App Admin**: Backoffice (`src/app/(admin)`), con layout + sidebar.
- **App Repartidor**: PWA móvil (`src/app/(repartidor)`), tracking GPS y entregas.
- **App Sucursal**: POS y panel local (`src/app/sucursal`).
- **Bot Vendedor**: Endpoint principal (`POST /api/bot`) + webhook Meta (`/api/webhooks/whatsapp-meta`, opcional).
- **Catálogo Público**: Sin autenticación (`src/app/catalogo`), sincronizado con WhatsApp.

### Dominios de Negocio (Organización Funcional)
1. **Almacén (WMS)**: Control de stock, lotes, picking, transferencias entre sucursales
2. **Ventas (CRM)**: Clientes, pedidos, cotizaciones, reclamos, listas de precios
3. **Reparto (TMS)**: Vehículos, rutas, entregas, GPS tracking
4. **Tesorería**: Gestión de cajas, movimientos, validación de cobros, cierres, retiros automáticos de sucursales
5. **Sucursales**: Gestión multi-sucursal, inventario distribuido, alertas centralizadas, remitos de traslado
6. **Control de Sucursales**: Auditoría de precios mayorista/minorista, conteos físicos de stock, detección de desvíos
7. **RRHH**: Gestión completa de empleados, asistencia, liquidaciones, adelantos
8. **Chatbot**: Toma automática de pedidos vía WhatsApp
9. **Remitos**: Sistema integral de documentación documental interna y externa

## ⚡ Optimizaciones de Rendimiento Implementadas

### Velocidad de Carga
- **Revalidación Estratégica**: Páginas principales usan `revalidate` en lugar de `force-dynamic`
  - Dashboard: 30 segundos
  - Listados: 5 minutos
  - Reportes: 1 hora
- **Caché de Consultas Frecuentes**: Productos, zonas y listas de precios se cachean automáticamente
- **Queries Optimizadas**: Consolidación de queries N+1 en funciones RPC

### Base de Datos
- **Índices Optimizados**: Índices compuestos para consultas frecuentes
  - Presupuestos por fecha/turno/zona
  - Pedidos por sucursal/fecha
  - Lotes por sucursal/producto/estado
  - Transferencias por estado/fecha
  - Alertas de stock por sucursal/estado
  - **Índices de Claves Foráneas (Enero 2026)**: Cobertura completa de índices en FKs para tablas transaccionales (`movimientos_stock`, `ordenes_produccion`, etc.) eliminando sequential scans en JOINs.
- **Materialized Views**: KPIs de ventas pre-calculados (diarias y mensuales)
- **Funciones RPC Optimizadas**: Validación batch, conversión masiva, aprobación masiva

### Flujos de Negocio Optimizados
- **Presupuestos → Pedidos**: Validación batch de stock, conversión masiva
- **Transferencias entre Sucursales**: Validación batch, aprobación masiva
- **Validación de Cobros**: Validación masiva de rutas con comparación automática
- **Asignación de Rutas**: Validación batch de capacidad
- **Expiración Automática**: Reservas de stock se liberan automáticamente cada 15 minutos

### Mejoras de UX
- **Notificaciones Push**: Notificaciones del navegador para eventos críticos
- **Alertas de Stock Inteligentes**: Sistema de priorización (crítico, bajo, normal)
- **Búsquedas Optimizadas**: Debounce en búsquedas para reducir queries innecesarias
- **Logging Condicional**: Console.logs solo en desarrollo

### Métricas Esperadas
- **Tiempo de carga**: Reducción de 70-80% (de 3-5s a <1s con caché)
- **Consultas BD**: Reducción de 50-70% (de 200-500ms a 50-150ms)
- **Monitor GPS**: Latencia <1 segundo (con Supabase Realtime)

## 🏢 Control de Sucursales - Modelo de Auditoría y Stock

### 🎯 Problema Resuelto
Controlar que las sucursales no manipulen precios mayorista/minorista para quedarse con diferencias, mientras se mantiene stock y valor a costo real visible en tiempo real desde casa central.

### ✨ Características Principales
- **Auditoría de Precios**: Registro automático de qué lista de precios (mayorista/minorista) se usa en cada venta
- **Cálculo de Costo Real**: Costo promedio ponderado por sucursal + margen bruto por venta
- **Conteos Físicos**: Ciclo semanal con tolerancia de merma configurable (1-2%)
- **Detección de Fraude**: Alertas automáticas por alto % mayorista o ventas mayoristas de bajo volumen
- **Reportes de Control**: Uso de listas por usuario, márgenes por día, diferencias de stock
- **Dashboard Mejorado**: Identificación clara de sucursal activa con banner destacado y selector para administradores
- **Manejo de Admins**: Los administradores pueden navegar todas las secciones sin sucursal asignada, con mensajes informativos cuando no hay sucursales activas
- **Redirección Automática**: Usuarios con sucursal asignada en `rrhh_empleados` son redirigidos automáticamente a `/sucursal/dashboard` al iniciar sesión
- **Asignación de Sucursales**: Los usuarios se vinculan a sucursales mediante la tabla `rrhh_empleados` (campo `sucursal_id`)

### 🔄 Flujo de Control
```
Venta Sucursal → Selección Lista Precio → Registro Automático Costo/Margen → Auditoría
    ↓
Conteo Semanal → Comparación Teórico vs Contado → Ajustes Automáticos (merma ≤2%)
    ↓
Reportes Casa Central → Alertas Desvíos → Investigación si necesario
```

## 📁 Estructura del Proyecto

```
src/
├── app/                          # Rutas Next.js (App Router)
│   ├── (admin)/                  # Dashboard administrativo
│   │   ├── (dominios)/          # Módulos principales
│   │   │   ├── almacen/         # Gestión de stock/lotes
│   │   │   ├── reparto/         # ⭐ Rutas, planificación, monitor GPS
│   │   │   │   ├── planificacion/  # ⭐ Gestión semanal de rutas
│   │   │   │   ├── monitor/       # ⭐ Monitor GPS en tiempo real
│   │   │   │   └── rutas/         # Gestión de rutas
│   │   │   ├── tesoreria/       # Cajas, movimientos, cierres
│   │   │   ├── rrhh/            # Recursos Humanos (empleados, asistencia, liquidaciones, adelantos)
│   │   │   └── ventas/          # Presupuestos, pedidos, clientes, listas de precios
│   │   │       └── listas-precios/  # Gestión de listas de precios y precios por producto
│   │   └── dashboard/           # Dashboard principal
│   ├── (repartidor)/            # ⭐ PWA móvil completa
│   │   ├── entregas/           # Lista de entregas
│   │   ├── home/               # Dashboard repartidor
│   │   └── ruta/[ruta_id]/     # ⭐ Hoja ruta con GPS tracking
│   ├── api/                     # Endpoints API
│   │   ├── bot/                # Webhook WhatsApp
│   │   ├── rutas/              # ⭐ Generación y optimización
│   │   ├── reparto/            # ⭐ GPS tracking y alertas
│   │   └── integrations/       # ⭐ Google Directions
│   └── login/                  # Autenticación
├── actions/                     # Server Actions (lógica de negocio)
│   ├── plan-rutas.actions.ts   # ⭐ Gestión planificación semanal
│   └── [otros].actions.ts      # Módulos específicos
├── components/                  # Componentes React reutilizables
│   ├── reparto/                # ⭐ Monitor GPS y GPS tracker
│   │   ├── MonitorMap.tsx     # Mapa Google Maps admin (tiempo real)
│   │   ├── RutaMap.tsx        # Mapa Google Maps para visualización de rutas
│   │   └── GpsTracker.tsx     # GPS tracking PWA
│   ├── tables/                 # Tablas con TanStack
│   ├── forms/                  # Formularios con validación
│   ├── ui/                     # shadcn/ui + componentes base
│   └── layout/                 # Layouts admin/repartidor
├── lib/                         # Utilidades y configuración
│   ├── rutas/                  # ⭐ Algoritmos optimización
│   │   ├── google-directions.ts # Google Directions API
│   │   └── local-optimizer.ts   # Fallback local
│   ├── services/               # ⭐ Servicios core
│   │   └── ruta-optimizer.ts   # Optimización híbrida
│   └── supabase/               # Clientes y configuración
├── store/                       # Zustand (estado mínimo)
└── types/                       # TypeScript types completas

supabase/                        # Scripts SQL y migraciones
├── migrations/                  # Historial BD (9 migraciones)
└── *.sql                        # Funciones RPC y setup

public/
├── images/
│   └── logo-avicola.png        # Logo empresa
└── [static assets]

scripts/                         # Scripts de automatización
├── demo-rutas.sh               # ⭐ Demo completo rutas
├── setup-bot-automatico.sh    # Configuración WhatsApp
└── [otros scripts]
```

## 🎯 Características del Sistema - COMPLETO

### 🗓️ **Planificación Semanal de Rutas**
- **Nueva tabla**: `plan_rutas_semanal` con zona/día/turno/vehículo/capacidad
- **Vehículos base**: Fiorino (600kg), Hilux (1500kg), F-4000 (4000kg) precargados
- **UI completa**: `/reparto/planificacion` para crear/editar/eliminar planes semanales
- **Planificación operativa**: Se usa para planificar y visualizar asignaciones (zona/día/turno) en el módulo de Reparto
- **Asignación de pedidos a ruta**: En el flujo de Almacén, se realiza por `zona_id + fecha + turno` vía RPC `fn_asignar_pedido_a_ruta` (no depende estrictamente del plan semanal)
- **Validación capacidad**: Peso final ≤ capacidad del vehículo planificada

### 🤖 **Bot WhatsApp Automatizado**
- **Procesamiento directo**: Sin Botpress, implementación nativa en Next.js
- **Comandos inteligentes**: `hola`, `catalogo`, `pedido POLLO001 5kg`
- **Validación stock**: Consulta lotes disponibles en tiempo real
- **Reserva automática**: FIFO inteligente al crear presupuestos
- **Confirmación explícita**: SÍ/NO obligatorio antes de procesar

### 📱 **PWA Móvil Completa para Repartidores**
- **App nativa-like**: Dashboard, entregas, GPS tracking
- **Hoja ruta digital**: `/repartidor/ruta/[ruta_id]` con optimización visual
- **GPS tracking**: Envío automático cada 5s durante reparto activo
- **Registro de pagos**: 5 estados disponibles:
  - "Ya pagó" (monto completo)
  - "Pendiente de pago" (método definido)
  - "Pagará después" (sin método)
  - "Pagó parcialmente" (monto parcial con saldo)
  - "Rechazó el pedido" (con motivo de rechazo)
- **Pago obligatorio**: Se requiere registrar estado de pago ANTES de marcar como entregado
- **Validación requerida**: Todas las entregas deben tener estado de pago definido antes de finalizar ruta
- **Firma digital**: QR verificación + subida automática a Storage

### 🗺️ **Optimización de Rutas Híbrida**
- **OpenRouteService (ORS)**: Routing con datos de OpenStreetMap actualizados (resuelve problemas de sentidos únicos desactualizados)
- **Fallback Google/local**: Google Directions API + Nearest Neighbor + 2-opt cuando ORS falla
- **Polylines reales**: Rutas que siguen las calles (no líneas rectas)
- **Orden optimizado**: ORS optimiza el orden de visita por distancia/tiempo
- **Re-optimización**: Automática al agregar nuevos pedidos
- **Monitor admin**: Mapa Google Maps con tracking en tiempo real
- **Sincronización**: Vista del repartidor muestra el mismo orden que el monitor

### 📍 **GPS Tracking y Alertas**
- **Polling inteligente optimizado**: Adaptativo (10-60s según vehículos), pausa automática cuando pestaña oculta, actualización manual disponible
- **Alertas automáticas**: Desvío (>200m), cliente saltado (<100m)
- **Monitor en tiempo real**: `/reparto/monitor` con mapa Google Maps mejorado
- **Visualización Avanzada**: 
  - 🎨 **Rutas por color**: Cada ruta con color distintivo (polyline + vehículo + clientes)
  - 📍 **Marcadores de estado**: Clientes pendientes, entregados y con problemas
  - 📊 **Panel lateral**: Estadísticas en tiempo real y progreso por ruta
  - 🚚 **Info detallada**: Vehículos con animación y datos completos
  - 📦 **Desglose de Grupos**: Visualización individual de entregas dentro de pedidos agrupados
  - ✨ **Sin duplicados**: Deduplicación inteligente de clientes
  - 📱 **UI mejorada**: Manejo de direcciones vacías, agrupación de productos
- **Numeración Secuencial**: Orden de visita estricto (1, 2, 3...) recalculado dinámicamente
- **Historial completo**: Rutas_planificadas con orden visita y tiempos
- **Trazabilidad total**: Desde ubicación hasta entrega confirmada

### ⚖️ **FIFO Automático de Stock**
- **Descuento inteligente**: Lotes ordenados por vencimiento/ingreso
- **Reserva preventiva**: Presupuestos no descuentan físicamente
- **Conversión automática**: Al pasar a pedido, descuento real
- **Trazabilidad lote**: Cada ítem ligado a lote específico
- **Movimientos auditados**: Tabla `movimientos_stock` completa

### 💰 **Tesorería Completa**
- **Cuentas corrientes**: Control automático de saldos por cliente
  - Página `/ventas/clientes/[id]/cuenta-corriente` con resumen de cuenta
  - Formulario para registrar pagos (efectivo, transferencia, tarjeta, cheque)
  - Pagos se acreditan automáticamente en Caja Central
  - Botón "Desbloquear Cliente" para casos especiales
- **Facturas con Estado de Pago**:
  - Estados: `pendiente`, `parcial`, `pagada`, `anulada`
  - Trigger automático actualiza estado según pagos recibidos
  - Tabla visual con badges y colores por estado
- **Sistema de Moras** (integrado en `/tesoreria/cuentas-corrientes`):
  - Clientes morosos ordenados por días vencidos
  - Cálculo automático de mora: `saldo * (% mensual / 100) * (días / 30)`
  - Configuración por cliente: días de gracia, % mora mensual
  - Badges de urgencia y botones de contacto (WhatsApp, teléfono)
- **Cajas múltiples**: Por sucursal con cierres automáticos
- **Movimientos atómicos**: RPC `fn_crear_movimiento_caja()`
- **Referencias pago**: PAY-YYYYMMDD-XXXXXX para seguimiento
- **Validación de cobros**: Repartidores registran pagos durante ruta, tesorero valida antes de acreditar en caja
- **Reportes CSV/PDF**: Business intelligence completa

### 👥 **RRHH (Recursos Humanos) - COMPLETO**
- **Gestión de empleados**: CRUD completo con datos personales, laborales y bancarios
- **Control de asistencia**: Registro diario con reglas críticas (1 falta sin aviso = pérdida presentismo + jornal)
- **Liquidaciones automáticas**: Cálculo mensual con horas extras, producción y descuentos
- **Configuración de liquidaciones**: Nueva sección `/rrhh/liquidaciones/configuracion` para definir días base por período y parámetros por puesto (jornada, turno especial y cajero)
- **Ajustes manuales RRHH**: En `/rrhh/liquidaciones/calcular` se pueden cargar horas adicionales y turnos especiales manuales por empleado al momento del cálculo
- **Planilla de liquidación robusta**: Corrección de acceso en `/rrhh/liquidaciones/[id]` para evitar 404 falsos por diferencias de permisos
- **Fuente unificada de empleados en formularios RRHH**: Evaluaciones, licencias, asistencia y adelantos consumen la misma acción server-side que `/rrhh/empleados`
- **Adelantos controlados**: Gestión de adelantos en dinero/productos con límite automático del 30% del sueldo básico
- **Licencias y descansos**: Gestión de vacaciones, enfermedad, maternidad, estudio
- **Evaluaciones de desempeño**: Sistema por sucursal con 5 criterios (escala 1-5). **Huella Digital Operativa** implementada: panel automático que sugiere puntajes basados en datos reales de asistencia, ventas y responsabilidad.
- **Novedades internas**: Comunicación segmentada (general, sucursal, categoría)
- **Reportes avanzados**: 6 tipos de reportes exportables (Excel/CSV)

### 💵 **Sistema de Listas de Precios**
- **Listas base**: Minorista, Mayorista, Distribuidor (asignación automática por tipo_cliente)
- **Asignación dual**: Cada cliente puede tener hasta 2 listas (1 automática + 1 manual)
- **Margen de ganancia**: Configuración por lista para cálculo automático desde precio_costo
- **Vigencia opcional**: Por defecto las listas están siempre vigentes. Se puede activar validación por fechas (`vigencia_activa`)
- **Precios manuales**: Gestión individual de precios por producto en cada lista
- **Selección en presupuestos**: Vendedor elige qué lista usar al crear presupuestos
- **Bot integrado**: Usa automáticamente la primera lista asignada del cliente
- **Herencia en pedidos**: Los pedidos heredan la lista del presupuesto

### 📦 **Configuración de Productos Mayoristas**
- **Unidad Mayor Personalizada**: Cada producto puede tener su propia unidad mayor configurada (`unidad_mayor_nombre`: "caja", "bolsa", "pallet", etc.)
- **Peso por Unidad Mayor**: Cada producto define su propio `kg_por_unidad_mayor` (no todos son 20 kg)
- **Visualización Consistente**: El sistema muestra la unidad y peso configurados en cada producto en todos los lugares:
  - Presupuestos del Día (card "Ver productos")
  - Ver Detalles de Presupuesto
  - Formulario de Pesaje
  - Crear Presupuesto
  - Monitor GPS y rutas
- **Sin Fallbacks Hardcodeados**: El sistema usa los valores configurados en cada producto, sin asumir valores por defecto incorrectos
- **Pluralización Inteligente**: Muestra "1 caja" o "2 caja(s)" según corresponda

### 🔐 **Seguridad y Roles**
- **4 roles definidos**: admin, vendedor, repartidor, almacenista
- **RLS completo**: Políticas por tabla/rol en Supabase
- **Server Actions**: Toda lógica crítica protegida
- **Validaciones preventivas**: Clientes deudores bloqueados
- **Auditoría completa**: Logs de todas las operaciones

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Preview de producción
npm run start

# Linting
npm run lint

# Verificar datos/configuración del bot
npm run verificar-bot

# Tests puntuales
npm run test:sucursales
```

## 🎯 Flujo de Presupuestos - COMPLETO

### Estado: ✅ IMPLEMENTADO Y VERIFICADO

Sistema completo de presupuestos que transforma el proceso operativo:

**Flujo**: `Bot/Vendedor → Presupuesto (Auto: Turno + Fecha + Estado) → Almacén (Pesaje) → Pedido → Reparto → Tesorería`

### Características Principales
- 🤖 **Bot WhatsApp con Vertex AI**: Gemini 1.5 Flash para conversaciones naturales 24/7
  - 5 tools: consultar-precios, consultar-stock, consultar-estado, consultar-saldo, crear-reclamo
  - **Memory Bank Inteligente**: Extracción automática de hechos y preferencias (tipo de negocio, productos favoritos, etc.)
  - **Contexto Conversacional**: Entiende respuestas cortas gracias al historial integrado en el prompt de intención.
  - **Persistencia de Intentos**: El bot "recuerda" el pedido iniciado por un cliente no registrado y lo retoma automáticamente tras el alta.
  - Creación de presupuestos vía RPC sin validación de usuario (bypass)
- 📋 **Números Únicos**: PRES-YYYYMMDD-XXXX con links de seguimiento
- ⏰ **Asignación Automática de Turno**: Al crear presupuesto, se asigna turno según horario:
  - Antes de 5:00 AM → Turno mañana del mismo día
  - Entre 5:00 AM y 3:00 PM → Turno tarde del mismo día
  - Después de 3:00 PM → Turno mañana del día siguiente
- 📅 **Fecha Automática**: Fecha de entrega estimada se asigna automáticamente (editable)
- 🏭 **Control de Almacén**: 
  - Presupuestos se crean directamente en estado `'en_almacen'` para aparecer automáticamente en "Presupuestos del Día"
  - Reserva preventiva + pesaje obligatorio para productos de categoría "balanza"
  - Conversión masiva e individual a pedidos desde "Presupuestos del Día"
- 🚛 **Reparto Integrado**: PWA completa con registro de entregas, cobros (múltiples métodos) y devoluciones
- 💰 **Tesorería Tiempo Real**: Movimientos automáticos por operaciones, totales por método de pago
- 👥 **Clientes Deudores**: Todos los clientes son deudores hasta confirmar reparto
- 💳 **Múltiples Métodos de Pago**: Soporte para efectivo, transferencia, QR, tarjeta, cuenta corriente con recargos
- 🚚 **Asignación Automática**: Vehículos asignados automáticamente según peso y capacidad
- **Selectores Buscables**: Búsqueda por código o nombre en selectores de clientes y productos
- 🆕 **Tipo de Venta**: Campo `tipo_venta` en presupuestos para diferenciar entre "Reparto" (entrega a domicilio) y "Retira en Casa Central" (sin rutas ni reparto)
- 📦 **Pedidos en Almacén**: Módulo de Pedidos movido de Ventas a Almacén para mejor organización operativa

### Cómo Probar la Demo
```bash
# Verificar implementación completa
./scripts/demo-presupuestos.sh

# Endpoints de testing
POST /api/almacen/simular-peso     # Simular balanza
POST /api/reparto/entrega         # Registrar entrega
GET /api/tesoreria/movimientos-tiempo-real  # Ver caja
```

---

## 🎯 Modelo de Pedidos Agrupados por Turno/Zona/Fecha (Dic 2025)

### Estado: ✅ IMPLEMENTADO COMPLETAMENTE

**Revolución en el flujo operativo**: Sistema único donde un pedido agrupa automáticamente todas las entregas del mismo turno + zona + fecha, transformando la logística y simplificando la gestión.

### Arquitectura del Nuevo Modelo

#### 1. **Nueva Tabla: `entregas`**
Cada entrega representa la porción específica de un pedido para un cliente individual:

- `id`, `pedido_id`, `cliente_id`, `presupuesto_id` (referencias)
- `subtotal`, `recargo`, `total` (montos por entrega)
- `direccion`, `coordenadas` (ubicación histórica)
- `orden_entrega` (secuencia en la ruta)
- `estado_entrega` ('pendiente', 'en_camino', 'entregado', 'fallido', 'parcial')
- `estado_pago` ('pendiente', 'parcial', 'pagado', 'fiado')
- `metodo_pago`, `monto_cobrado`, `referencia_pago`
- `pago_validado` (control de tesorería)

#### 2. **Pedido = Ruta de Entregas**
- **Un pedido** = **Una ruta** = **Múltiples entregas** para diferentes clientes
- **Agrupación automática** por: `turno + zona + fecha_entrega_estimada`
- **Cierre automático** cuando pasa el horario de corte del turno
- **Cliente_id opcional** en pedidos (ya no es 1 cliente por pedido)

#### 3. **Flujo Operativo Transformado**
```
Cliente A pide → Presupuesto A → Conversión → Entrega A en Pedido XYZ
Cliente B pide → Presupuesto B → Conversión → Entrega B en Pedido XYZ
Cliente C pide → Presupuesto C → Conversión → Entrega C en Pedido XYZ

Resultado: 1 Pedido (XYZ) con 3 Entregas (A, B, C) en 1 ruta
```

### Funcionalidades Implementadas

#### 🔄 **Conversión Automática y Agrupada**
- **Función principal**: `fn_obtener_o_crear_pedido_abierto(zona_id, turno, fecha)`
- **Lógica inteligente**: Busca pedido abierto existente o crea nuevo
- **Validación de horarios**: Bloquea creación si pasó el horario de corte:
  - Turno mañana: cierra automáticamente a las 5:00 AM
  - Turno tarde: cierra automáticamente a las 3:00 PM
- **Agrupación transparente**: Todos los presupuestos del mismo turno/zona/fecha van al mismo pedido

#### 🛒 **Gestión de Entregas Individuales**
- **Cobros por cliente**: Cada entrega tiene su propio estado de pago
- **Referencias únicas**: `PAY-YYYYMMDD-XXXXXX` por entrega
- **Métodos de pago flexibles**: efectivo, transferencia, QR, tarjeta, cuenta corriente
- **Estados detallados**: pendiente → pagado/parcial/fiado con montos precisos
- **Cuenta corriente individual**: Cada cliente mantiene su saldo independiente

#### 📊 **Vista Administrativa Mejorada**
- **Lista de entregas por pedido**: Expansible con detalles por cliente
- **Resumen de cobros**: Total cobrado vs pendiente vs fiado
- **Estado de cierre**: Pedidos abiertos vs cerrados automáticamente
- **Navegación intuitiva**: De pedido → entregas → clientes individuales

#### 📱 **PWA Repartidor Optimizada**
- **Entregas individuales**: Formulario específico por cliente
- **Registro de cobros**: Estado + método + monto por entrega
- **Marcado de estados**: Entregado/Fallido con notas específicas
- **Validación requerida**: Todas las entregas deben tener estado definido

#### 💰 **Tesorería por Entrega**
- **Validación individual**: Tesorero valida cada entrega por separado
- **Movimientos agrupados**: Crea movimientos de caja por método de pago
- **Cuenta corriente**: Actualiza saldo de cada cliente independientemente
- **Trazabilidad completa**: Quién cobró, quién validó, cuándo

### Funciones SQL Clave

```sql
-- Obtener o crear pedido abierto para turno/zona/fecha
SELECT fn_obtener_o_crear_pedido_abierto('uuid-zona', 'mañana', '2025-12-02'::date);

-- Agregar presupuesto como entrega a pedido existente
SELECT fn_agregar_presupuesto_a_pedido('uuid-presupuesto', 'uuid-pedido', 'uuid-usuario');

-- Convertir presupuesto (agrupa automáticamente)
SELECT fn_convertir_presupuesto_a_pedido('uuid-presupuesto', 'uuid-usuario', NULL);

-- Registrar cobro de entrega específica
SELECT fn_registrar_cobro_entrega('uuid-entrega', 'efectivo', 1250.50, 'uuid-repartidor');

-- Marcar entrega como completada
SELECT fn_marcar_entrega_completada('uuid-entrega');

-- Cerrar pedidos automáticamente por horario
SELECT fn_cerrar_pedidos_por_horario(); -- Devuelve cantidad de pedidos cerrados

-- Obtener entregas de un pedido
SELECT * FROM fn_obtener_entregas_pedido('uuid-pedido');
```

### Beneficios Operativos

#### 🚀 **Eficiencia Logística**
- **Una sola ruta** = **Un pedido** = **Múltiples entregas**
- **Optimización automática** de rutas por zona completa
- **Vehículos asignados** por capacidad total del pedido
- **GPS tracking** para toda la ruta, no por cliente

#### 💰 **Control Financiero Preciso**
- **Cobros por cliente** con referencias individuales
- **Validación de tesorería** por entrega específica
- **Cuenta corriente** actualizada en tiempo real por cliente
- **Reportes detallados** de recaudación por método y cliente

#### 📱 **Experiencia del Repartidor**
- **Hoja de ruta clara** con orden de entregas
- **Registro simple** de cobros por cliente
- **Estados flexibles** (pagado/parcial/fiado) por entrega
- **Validación automática** antes de finalizar ruta

#### 📊 **Gestión Administrativa**
- **Vista consolidada** de entregas por pedido
- **Seguimiento individual** de cada cliente en la ruta
- **Reportes unificados** de rutas y entregas
- **Cierres automáticos** sin intervención manual

### Migración de Datos

#### 🔄 **Transición Transparente**
- **Pedidos históricos** marcados como `estado_cierre = 'cerrado'`
- **Índice único** solo aplica a pedidos nuevos del modelo agrupado
- **Compatibilidad total** con sistema existente
- **No afecta** operaciones en curso

#### 📈 **Escalabilidad**
- **Sin límite** de entregas por pedido
- **Rendimiento optimizado** con índices por zona/turno/fecha
- **Queries eficientes** para grandes volúmenes
- **Caché inteligente** en vistas administrativas

### Cómo Probar

#### 1. **Crear Presupuestos Agrupados**
```bash
# Cliente A - Zona Norte, Turno Mañana
POST /api/ventas/presupuestos
{
  "cliente_id": "uuid-cliente-a",
  "items": [{"producto_id": "uuid-pollo", "cantidad": 5}],
  "zona_id": "uuid-zona-norte"
}

# Cliente B - MISMA Zona Norte, Turno Mañana
POST /api/ventas/presupuestos
{
  "cliente_id": "uuid-cliente-b",
  "items": [{"producto_id": "uuid-huevo", "cantidad": 10}],
  "zona_id": "uuid-zona-norte"
}
```

#### 2. **Conversión Automática**
```bash
# Ambos presupuestos van al mismo pedido automáticamente
POST /api/almacen/presupuestos/convertir-masivo
{
  "presupuestos_ids": ["uuid-presupuesto-a", "uuid-presupuesto-b"]
}
# Resultado: 1 pedido con 2 entregas
```

#### 3. **Registro de Cobros (Repartidor)**
```bash
# Cobrar al cliente A
POST /api/entregas/registrar-cobro
{
  "entrega_id": "uuid-entrega-a",
  "metodo_pago": "efectivo",
  "monto_cobrado": 2500.00
}

# Cliente B pagará después
POST /api/entregas/registrar-cobro
{
  "entrega_id": "uuid-entrega-b",
  "metodo_pago": "cuenta_corriente",
  "monto_cobrado": 0
}
```

#### 4. **Validación de Tesorería**
```bash
# Tesorero valida todas las entregas del pedido
POST /api/tesoreria/validar-entregas
{
  "pedido_id": "uuid-pedido",
  "caja_id": "uuid-caja",
  "observaciones": "Validación completa de ruta"
}
```

### Endpoints Nuevos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/entregas/pedido/[pedido_id]` | Lista entregas de un pedido |
| `GET` | `/api/entregas/[entrega_id]` | Detalle de entrega específica |
| `POST` | `/api/entregas/registrar-cobro` | Registrar cobro de entrega |
| `POST` | `/api/entregas/marcar-completada` | Marcar entrega como entregada |
| `POST` | `/api/entregas/marcar-fallida` | Marcar entrega como fallida |
| `GET` | `/api/entregas/resumen/[pedido_id]` | Resumen de entregas |
| `POST` | `/api/tesoreria/validar-entregas` | Validar cobros de entregas |
| `GET` | `/api/tesoreria/pedidos-pendientes-validacion` | Pedidos pendientes de validación |

### Páginas Actualizadas

- **`/almacen/pedidos/[id]`**: Nueva sección "Entregas del Pedido"
- **`/repartidor/ruta/[ruta_id]/entrega/[entrega_id]`**: Formulario por cliente individual
- **`/tesoreria/validar-rutas`**: Nueva opción para validar entregas por pedido

### Scripts de Prueba

```bash
# Ejecutar migración
psql -U postgres -d avicola_db -f supabase/migrations/20251202_refactor_pedidos_agrupados.sql

# Verificar estructura
SELECT * FROM entregas LIMIT 5;
SELECT pedido_id, COUNT(*) as entregas FROM entregas GROUP BY pedido_id;

# Probar funciones
SELECT fn_obtener_o_crear_pedido_abierto('uuid-zona', 'mañana', CURRENT_DATE);
SELECT fn_cerrar_pedidos_por_horario();
```

---

## ⚡ Mejoras al Flujo de Ventas (Nov 2025)

### Estado: ✅ IMPLEMENTADAS

Sistema mejorado con validaciones críticas y automatizaciones para mayor confiabilidad operativa:

### 🔴 Críticas (Alta Prioridad Implementadas)

#### 1. ✅ Validación de Stock Real en Presupuestos
- **Problema resuelto**: Ya no se crean presupuestos sin stock suficiente
- **Implementación**: `fn_crear_presupuesto_desde_bot()` valida lotes disponibles ANTES de crear
- **Beneficio**: Evita promesas incumplibles al cliente, mejora confianza
- **Mensaje al cliente**: "Stock insuficiente para [producto]. Disponible: X kg/u"

#### 2. ✅ Campo Peso Total Automático
- **Nueva columna**: `peso_total_kg` en tabla `presupuestos`
- **Trigger automático**: Recalcula peso al crear/modificar items
- **Beneficio**: Asignación de vehículos precisa basada en peso real
- **Uso**: `fn_asignar_vehiculos_por_peso()` usa peso_total_kg en lugar de estimaciones

#### 3. ✅ Conversión Parcial de Pedidos
- **Parámetro nuevo**: `p_permitir_parcial` en `fn_convertir_presupuesto_a_pedido()`
- **Lógica**: Convierte solo items con stock disponible si se permite
- **Retorno**: Indica items omitidos con motivo y cantidades
- **Beneficio**: Mayor flexibilidad operativa ante faltantes

#### 4. 🟡 Expiración Automática de Reservas
- **Estado**: Función creada, requiere activación manual de pg_cron
- **Función**: `fn_expirar_reservas()` marca reservas vencidas (>24h)
- **Configuración**: Ejecutar `SELECT fn_configurar_expirar_reservas()` en Supabase
- **Beneficio**: Libera stock bloqueado automáticamente

### 🟡 Importantes (Media Prioridad Implementadas)

#### 5. ✅ Notificaciones Automáticas por WhatsApp
- **Helper creado**: `/src/lib/services/notificaciones.ts`
- **Tipos soportados**: 
  - `presupuesto_creado`: Confirmación al cliente con turno y total
  - `pedido_confirmado`: Pedido en preparación
  - `en_camino`: Repartidor en ruta con datos del vehículo
  - `entregado`: Confirmación de entrega exitosa
  - `cancelado`: Notificación de cancelación con motivo
- **Integración**: Automática en `crearPresupuestoAction()` y `confirmarPresupuestoAction()`
- **Historial**: Nueva tabla `notificaciones_clientes` para auditoría completa
- **Proveedor**: Envío por Twilio (Twilio-only) o Meta según `WHATSAPP_PROVIDER`

#### 6. ✅ Cálculo de Tiempos de Entrega
- **Función**: `calcularTiempoEntrega(zonaId, turno, fechaEntrega)`
- **Lógica**: Analiza rutas históricas de la zona para estimar ventanas
- **Retorno**: `{ventana_inicio, ventana_fin}` personalizado por zona
- **Beneficio**: Clientes reciben estimación realista de llegada
- **Pendiente**: Integración en UI de presupuestos

#### 7. ✅ Módulo de Sucursales Completo
- **Gestión Multi-Sucursal**: CRUD completo de sucursales con configuración individual.
- **Transferencias de Stock**: Flujo completo de solicitud, aprobación y recepción de mercadería entre sucursales.
- **Dashboard Individual**: Vista detallada por sucursal con KPIs, inventario y movimientos recientes.
- **Alertas de Stock**: Configuración de umbrales y notificaciones automáticas.

#### 8. ✅ Sistema de Notificaciones UI
- **Campana en Header**: Notificaciones en tiempo real para usuarios administrativos.
- **Gestión**: Marcar como leída, ver historial, notificaciones push en navegador.
- **Integración**: Conectado a eventos del sistema (stock bajo, nuevos pedidos, transferencias).

### Funciones SQL Mejoradas

```sql
-- Crear presupuesto con validaciones
SELECT fn_crear_presupuesto_desde_bot(
    p_cliente_id := 'uuid-cliente',
    p_items := '[{"producto_id": "uuid", "cantidad": 5}]'::jsonb,
    p_observaciones := 'Pedido desde WhatsApp'
);

-- Convertir con opción parcial
SELECT fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id := 'uuid-presupuesto',
    p_user_id := 'uuid-usuario',
    p_caja_id := NULL,
    p_permitir_parcial := true  -- Nuevo parámetro
);

-- Asignar vehículos por peso real
SELECT * FROM fn_asignar_vehiculos_por_peso(
    p_fecha := '2025-11-30'::date,
    p_zona_id := 'uuid-zona',
    p_turno := 'mañana'
);

-- Crear transferencia de stock
SELECT * FROM fn_crear_transferencia_stock(
    p_sucursal_origen_id := 'uuid-origen',
    p_sucursal_destino_id := 'uuid-destino',
    p_items := '[{"producto_id": "uuid", "cantidad": 10}]'::jsonb,
    p_user_id := 'uuid-user'
);

-- Configurar expiración automática (una sola vez)
SELECT fn_configurar_expirar_reservas();
```

### Nuevas Migraciones

- `20251130_mejoras_flujo_ventas.sql`: Mejoras críticas completas
- `20251130_tabla_notificaciones.sql`: Historial de notificaciones clientes
- `20251130_transferencias_sucursales.sql`: Tablas y funciones para transferencias
- `20251130_notificaciones_rls.sql`: Sistema de notificaciones UI y RLS

### Impacto Operativo

**Antes de las mejoras:**
- ❌ Presupuestos creados sin stock → Promesas incumplibles
- ❌ Vehículos mal asignados → Sobrecarga o desperdicio
- ❌ Reservas bloqueadas indefinidamente → Stock no disponible
- ❌ Clientes sin información → Consultas constantes
- ❌ Gestión de sucursales manual → Descontrol de stock

**Después de las mejoras:**
- ✅ Solo presupuestos con stock confirmado
- ✅ Vehículos asignados según peso real
- ✅ Stock se libera automáticamente cada 15 minutos
- ✅ Clientes reciben actualizaciones automáticas por WhatsApp
- ✅ Control total de stock y movimientos entre sucursales

---

## 🤖 Bot de WhatsApp

### Estado: ✅ FUNCIONANDO + ACTUALIZADO

El bot está completamente funcional y ahora incluye el nuevo flujo de presupuestos:

**Comandos disponibles:**
- `hola` / `menu` - Ver menú principal
- `1` - Ver catálogo de productos con stock en tiempo real
- `2` - Crear presupuesto (instrucciones)
- `3` - Consultar pedidos y presupuestos
- `POLLO001 5` - Crear presupuesto (código + cantidad)
- `POLLO001 5, HUEVO001 2` - Presupuesto múltiple
- `SÍ` / `NO` - Confirmar o cancelar presupuesto
- `estado PED-XXXXX` - Ver estado de pedido
- `estado PRES-XXXXX` - Ver estado de presupuesto

**Características implementadas:**
- ✅ Validación de stock en tiempo real desde lotes
- ✅ Descuento automático de stock con FIFO (First In, First Out)
- ✅ Confirmación antes de crear pedido
- ✅ Pedidos simples y múltiples
- ✅ Consulta de estado de pedidos
- ✅ Historial de pedidos del cliente
- ✅ Verificación de horario de atención
- ✅ Menú interactivo numérico
- ✅ Indicadores de stock (🟢🟡🔴)
- ✅ Agrupación de productos por categoría
- ✅ Trazabilidad completa (qué lote se usó en cada pedido)
- ✅ **Referencias de pago** automáticas para pedidos con pago diferido
- ✅ **Instrucciones para repartidores** con monto y referencia de pago

**Configuración:**
1. Crear cuenta en Twilio: https://www.twilio.com
2. Activar WhatsApp Sandbox
3. Autenticar Twilio CLI: `twilio login`
4. Configurar variables de entorno en `.env.local`
5. Configurar webhook en Twilio apuntando a `/api/bot`

**Pruebas:**
- Sandbox permite hasta 5 números de WhatsApp simultáneos
- Para producción, solicitar WhatsApp Business API a Meta
- Uso estimado: ~$0.005 por mensaje

**Flujo técnico:**
```
Cliente (WhatsApp) → Twilio → /api/bot/route.ts →
Server Actions → fn_crear_presupuesto_desde_bot() →
Reserva preventiva de stock → Respuesta con número PRES-XXXXX
```

---

## 🧪 Guía de Pruebas

### 📋 Checklist Completo de Pruebas

**Ver la guía completa de pruebas en [`TESTING.md`](./TESTING.md)** que incluye:

- ✅ Flujo completo Bot → Ventas → Almacén → Reparto → Tesorería
- ✅ Pruebas de cada módulo individual
- ✅ Endpoints de API para testing
- ✅ Funciones RPC de Supabase
- ✅ Validaciones de datos y consistencia
- ✅ Problemas comunes y soluciones

### 🚀 Inicio Rápido de Pruebas

**1. Flujo End-to-End Básico (10 minutos):**

```bash
# 1. Cliente crea presupuesto vía WhatsApp
Enviar: POLLO001 5
Recibir: PRES-YYYYMMDD-XXXX + link

# 2. Vendedor gestiona presupuesto
URL: /ventas/presupuestos/[id]
- Asignar zona y turno
- Enviar a almacén (o facturar directo si no hay pesables)

# 3. Almacén procesa pesaje
URL: /almacen/presupuestos-dia
- Seleccionar presupuesto
- Pesar productos de categoría "balanza"
- Finalizar presupuesto

# 4. Sistema convierte automáticamente
- Presupuesto → Pedido
- Stock descontado
- Pedido disponible para ruta

# 5. Repartidor registra entrega
URL: /repartidor/ruta/[ruta_id]/entrega/[entrega_id]
- Registrar cobro (múltiples métodos de pago)
- Registrar devolución (si aplica)
- Marcar como entregado

# 6. Tesorería verifica
URL: /tesoreria/movimientos
- Ver movimientos en tiempo real
- Verificar totales por método de pago
- Verificar caja central actualizada
```

**2. Endpoints de Testing:**

```bash
# Simular peso de balanza
curl -X POST http://localhost:3000/api/almacen/simular-peso \
  -H "Content-Type: application/json" \
  -d '{"presupuesto_item_id": "uuid-del-item"}'

# Finalizar presupuesto en almacén
curl -X POST http://localhost:3000/api/almacen/presupuesto/finalizar \
  -H "Content-Type: application/json" \
  -d '{"presupuesto_id": "uuid-presupuesto"}'

# Registrar cobro desde reparto
curl -X POST http://localhost:3000/api/reparto/entrega \
  -H "Content-Type: application/json" \
  -d '{
    "pedido_id": "uuid-pedido",
    "metodo_pago": "efectivo",
    "monto_cobrado": 1250.50
  }'

# Registrar devolución
curl -X POST http://localhost:3000/api/reparto/devoluciones \
  -H "Content-Type: application/json" \
  -d '{
    "pedido_id": "uuid-pedido",
    "producto_id": "uuid-producto",
    "cantidad": 2,
    "motivo": "producto_dañado"
  }'

# Ver movimientos de tesorería en tiempo real
curl http://localhost:3000/api/tesoreria/movimientos-tiempo-real

# Facturar presupuesto directo (sin almacén)
curl -X POST http://localhost:3000/api/ventas/presupuestos/facturar \
  -H "Content-Type: application/json" \
  -d '{"presupuesto_id": "uuid-presupuesto"}'
```

**3. Funciones RPC de Supabase:**

En Supabase SQL Editor:
```sql
-- Verificar reserva preventiva de stock
SELECT * FROM fn_reservar_stock_por_presupuesto('uuid-presupuesto');

-- Actualizar peso de item pesable
SELECT * FROM fn_actualizar_peso_item_presupuesto('uuid-item', 5.25);

-- Convertir presupuesto a pedido
SELECT * FROM fn_convertir_presupuesto_a_pedido(
  'uuid-presupuesto',
  'uuid-usuario',
  'uuid-caja'
);

-- Asignar vehículos por peso
SELECT * FROM fn_asignar_vehiculos_por_peso('2025-11-20'::date, 'tarde'::text);

-- Registrar cobro desde reparto
SELECT * FROM fn_registrar_cobro_reparto(
  'uuid-pedido',
  'efectivo'::text,
  1250.50,
  'uuid-repartidor',
  NULL,
  NULL
);
```

### ✅ Checklist de Validación Rápida

**Funcionalidades Core:**
- [ ] Bot crea presupuestos con números únicos (PRES-YYYYMMDD-XXXX)
- [ ] Clientes se crean como deudores por defecto
- [ ] Presupuestos soportan múltiples métodos de pago con recargos
- [ ] Reserva preventiva de stock (no descuenta físicamente)
- [ ] Vendedor puede facturar directo (sin productos pesables)
- [ ] Vendedor puede enviar a almacén
- [ ] Almacén ve totales por zona/turno y asigna vehículos automáticamente
- [ ] Almacén puede pesar productos de categoría "balanza"
- [ ] Almacén puede finalizar presupuesto → convierte a pedido
- [ ] Repartidor ve rutas y puede registrar cobros/devoluciones
- [ ] Tesorería muestra movimientos en tiempo real

**Validaciones de Datos:**
- [ ] Stock se descuenta correctamente después de finalizar
- [ ] Precios se recalculan según peso real
- [ ] Totales son correctos en cada paso
- [ ] Estados se actualizan correctamente
- [ ] Movimientos de caja se registran automáticamente

**Ver la guía completa en [`TESTING.md`](./TESTING.md) para pruebas detalladas de cada módulo.**

## 💰 Tesorería y Gastos - COMPLETO

El hito intermedio incorpora la capa financiera básica y el sistema de validación de cobros:

- ✅ Tesorería con cajas por sucursal y movimientos ligados a pedidos.
- ✅ Registro de gastos con categorías, **adjuntos en Supabase Storage** (imágenes y PDFs) y opción de afectar caja en la misma transacción.
- ✅ Cuentas corrientes de clientes con bloqueo automático cuando superan el límite de crédito.
- ✅ **Validación preventiva** de clientes bloqueados en formularios de pedidos.
- ✅ Reportes de ventas, gastos, movimientos de caja y cuentas corrientes con **export CSV y PDF** server-side.
- ✅ **Referencias de pago** generadas automáticamente para pedidos con pago diferido.
- ✅ **Instrucciones para repartidores** con monto y referencia de pago.
- ✅ **Sistema de validación de cobros**: Repartidores registran pagos durante la ruta (estado, método, monto), tesorero valida antes de acreditar en caja. Los movimientos de caja se crean solo tras validación del tesorero.

### 🔐 Sistema de Validación de Cobros

**Estado**: ✅ **IMPLEMENTADO** - Sistema completo de doble verificación para cobros de rutas

**Flujo de validación**:
1. **Repartidor en ruta**: Registra estado de pago para cada entrega (Ya pagó/Pendiente/Pagará después)
   - Si "Ya pagó": Registra método de pago, monto, número de transacción (si aplica), comprobante
   - Si "Pendiente": Registra método de pago previsto
   - Si "Pagará después": Solo registra notas
2. **Finalización de ruta**: Repartidor solo puede finalizar cuando todas las entregas tienen estado de pago definido
3. **Validación tesorero**: Tesorero revisa rutas completadas en `/tesoreria/validar-rutas`
   - Ve resumen de recaudación registrada con desglose por método de pago
   - Ingresa monto físico recibido y compara con registrado
   - Valida la ruta → sistema crea movimientos de caja agrupados por método
   - Marca pedidos como pagados y registra trazabilidad completa

**Características**:
- ✅ Cobros registrados NO afectan caja hasta validación del tesorero
- ✅ Validación requerida: Todas las entregas deben tener estado definido antes de finalizar ruta
- ✅ Movimientos de caja se crean agrupados por método de pago tras validación
- ✅ Trazabilidad completa: Tesorero validador, fecha de validación, observaciones
- ✅ Comparación de montos: Sistema muestra diferencia entre registrado y recibido
- ✅ Campos en BD: `detalles_ruta` tiene campos de tracking, `rutas_reparto` tiene campos de validación

**Páginas relacionadas**:
- `/repartidor/ruta/[ruta_id]/entrega/[entrega_id]` - Registro de pagos por repartidor
- `/tesoreria/validar-rutas` - Validación de rutas por tesorero
- `/reparto/rutas/[id]` - Vista detalle con estado de validación

### Endpoints nuevos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET/POST/PUT` | `/api/tesoreria/cajas` | Listar, crear y actualizar cajas. |
| `GET/POST` | `/api/tesoreria/movimientos` | Conciliar ingresos/egresos manuales y generar movimientos vía RPC. |
| `GET/POST` | `/api/gastos` | Listado de gastos y registro con afectación opcional a caja. **Soporta adjuntos en Storage**. |
| `GET/POST` | `/api/cuentas_corrientes` | Consultar cuentas y registrar pagos manuales de pedidos. |
| `POST` | `/api/reportes/export` | Genera **CSV o PDF** para ventas, gastos, movimientos de caja y cuentas corrientes. |
| `POST` | `/api/reparto/entrega` | Registrar entrega y estado de pago (sin crear movimientos de caja hasta validación). |
| `GET` | `/api/reparto/ubicacion-actual` | Obtener última ubicación GPS del repartidor/vehículo. |

### RPC / Funciones Supabase

- `fn_crear_movimiento_caja`: actualiza saldo y registra movimientos en una sola transacción.
- `fn_registrar_gasto`: inserta gasto y, si aplica, crea egreso de caja.
- `fn_crear_pago_pedido`: vincula cobros con pedidos y reduce cuentas corrientes.
- `fn_procesar_pedido`: flujo atómico de pedidos (web/bot) con descuento FIFO, cuentas corrientes, caja y **generación de referencia de pago**.
- `fn_crear_pedido_bot`: wrapper para pedidos creados desde WhatsApp.
- `fn_consultar_stock_por_lote`: consulta lotes disponibles ordenados por FIFO (fecha de vencimiento y fecha de ingreso).
- `fn_convertir_presupuesto_a_pedido`: convierte presupuesto a pedido con horarios de corte actualizados (5:00 AM y 15:00).
- `fn_actualizar_recaudacion_ruta`: actualiza automáticamente la recaudación total registrada de una ruta.
- `fn_obtener_ultima_ubicacion_por_vehiculo`: obtiene última ubicación GPS por vehículo.

### Cómo probar en ambiente de prueba

1. **Cajas y movimientos**
   - `POST /api/tesoreria/cajas` con nombre y saldo inicial.
   - `POST /api/tesoreria/movimientos` para registrar ingreso o egreso.
   - Verificar saldo con `GET /api/tesoreria/cajas`.
2. **Pedidos (web y bot)**
   - Crear pedido desde la UI o vía `crearPedido` server action.
   - **Validar bloqueo**: Intentar crear pedido para cliente con `bloqueado_por_deuda=true` - debe mostrar advertencia y bloquear submit.
   - Confirmar que `fn_procesar_pedido` descuente lotes, registre cuenta corriente, pago_estado y **genere referencia de pago**.
3. **Pagos y cuentas corrientes**
   - Usar el formulario en `/ventas/pedidos/[id]` o `POST /api/cuentas_corrientes` (action `registrarPago`).
   - Validar que el saldo pendiente se reduzca y la caja reciba el ingreso.
4. **Gastos con adjuntos**
   - Desde `/tesoreria/gastos`, usar el formulario para registrar un gasto.
   - **Subir archivo**: Seleccionar imagen (JPG/PNG) o PDF como comprobante (máx. 10MB).
   - Verificar que el archivo se suba a Supabase Storage en el bucket `gastos`.
   - Alternativamente, ingresar URL manual del comprobante.
5. **Reportes CSV y PDF**
   - Desde `/reportes`, seleccionar tipo de reporte (ventas, gastos, movimientos_caja, cuentas_corrientes).
   - Seleccionar formato **CSV** o **PDF**.
   - Verificar descarga del archivo generado.
   - PDF incluye título, encabezados, datos tabulados y paginación automática.
6. **Bot con referencias de pago**
   - Enviar "deuda" desde WhatsApp para ver saldo real desde `cuentas_corrientes`.
   - Crear pedido desde WhatsApp y verificar que el mensaje de confirmación incluya **referencia de pago** (formato: `PAY-YYYYMMDD-XXXXXX`).
   - Verificar que el pedido tenga `referencia_pago` y `instruccion_repartidor` en la base de datos.
7. **Consulta de stock por lote**
   - Ejecutar `SELECT * FROM fn_consultar_stock_por_lote(NULL)` para ver todos los lotes.
   - Ejecutar `SELECT * FROM fn_consultar_stock_por_lote('producto-uuid')` para filtrar por producto.
   - Verificar que los lotes estén ordenados por FIFO (vencimiento ASC, ingreso ASC).

Puedes reutilizar los ejemplos de `scripts/test-hito-intermedio.http` para disparar cada endpoint vía `curl` o REST Client.

## 🗄️ Base de Datos

El esquema completo de la base de datos se encuentra en `supabase/database-schema.sql`. Incluye:

- 15+ tablas principales
- Funciones RPC atómicas
- Políticas RLS por rol
- Índices optimizados
- Triggers y constraints

### Funciones RPC Principales

- `fn_crear_pedido_bot()`: Crea pedidos desde WhatsApp con descuento automático de stock por lotes (FIFO)
- `fn_procesar_pedido()`: Procesa pedidos (web/bot) con descuento FIFO, cuentas corrientes, caja y generación de referencia de pago
- `fn_consultar_stock_por_lote()`: Consulta lotes disponibles ordenados por FIFO (vencimiento e ingreso)
- `fn_crear_movimiento_caja()`: Crea movimientos de caja de forma atómica
- `fn_registrar_gasto()`: Registra gastos con opción de afectar caja
- `fn_crear_pago_pedido()`: Registra pagos de pedidos y actualiza cuentas corrientes
- `fn_validar_entrega()`: Valida entregas con firma digital
- `crear_notificacion()`: Crea notificaciones en el sistema para los admins
- `fn_obtener_precio_producto()`: Obtiene precio de producto desde lista específica (con margen o precio manual, fallback a precio_venta)
- `fn_asignar_lista_automatica_cliente()`: Asigna lista automáticamente según tipo_cliente del cliente
- `fn_validar_listas_cliente()`: Valida que un cliente no tenga más de 2 listas activas

## 🔐 Autenticación y Roles

Sistema de autenticación basado en Supabase Auth con 4 roles:

- **Admin**: Acceso completo
- **Vendedor**: Gestión de ventas y clientes
- **Repartidor**: Gestión de entregas
- **Almacenista**: Control de inventario

## 📱 Aplicaciones

### App Administrativa
- Dashboard con métricas en tiempo real
- Gestión completa de todos los módulos
- Reportes y estadísticas

### PWA Repartidor
- Hoja de ruta digital con orden optimizado
- **Tracking GPS en tiempo real** (envío cada 5 segundos)
- Firma digital y QR
- Modo offline básico
- **Visualización de ruta optimizada en mapa**

### Bot Vendedor ✅ (FUNCIONANDO)
- ✅ Toma de pedidos vía WhatsApp con validación de stock en tiempo real
- ✅ Descuento automático de stock por lotes (FIFO)
- ✅ Pedidos simples y múltiples
- ✅ Confirmación antes de crear pedido
- ✅ Consulta de estado de pedidos
- ✅ Menú interactivo numérico
- ✅ Verificación de horario de atención
- ✅ Integración directa con Twilio (Botpress opcional)
- 🚧 Notificaciones en dashboard (en desarrollo)
- 🚧 Registro de reclamos (en desarrollo)

## 🎨 Sistema de Diseño

### Identidad Visual

El sistema está diseñado con una identidad visual moderna y profesional basada en los colores del logo de Avícola del Sur, creando una experiencia cohesiva y distintiva.

### Paleta de Colores

**Colores Principales (del Logo):**
```css
--primary: #1a4d2e;           /* Verde oscuro del logo */
--secondary: #2d6a4f;         /* Verde medio */
--accent: #8b2635;            /* Rojo profundo del logo */
--neutral-warm: #f5e6d3;      /* Beige del logo */
--neutral-gold: #d4a574;      /* Dorado/beige oscuro */
```

**Colores de Estado:**
```css
--success: #2d6a4f;           /* Verde para éxito */
--warning: #d4a574;           /* Dorado para advertencias */
--info: #3b7c8f;              /* Azul verdoso para información */
--destructive: #8b2635;       /* Rojo para errores */
```

**Fondo del Sistema:**
```css
--background: #f0f8f4;        /* Verde menta muy claro */
--card: #ffffff;              /* Cards blancas con contraste */
```

### Componentes Visuales

**Logo:**
- Componente reutilizable: `<Logo />`
- Variantes: `sm`, `md`, `lg`, `xl`
- Modos: `full` (con texto) o `icon` (solo imagen)
- Ubicación: `public/images/logo-avicola.png`

**Cards:**
- Sombras sutiles con color verde
- Bordes verdes delicados (`border-primary/10`)
- Efecto hover: elevación y zoom suave
- Bordes superiores de colores para categorización

**Efectos Visuales:**
- Gradientes sutiles en headers y sidebar
- Transiciones suaves (200-300ms)
- Animaciones de hover con escala
- Iconos coloridos en círculos de fondo

### Convenciones de Diseño

1. **Headers de Página**: Gradiente verde sutil con efectos blur
2. **Cards de Métricas**: Bordes superiores de colores + iconos coloridos
3. **Formularios**: Bordes izquierdos de colores + títulos coloridos
4. **Navegación**: Indicadores verdes para items activos
5. **Botones**: Variantes de colores (primary, success, warning, info, accent)
6. **Badges**: Fondos sutiles con bordes del mismo color

## 📊 Métricas y KPIs

- **Almacén**: Rotación de stock, precisión de inventario
- **Ventas**: Conversión de pedidos, valor promedio
- **Reparto**: Tasa de entregas exitosas, tiempo de ruta
- **Cliente**: Satisfacción, tiempo de respuesta

## 🗺️ Selección de Ubicaciones con Google Maps

### Estado: ✅ IMPLEMENTADO

Sistema integrado de selección de ubicaciones para clientes usando Google Maps JavaScript API.

**Características principales:**
- 🗺️ **Selector Interactivo**: Mapa interactivo en formularios de creación/edición de clientes
- 📍 **Autocompletado**: Búsqueda inteligente de direcciones con Places API
- 📌 **Ubicación por Clic**: Selección directa en el mapa o arrastrando marcador
- 🔄 **Geocoding Inverso**: Conversión automática de coordenadas a dirección
- 📍 **Ubicación por Defecto**: Centrado en Monteros, Tucumán (región de operación)
- ⚡ **Fallback Inteligente**: Campo de texto manual si Google Maps no está disponible
- 🔧 **Diagnóstico Avanzado**: Páginas de debugging (`/diagnostico-google-maps`, `/prueba-mapa`)

### Configuración

**Variables de entorno requeridas:**
```env
# Google Maps API Key (requerida para selección de ubicaciones)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-api-key-aqui
```

**Cómo obtener la API Key:**
Ver la guía completa en [`docs/GOOGLE_MAPS_SETUP.md`](./docs/GOOGLE_MAPS_SETUP.md)

## 🗺️ Rutas Optimizadas y Tracking GPS

### Estado: ✅ IMPLEMENTADO

Sistema completo de optimización de rutas y tracking en tiempo real integrado al flujo de reparto.

**Características principales:**
- 🗺️ **Optimización de Rutas**: Google Directions API con fallback local (Nearest Neighbor + 2-opt)
- 🗂️ **Plan Semanal**: Las rutas (zona + día + turno + vehículo + repartidor) se cargan en `/reparto/planificacion`
- 📍 **Tracking GPS**: Envío automático de ubicaciones cada 5 segundos desde PWA del repartidor
- 🚨 **Alertas Automáticas**: Desvío de ruta (>200m) y cliente saltado (<100m sin entregar)
- 📊 **Monitor Admin**: Visualización en tiempo real de vehículos, rutas y alertas en mapa Google Maps
- 🔄 **Polling Inteligente Optimizado**: 
  - Polling adaptativo según cantidad de vehículos activos (10s con 3+ vehículos, 15s con 1-2, 60s sin vehículos)
  - Pausa automática cuando la pestaña del navegador no está visible (Page Visibility API)
  - Botón de actualización manual "Actualizar ahora"
  - Control de pausa/reanudación manual
  - Indicador visual del estado del polling y última actualización
- 🕕 **Turnos Automáticos**: Pedidos confirmados antes de las 05:00 → turno mañana del mismo día; entre 05:00-15:00 → turno tarde del mismo día; después de las 15:00 → turno mañana del día siguiente
- 🚚 **Asignación a Rutas Planificadas**: Cada pedido facturado se ubica en la ruta diaria definida (fecha + zona + turno). Si no hay plan para esa combinación se bloquea la conversión.

### Configuración

**Variables de entorno requeridas:**
```env
# OpenRouteService API Key (requerida para routing con datos OSM actualizados)
OPENROUTESERVICE_API_KEY=tu-api-key-aqui

# Google Maps API Key (opcional - fallback si ORS falla)
GOOGLE_MAPS_API_KEY=tu-api-key-aqui
```

**Cómo obtener la API Key:**

Ver la guía completa en [`docs/GOOGLE_MAPS_SETUP.md`](./docs/GOOGLE_MAPS_SETUP.md)

**Resumen rápido:**
1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear proyecto o seleccionar existente
3. Habilitar "Directions API"
4. Crear credenciales (API Key)
5. Agregar restricciones de dominio/IP para seguridad
6. Configurar en `.env.local`:
   ```env
   GOOGLE_MAPS_API_KEY=tu-api-key-aqui
   ```

**Costos estimados:**
- Google Directions API: ~$5 por 1000 requests
- Para 10 rutas/día con 20 paradas: ~$1.50/mes
- Fallback local: Gratis, adecuado para 5-50 paradas

### Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/reparto/ubicacion` | Registrar ubicación GPS (repartidor) |
| `GET` | `/api/reparto/ubicaciones` | Obtener últimas ubicaciones por vehículo |
| `POST` | `/api/rutas/generar` | Generar ruta optimizada (Google o local) |
| `GET` | `/api/rutas/:id/recorrido` | Obtener polyline e historial del día (enriquecido con productos y estado de pago) |
| `POST` | `/api/rutas/:id/alerta` | Crear alerta manual |
| `GET` | `/api/reparto/alertas` | Listar alertas (desvíos, cliente saltado) |
| `POST` | `/api/integrations/google/directions` | Endpoint interno para Google Directions |
| `GET` | `/api/reparto/rutas-planificadas` | Obtener rutas planificadas enriquecidas con productos y estado de pago |
| `POST` | `/api/reparto/rutas-mock` | Generar datos mock para monitor GPS (testing/demo) |
| `DELETE` | `/api/reparto/limpiar-mock` | Limpiar todos los datos mock del sistema |

### Páginas y Componentes

**Admin:**
- `/reparto/monitor` - Monitor en tiempo real con mapa Google Maps
  - Visualiza vehículos activos (marcadores verdes), rutas planificadas (polilíneas por color) y alertas (marcadores rojos)
  - Panel lateral con números clickeables de clientes para cada ruta seleccionada
  - Modal de vista previa con información completa del cliente y productos al hacer clic en un número
  - Números cambian a negro cuando el cliente está entregado y cobrado
  - Actualización automática optimizada (polling adaptativo: 10-60s según vehículos activos)
  - Pausa automática cuando la pestaña no está visible
  - Botón de actualización manual y control de pausa/reanudación
- `/reparto/planificacion` - Define el plan semanal (zona + día + turno + vehículo + repartidor)
- Controla qué rutas existen cada día y su capacidad disponible (vehículos base: Fiat Fiorino 600 kg, Toyota Hilux 1500 kg, Ford F-4000 4000 kg)

**Repartidor:**
- `/repartidor/ruta/[ruta_id]` - Hoja de ruta con GPS tracker integrado
- Componente `GpsTracker` envía ubicaciones automáticamente cuando la ruta está en curso

### Generación de Datos Mock para Monitor GPS

**Estado**: ✅ **IMPLEMENTADO Y OPTIMIZADO**

Sistema completo para generar datos de prueba (rutas, clientes, vehículos, ubicaciones GPS) para el monitor GPS, útil para testing y demos.

**Características principales:**
- 🎲 **Generación Automática**: Crea rutas completas con clientes, pedidos, vehículos y ubicaciones GPS simuladas
- 📍 **Ubicaciones GPS Realistas**: Genera hasta 20 ubicaciones GPS por ruta con puntos intermedios entre paradas
- 🗺️ **Optimización Incluida**: Aplica algoritmo de optimización local (Nearest Neighbor + 2-opt) a las rutas generadas
- ⚡ **Optimizado para Vercel Free**: Configurado con `maxDuration = 10` segundos y datos reducidos para evitar timeouts
- 📊 **Logs Detallados**: Sistema completo de logging con tiempos de ejecución por sección para diagnóstico
- 🧹 **Limpieza Automática**: Endpoint dedicado para eliminar todos los datos mock anteriores antes de generar nuevos

**Endpoints:**
- `POST /api/reparto/rutas-mock`: Genera rutas mock (parámetros: `cantidad_rutas`, `clientes_por_ruta`)
- `DELETE /api/reparto/limpiar-mock`: Elimina todos los datos mock del sistema

**Optimizaciones para Vercel Free (10s timeout):**
- Reducido a 20 ubicaciones GPS por ruta (antes 100)
- Densidad de puntos intermedios reducida (1 cada 500m en lugar de 100m)
- Logs detallados con tiempos de ejecución para identificar cuellos de botella
- `maxDuration = 10` configurado en ambos endpoints

**Uso:**
1. Desde el monitor GPS (`/reparto/monitor`), hacer clic en "Generar Rutas Mock"
2. El sistema limpia automáticamente datos mock anteriores
3. Genera nuevas rutas con datos de prueba
4. Las rutas aparecen inmediatamente en el monitor GPS

**Nota**: Si necesitas más datos o el proceso tarda más de 10s, considera actualizar a Vercel Pro (permite hasta 60s) o reducir los parámetros (`cantidad_rutas`, `clientes_por_ruta`).

### Cómo Probar

```bash
# 1. Ejecutar script de demo
./scripts/demo-rutas.sh

# 2. Abrir monitor admin
# Navegar a: http://localhost:3000/reparto/monitor

# 3. Abrir PWA repartidor
# Navegar a: http://localhost:3000/repartidor/ruta/[ruta_id]
# Iniciar tracking GPS desde el componente

# 4. Verificar alertas
curl http://localhost:3000/api/reparto/alertas

# 5. Turnos automáticos
#   - Confirmar presupuesto antes de las 05:00 -> pedido turno mañana del mismo día
#   - Confirmar presupuesto entre 05:00-15:00 -> pedido turno tarde del mismo día
#   - Confirmar presupuesto después de las 15:00 -> pedido turno mañana del día siguiente

# 6. Asignación automática de rutas
#   - Tras convertir un presupuesto, consultar la tabla rutas_reparto y detalles_ruta
#   - Cada pedido debe quedar asignado a la ruta del día por zona/turno
```

### Migraciones SQL

Aplicar migración:
```bash
psql -U postgres -d avicola_db -f supabase/migrations/20251124_rutas_tracking.sql
```

**Tablas nuevas:**
- `ubicaciones_repartidores` - Registro de ubicaciones GPS
- `rutas_planificadas` - Rutas optimizadas con orden de visita y polyline
- `alertas_reparto` - Alertas de desvío y cliente saltado
- `vehiculos_estado` - Cache de última ubicación por vehículo

**Funciones RPC:**
- `fn_obtener_ultima_ubicacion_por_vehiculo()` - Última ubicación por vehículo
- `fn_generar_ruta_local()` - Optimización local (fallback)
- `fn_marcar_alerta_desvio()` - Registrar alerta de desvío
- `fn_marcar_alerta_cliente_saltado()` - Registrar alerta de cliente saltado

---

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conectar repositorio a Vercel
2. Configurar variables de entorno
3. Configurar dominio personalizado
4. Desplegar

### Variables de Entorno en Producción
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key

# Twilio (Bot de WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_PROVIDER=twilio
BOTPRESS_WEBHOOK_TOKEN=your-random-secure-token

# Google Maps (Rutas Optimizadas - Opcional)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Botpress (Opcional - solo si usas NLU avanzado)
BOTPRESS_WEBHOOK_URL=https://your-botpress-webhook
```

## 🔧 **Actualizaciones Recientes**

### **Mejoras en Gestión de Rutas y Visualización (Diciembre 2025)**
- ✅ **Visualización mejorada de rutas**: RutasTable ahora muestra nombre y apellido del repartidor y patente/marca/modelo del vehículo en lugar de IDs
- ✅ **Cálculo automático de peso total**: Trigger SQL que recalcula automáticamente `peso_total_kg` de rutas cuando se agregan/modifican/eliminan pedidos
- ✅ **Sincronización de métricas**: Al optimizar una ruta, se actualizan automáticamente `distancia_estimada_km` y `tiempo_estimado_min` en `rutas_reparto`
- ✅ **Obtención mejorada de clientes**: Sistema actualizado para obtener clientes desde tabla `entregas` cuando el pedido no tiene `cliente_id` directamente (modelo de pedidos agrupados)
- ✅ **Conversión de coordenadas PostGIS**: Función `normalizeCoordinates()` mejorada para convertir correctamente coordenadas PostGIS (GeoJSON Point) a formato `{lat, lng}` para mapas
- ✅ **Flujo de iniciar ruta desde almacén**: Cuando un pedido pasa a estado "Enviado" desde almacén, la ruta se crea automáticamente con estado `'en_curso'` y es visible inmediatamente para el repartidor
- ✅ **Iniciar ruta inteligente**: Función `iniciarRuta()` ahora verifica el estado actual - si ya está en `'en_curso'`, solo actualiza `updated_at` sin cambiar el estado
- ✅ **Migración SQL**: `20251218_calcular_peso_total_rutas.sql` con función `fn_recalcular_peso_ruta()` y trigger automático
- ✅ **Archivos actualizados**: 
  - `src/components/tables/RutasTable.tsx` - Visualización mejorada
  - `src/lib/services/ruta-optimizer.ts` - Sincronización de métricas
  - `src/lib/utils/rutas.ts` - Conversión de coordenadas mejorada
  - `src/app/(admin)/(dominios)/reparto/rutas/[id]/page.tsx` - Obtención de clientes mejorada
  - `src/app/(repartidor)/entregas/page.tsx` - Obtención de clientes mejorada
  - `src/app/(repartidor)/ruta/[ruta_id]/page.tsx` - Obtención de clientes mejorada
  - `src/app/(repartidor)/ruta/[ruta_id]/mapa/page.tsx` - Obtención de clientes mejorada
  - `src/app/api/reparto/rutas-planificadas/route.ts` - Obtención de clientes mejorada
  - `src/actions/reparto.actions.ts` - Flujo de iniciar ruta mejorado

### **Vista Previa de Clientes en Monitor GPS (Diciembre 2025)**
- ✅ **Panel lateral de números**: Lista clickeable de clientes con números ordenados por ruta seleccionada
- ✅ **Modal de vista previa**: Al hacer clic en un número o marcador, se abre un modal con información completa
  - Datos básicos del cliente (nombre, dirección, teléfono)
  - Lista simple de productos con cantidades
  - Estado de entrega y pago
- ✅ **Colores dinámicos**: Los números cambian de color según estado
  - Negro: entregado y cobrado
  - Gris: solo entregado
  - Color de ruta: pendiente
- ✅ **Sincronización**: Panel lateral, mapa y modal sincronizados (al hacer clic en número, se centra el mapa)
- ✅ **Endpoints enriquecidos**: `/api/reparto/rutas-planificadas` y `/api/rutas/[id]/recorrido` ahora incluyen productos y estado de pago

### **Migración de Leaflet a Google Maps en Repartos (Diciembre 2025)**
- ✅ **MonitorMap.tsx migrado**: Reemplazado Leaflet por Google Maps JavaScript API
- ✅ **RutaMap.tsx migrado**: Visualización de rutas ahora usa Google Maps con mejor calidad
- ✅ **Funcionalidades mantenidas**: Marcadores personalizados, polilíneas, InfoWindows, polling optimizado (adaptativo 10-60s)
- ✅ **Iconos personalizados**: SVG inline para vehículos (verde), alertas (rojo), números de orden
- ✅ **Mejor calidad visual**: Mapas satelitales, Street View, mejor precisión de calles
- ✅ **Consistencia**: Mismo proveedor de mapas en toda la aplicación (Google Maps)
- ✅ **Corrección GpsTracker.tsx**: Bug corregido en envío de ubicaciones (uso de ref para posición actual)
- ✅ **Manejo de errores mejorado**: Verificaciones robustas de carga de Google Maps API

### **Configuración de Productos Mayoristas (Enero 2025)**
- ✅ **Unidad Mayor Personalizada**: Cada producto puede configurar su propia unidad mayor (`unidad_mayor_nombre`: "caja", "bolsa", "pallet", etc.) en lugar de usar valores hardcodeados
- ✅ **Peso por Unidad Mayor Configurable**: Cada producto define su propio `kg_por_unidad_mayor` (no todos son 20 kg por defecto)
- ✅ **Visualización Consistente**: El sistema muestra la unidad y peso configurados en cada producto en todos los lugares:
  - Presupuestos del Día (card "Ver productos")
  - Ver Detalles de Presupuesto
  - Formulario de Pesaje (`PesajeItemCard`)
  - Crear Presupuesto (formulario y preview)
  - Monitor GPS y rutas
- ✅ **Sin Fallbacks Incorrectos**: Eliminados todos los fallbacks hardcodeados (`|| 'caja'`, `|| 20`). El sistema usa solo los valores configurados en cada producto
- ✅ **Validación de Cálculos**: Los cálculos de `solicitadoKg` y `reservadoKg` solo se ejecutan cuando `kg_por_unidad_mayor` está configurado, evitando valores `NaN`
- ✅ **Pluralización Inteligente**: Muestra "1 caja" o "2 caja(s)" según corresponda
- ✅ **Archivos actualizados**:
  - `src/app/(admin)/(dominios)/almacen/presupuestos-dia/page.tsx`
  - `src/app/(admin)/(dominios)/ventas/presupuestos/[id]/page.tsx`
  - `src/components/almacen/PesajeItemCard.tsx`
  - `src/components/almacen/PesajeForm.tsx`
  - `src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/presupuesto-form.tsx`
  - `src/app/(admin)/(dominios)/ventas/presupuestos/nuevo/producto-item-row.tsx`
  - `src/app/sucursal/ventas/page.tsx`
  - `src/actions/presupuestos-dia.actions.ts` (función `calcularKgItem`)

### **Vigencia Opcional en Listas de Precios (07/12/2025)**
- ✅ **Nuevo campo `vigencia_activa`**: Las listas pueden tener validación de vigencia opcional
- ✅ **Comportamiento por defecto**: Listas están siempre vigentes (sin validar fechas)
- ✅ **Validación condicional**: Si `vigencia_activa = true`, valida fechas `fecha_vigencia_desde` y `fecha_vigencia_hasta`
- ✅ **UI actualizada**: Checkbox en formularios para activar/desactivar validación de vigencia
- ✅ **Funciones SQL actualizadas**: `fn_asignar_lista_automatica_cliente()` ahora valida vigencia solo si está activada
- ✅ **Migraciones**: `20251207_agregar_vigencia_activa_listas_precios.sql` y `20251207_actualizar_fn_asignar_lista_automatica_vigencia.sql`

### **Navegación del Sidebar Completada (03/12/2025)**
- ✅ **Agregado**: "Listas de Precios" al menú Ventas con ícono 🏷️
- ✅ **Agregado**: "Facturas" al menú Ventas con ícono 📄
- ✅ **Navegación completa**: Todos los módulos principales ahora accesibles desde el sidebar

### **Correcciones Técnicas Implementadas (03/12/2025)**
- ✅ **Políticas RLS Simplificadas**: Resueltos errores de permisos en consultas de listas de precios
- ✅ **Compatibilidad Next.js**: Actualizadas páginas dinámicas para usar `await params`
- ✅ **Validación de UUID**: Agregada validación robusta de IDs antes de consultas
- ✅ **Manejo de Errores Mejorado**: Logging detallado para diagnóstico de problemas

### **Estructura de Navegación por Dominios Funcionales**
```
🏠 Dashboard

📦 Almacén (WMS)
  ├── Productos, Lotes, Presupuestos del Día, Pedidos
  ├── Transferencias entre Sucursales
  └── Recepción

🛒 Ventas (CRM)
  ├── Presupuestos, Clientes, Listas de Precios, Facturas

🚚 Reparto (TMS)
  ├── Planificación semanal, Rutas, Monitor GPS, Vehículos

💰 Tesorería
  ├── Cajas, Movimientos, Validar rutas, Cierres
  ├── Tesoro, Gastos, Cuentas Corrientes
  └── Reportes Financieros

🏢 Sucursales (Multi-sucursal)
  ├── Gestión de Sucursales, Dashboard Sucursal
  ├── Alertas de Stock (Monitoreo Central)
  └── Reportes Consolidados

👥 RRHH
  ├── Empleados, Asistencia, Liquidaciones, Adelantos
  ├── Licencias, Evaluaciones, Novedades
  └── Reportes de Personal

📊 Reportes Globales
```

### **Navegación Sucursal (Jerárquica)**
```
🏠 Dashboard

📦 Gestión Local
  ├── Inventario
  ├── Ventas
  └── Alertas de Stock

🚚 Operaciones
  ├── Transferencias
  └── Tesorería

📢 Comunicación
  └── Novedades

📊 Reportes
```

### **Problemas Resueltos**
1. **Búsqueda de clientes por código**: Campo faltante agregado a consultas
2. **Errores en Listas de Precios**: Políticas RLS y compatibilidad Next.js corregidas
3. **Navegación incompleta**: Módulos faltantes agregados al sidebar
4. **Reorganización del Sidebar**: Navegación funcional por dominios de negocio con submenús jerárquicos

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [📋 PRD.md](./PRD.md) | **Product Requirements Document** - Requisitos, especificaciones y criterios de validación del producto |
| [🏗️ ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) | Resumen ejecutivo de la arquitectura del sistema |
| [📐 ARCHITECTURE.MD](./ARCHITECTURE.MD) | Arquitectura técnica detallada con diagramas |
| [🧪 TESTING.md](./TESTING.md) | Guía completa de pruebas del sistema |
| [🤖 docs/IA_CAPABILITIES.md](./docs/IA_CAPABILITIES.md) | Inventario operativo de capacidades IA, estrategias y rutas canónicas |
| [🗃️ SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Configuración de la base de datos Supabase |
| [👔 RRHH_README.md](./RRHH_README.md) | Documentación del módulo de Recursos Humanos |
| [🆕 docs/RRHH_ACTUALIZACIONES_2026-02.md](./docs/RRHH_ACTUALIZACIONES_2026-02.md) | Registro de cambios operativos recientes del módulo RRHH |
| [🔑 credenciales.md](./credenciales.md) | Credenciales de acceso para testing |

---

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 📞 Soporte

Para soporte técnico contactar al equipo de desarrollo.

---

**Avícola del Sur ERP** - Transformando la gestión avícola con tecnología moderna.

