# 🏗️ Arquitectura del Sistema - Avícola del Sur ERP

**Última Actualización:** 6 de Febrero 2026 (09:30)  
**Estado:** ✅ PRODUCCIÓN  
**Versión:** v2.3  
**Docs relacionadas:** [README](./README.md) · [Architecture Deep-Dive](./ARCHITECTURE.MD) · [Supabase Setup](./SUPABASE_SETUP.md)

---

## 📚 Índice Rápido

| Sección | Descripción |
|---------|-------------|
| [TL;DR](#-tldr-resumen-ejecutivo) | Resumen ejecutivo del sistema |
| [Stack](#-stack-tecnológico) | Tecnologías utilizadas |
| [Módulos](#-módulos-principales-mapa-técnico) | §1-§6 Reparto, Tesorería, Almacén, Ventas, RRHH, Sucursales |
| [Servicios IA](#-servicios-de-ia--google-cloud) | Gemini, Maps, Routing |
| [Patrones](#️-patrones-de-arquitectura-de-software) | Arquitectura Server-Authoritative |
| [Server Actions](#-server-actions-referencia-completa) | 39 actions organizados por módulo |
| [Estructura](#-estructura-de-directorios-auditada) | Organización de carpetas |
| [Navegación](#-mapa-de-navegación-del-sistema-menú-oficial) | Menú del sidebar |
| [Flujos](#-flujos-críticos) | Happy paths principales |
| [Seguridad](#-seguridad-y-infraestructura-invisible-middleware) | RBAC y middleware |
| [API](#-api--webhooks-headless) | Endpoints públicos |
| [Esquema DB](#-esquema-de-datos-crítico-entidades-core) | Tablas y enums |
| [Componentes UI](#-catálogo-de-componentes-ui-building-blocks) | Building blocks reutilizables |
| [Cambios Recientes](#-cambios-recientes) | Historial de actualizaciones |

---

## 📋 TL;DR (Resumen Ejecutivo)

Sistema ERP modular completo para Avícola del Sur que unifica **Almacén (WMS)**, **Ventas (CRM)**, **Reparto (TMS)**, **Tesorería** y **RRHH** en una única fuente de verdad sobre **Supabase**.

### Diferenciales Clave (Febrero 2026)

1. **IA Omnipresente**: Google Gemini integrado en validación de stock (pesaje), conciliación bancaria inteligente, chatbot de ventas y optimización de rutas.
2. **Reparto Autónomo**: Navegación interactiva con selección de rutas alternativas (OpenRouteService + Google), decisión inteligente del próximo cliente y GPS tracking en tiempo real.
3. **Conciliación Bancaria AI**: Motor que ingesta extractos PDF/Excel y matchea transacciones automáticamente con movimientos de caja usando Gemini 3.0 Pro.
4. **Producción Científica**: Módulo de desposte con análisis de rendimientos esperados vs reales, control estricto de mermas y **Producción Incremental** con impresión de resúmenes.
5. **Memory Bank Inteligente**: El bot de WhatsApp aprende de cada conversación, extrayendo hechos y preferencias automáticamente para personalizar la atención.
6. **Sistema de Remitos**: Generación automática de documentos PDF para entregas, traslados y producción con numeración secuencial.
7. **Pesaje Acumulativo**: Escaner de balanza con soporte para múltiples bolsas, acumulación de pesos y barra de progreso visual.

---

## 🛠️ Stack Tecnológico *(resumen – detalles en README#arquitectura-del-sistema)*

- **Framework**: Next.js 16 (App Router, Server Actions, React 19)
- **Frontend**: React 19 + TypeScript 5.9 + Tailwind CSS v4 + shadcn/ui
- **Base de Datos**: Supabase (Postgres 15+) + RLS + Realtime (184+ migraciones)
- **IA Core**: Google Vertex AI (Gemini 2.5 Flash / 3.0 Pro)
- **Mapas**: Google Maps JS API (visualización) + OpenRouteService (routing OSM)
- **Infraestructura**: Vercel (Frontend/Edge) + Supabase (Backend/Storage)
- **Barcode**: @zxing/library para escaneo de códigos EAN-13

---

## 📦 Módulos Principales (Mapa Técnico)

> Para un desglose extendido de cada dominio revisa [ARCHITECTURE.MD#🏢-dominios-de-negocio](./ARCHITECTURE.MD).

### 1. 🚛 Reparto (TMS) & Navegación
*Scope: Logística last-mile, app de conductor y monitoreo.*

- **Backend Logic**: `reparto.actions.ts`, `plan-rutas.actions.ts`, `ruta-optimizer.ts`, `ors-directions.ts`
- **Data Models**: `rutas_reparto`, `detalles_ruta`, `ubicaciones_repartidores`, `preferencias_rutas_repartidor`
- **UI Key Components**: 
  - `NavigationInteractivo.tsx` - App Conductor con voz
  - `MonitorMap.tsx` - Admin Dashboard tiempo real
  - `RutaAlternativasSelector.tsx` - Selección de rutas
  - `GpsTracker.tsx` - Tracking background
- **Features**:
  - Optimización TSP con ORS VROOM
  - Fallback híbrido: ORS → Google → Local (NN + 2-opt)
  - PWA offline-first
  - Alertas automáticas de desvío

### 2. 💰 Tesorería & Conciliación IA
*Scope: Flujo de dinero, cajas, bancos, proveedores y cuentas corrientes.*

- **Backend Logic**: `tesoreria.actions.ts`, `conciliacion*.actions.ts`, `proveedores.actions.ts`
- **AI Core**: `gemini-matcher.ts` (Gemini 3.0 Pro para matching difuso)
- **Data Models**: `tesoreria_cajas`, `movimientos_caja`, `conciliacion_bancaria_items`, `cuentas_corrientes`, `proveedores`
- **Features**:
  - Parser robusto multiformato (PDF/Excel)
  - Matching inteligente con IA
  - Acreditación atómica vía RPC
  - Gestión de proveedores completa

### 3. 🏭 Almacén & Producción
*Scope: Inventario, manufactura (desposte) y recepción.*

- **Backend Logic**: `produccion.actions.ts`, `almacen.actions.ts`, `rendimientos.actions.ts`, `pesajes.actions.ts`
- **Data Models**: `lotes`, `movimientos_stock`, `produccion_ordenes`, `produccion_config`
- **Features**:
  - Control de Merma Líquida vs Sólida
  - Validación de Peso con IA (detección de outliers)
  - Pesaje acumulativo de múltiples bolsas
  - Producción Incremental con Memory Bank
  - Control de Stock por Turnos (auditoría física)
  - Sistema de Remitos de producción

### 4. 🛒 Ventas & Clientes
*Scope: CRM, facturación y toma de pedidos.*

- **Backend Logic**: `ventas.actions.ts`, `presupuestos*.actions.ts`, `listas-precios.actions.ts`
- **AI Core**: `agent.ts` (Orquestador), `memory-extractor.ts`
- **Data Models**: `pedidos`, `presupuestos`, `clientes`, `listas_precios`, `bot_sessions`
- **Features**:
  - Chatbot NLU para toma de pedidos natural
  - Listas de precios dinámicas con vigencia
  - Memory Bank Inteligente
  - Catálogo Web Público con carrito persistente
  - Remitos de entrega con firma digital

### 5. 👥 RRHH (Human Resources)
*Scope: Gestión de personal, asistencia, pagos y comunicación interna.*

- **Backend Logic**: `rrhh.actions.ts`, `reportes-empleados.actions.ts`, `mensajes.actions.ts`
- **Data Models**: `rrhh_empleados`, `rrhh_asistencias`, `rrhh_liquidaciones`, `rrhh_adelantos`, `mensajes_internos`
- **Features**:
  - Cálculo de nómina automático
  - Adelantos con límite del 30% del sueldo básico
  - Mensajería interna entre empleados
  - Objetivación de evaluaciones vía Huella Digital Operativa

### 6. 🏪 Sucursales & POS
*Scope: Gestión de puntos de venta distribuidos.*

- **Backend Logic**: `sucursales.actions.ts`, `pos-sucursal.actions.ts`, `sucursales-transferencias.actions.ts`
- **Data Models**: `sucursales`, `sucursales_stock`, `transferencias_sucursales`
- **Features**:
  - POS táctil para venta directa
  - Transferencias de stock inter-sucursales con remitos
  - Auditoría de precios mayorista/minorista
  - Conteos de inventario con validación

---

## 🤖 Servicios de IA & Google Cloud

| Servicio | Implementación | Propósito |
|----------|----------------|-----------|
| **Gemini 2.5 Flash** | `src/lib/services/gemini.ts` | Validaciones rápidas, chatbot ventas |
| **Gemini 2.5 Flash** | `vertex/memory-extractor.ts` | Extracción automática de hechos y preferencias |
| **Gemini 3.0 Pro** | `conciliacion/gemini-matcher.ts` | Razonamiento complejo: Conciliación bancaria |
| **Maps JS API** | `components/reparto/MonitorMap.tsx` | Visualización GPS y rutas |
| **Directions API** | `lib/services/google-directions.ts` | Rutas alternativas (fallback) |
| **Places API** | `lib/services/places.ts` | Autocompletado de direcciones |
| **OpenRouteService** | `lib/services/ors-directions.ts` | Optimización TSP, routing OSM |

---

## 🏗️ Patrones de Arquitectura de Software

El sistema sigue una arquitectura **Server-Authoritative** estricta:

| Capa | Ubicación | Responsabilidad | Ejemplo |
|------|-----------|-----------------|---------|
| **1. Presentación** | `src/app` & `components` | Rendering UI, estado efímero. No contiene reglas de negocio. | `PesajeItemCard.tsx` |
| **2. Orquestación** | `src/actions` | **Backend-for-Frontend**. Valida inputs (Zod), verifica permisos, llama a servicios. | `reparto.actions.ts` |
| **3. Dominio/Servicios** | `src/lib/services` | Lógica pura de negocio, algoritmos complejos e integraciones. | `ruta-optimizer.ts`, `gemini.ts` |
| **4. Datos Atómicos** | `supabase/migrations` | **RPCs de Postgres**. Garantizan atomicidad transaccional. | `fn_acreditar_saldo_cliente_v2` |

---

## 🔧 Server Actions (Referencia Completa)

*39 actions en `src/actions/`. Usar como backend-for-frontend.*

### Por Módulo

| Módulo | Actions | Propósito |
|--------|---------|-----------|
| **Auth** | `auth.actions.ts` | Login, logout, gestión de sesión |
| **Dashboard** | `dashboard.actions.ts` | KPIs, métricas, alertas |
| **Almacén** | `almacen.actions.ts`, `produccion.actions.ts`, `pesajes.actions.ts`, `presupuestos-dia.actions.ts` | Stock, lotes, desposte, pesaje, preparación diaria |
| **Ventas** | `ventas.actions.ts`, `presupuestos.actions.ts`, `listas-precios.actions.ts` | Clientes, facturas, presupuestos, listas de precios |
| **Reparto** | `reparto.actions.ts`, `plan-rutas.actions.ts` | Rutas, asignaciones, tracking, planificación semanal |
| **Tesorería** | `tesoreria.actions.ts`, `conciliacion*.actions.ts`, `gastos.actions.ts`, `proveedores.actions.ts` | Cajas, conciliación IA, gastos, proveedores |
| **RRHH** | `rrhh.actions.ts`, `mensajes.actions.ts` | Empleados, asistencia, liquidaciones, mensajería |
| **Sucursales** | `sucursales*.actions.ts`, `pos-sucursal.actions.ts` | CRUD sucursales, POS, transferencias |
| **Remitos** | `remitos.actions.ts` | Generación de PDFs para entregas, traslados y producción |
| **Reportes** | `reportes*.actions.ts` (8 archivos) | Reportes especializados por módulo |

---

## 📂 Estructura de Directorios Auditada

```
src/
├── actions/                  # 39 Server Actions (lógica de negocio)
├── app/
│   ├── (admin)/              # Backoffice (Layout principal + sidebar)
│   │   ├── (dominios)/       # Módulos de negocio
│   │   │   ├── almacen/      # WMS - Stock, lotes, producción, pesaje
│   │   │   ├── ventas/       # CRM - Presupuestos, clientes, listas de precios
│   │   │   ├── reparto/      # TMS - Rutas, planificación, monitor GPS
│   │   │   ├── tesoreria/    # Finanzas - Cajas, conciliación, proveedores
│   │   │   ├── rrhh/         # RRHH - Empleados, asistencia, liquidaciones
│   │   │   ├── sucursales/   # Multi-sucursal, transferencias
│   │   │   └── reportes/     # 9 tipos de reportes
│   │   └── dashboard/        # Dashboard principal
│   │
│   ├── (repartidor)/         # PWA para repartidores (mobile-first)
│   │   ├── entregas/
│   │   ├── ruta/[ruta_id]/
│   │   └── home/
│   │
│   ├── sucursal/             # POS de sucursales
│   ├── api/                  # Route handlers (webhooks, APIs)
│   ├── catalogo/             # Catálogo público web
│   └── login/                # Autenticación
│
├── components/               # 166+ componentes React
│   ├── ui/                   # 50+ componentes shadcn/ui
│   ├── almacen/              # 13 componentes (PesajeForm, PesajeItemCard)
│   ├── reparto/              # 12 componentes (MonitorMap, NavigationInteractivo)
│   ├── rrhh/                 # Componentes de RRHH
│   ├── sucursales/           # Componentes de sucursales
│   ├── tables/               # Tablas con TanStack
│   ├── forms/                # Formularios reutilizables
│   └── layout/               # Layouts (sidebar, headers)
│
├── lib/
│   ├── services/             # Integraciones externas (Google, WhatsApp, ORS)
│   ├── rutas/                # Algoritmos de optimización de rutas
│   ├── conciliacion/         # Motor de conciliación bancaria
│   ├── vertex/               # Agente de IA (Gemini)
│   ├── schemas/              # Esquemas Zod para validación
│   ├── supabase/             # Clientes Supabase (server/browser)
│   └── utils/                # Utilidades generales
│
├── hooks/                    # Custom React hooks
├── store/                    # Estado global Zustand
└── types/                    # Tipos TypeScript

supabase/
├── migrations/               # 184+ migraciones SQL
└── seed.sql                  # Datos iniciales
```

---

## 🧭 Mapa de Navegación del Sistema (Menú Oficial)

Jerarquía completa de opciones disponibles en el Sidebar Administrativo:

*   **📊 Dashboard**: Vista general de KPIs (`/dashboard`)
*   **📦 Almacén**:
    *   `Productos`, `Lotes` (Stock), `Producción` (Desposte)
    *   `Presupuestos del Día` (Cola de preparación), `En Preparación` (Pedidos activos)
    *   `Pedidos` (Histórico), `Control de Stock` (Auditoría)
    *   `Transferencias`, `Recepción`
*   **🛒 Ventas**:
    *   `Presupuestos` (Cotizaciones), `Clientes`, `Listas de Precios`
    *   `Facturas` (Comprobantes), `Reclamos`
*   **🚛 Reparto**:
    *   `Rutas` (Planificación diaria), `Monitor GPS` (Tiempo real)
    *   `Planificación Semanal` (Calendario), `Vehiculos`
*   **💰 Tesorería**:
    *   `Cajas`, `Movimientos`, `Cierres de Caja`
    *   `Validar rutas` (Rendición choferes), `Conciliación` (Bancaria)
    *   `Cuentas Corrientes`, `Tesoro`, `Gastos`, `Proveedores`
*   **🤖 Inteligencia Artificial**:
    *   `Predicciones`, `Reportes IA`
*   **🏢 Sucursales**:
    *   `Gestión`, `Dashboard`, `Ventas (POS)`, `Inventario`
    *   `Transferencias`, `Alertas de Stock`
*   **👥 RRHH**:
    *   `Empleados`, `Mensajes`, `Asistencia`, `Liquidaciones`
    *   `Adelantos`, `Licencias`, `Evaluaciones`, `Reportes`
*   **📈 Reportes**:
    *   Ventas, Pedidos, Stock, Almacén, Reparto, Tesorería, Clientes, Empleados, Sucursales

---

## 🔄 Flujos Críticos

### 1. Venta a Entrega (The Happy Path)

```
Bot/Vendedor → Presupuesto → Almacén (Pesaje) → Conversión a Pedido
    ↓
Asignación Automática a Ruta → PWA Repartidor → Entrega + Cobro
    ↓
Tesorería (Validación) → Acreditación en Caja/CC
```

### 2. Conciliación Bancaria con IA

```
PDF Bancario → Parser → Gemini Matching → Sugerencias → Confirmación
    ↓
RPC Acreditación Atómica → Actualización Caja + CC
```

### 3. Pesaje con Escaner de Balanza

```
Presupuesto del Día → Pesaje → Escanear Etiqueta EAN-13
    ↓
Parsear Peso → Acumular Múltiples Bolsas → Validación IA → Guardar
```

---

## 🔐 Seguridad y Infraestructura Invisible (Middleware)

El archivo `middleware.ts` actúa como firewall de aplicación:

1.  **RBAC Estricto**:
    *   `/admin/*`: Solo `admin`.
    *   `/tesoreria/*`: `admin`, `tesorero`, `encargado_sucursal`.
    *   `/rrhh/*`: Solo `admin`.
2.  **Redirección Forzada**: Los usuarios `encargado_sucursal` son redirigidos automáticamente a `/sucursal/dashboard`.
3.  **Sesión**: Verificación de token Supabase y refresh automático antes de expiración (<10 min).

---

## ⚡ API & Webhooks (Headless)

| Endpoint | Método | Función | Seguridad |
|----------|--------|---------|-----------|
| `/api/webhooks/whatsapp-meta` | GET/POST | Webhook WhatsApp Business (Meta) | **Pública** (verificación + recepción) |
| `/api/bot` | POST | Bot principal (procesa comandos + IA) | **Pública** |
| `/api/reparto/ubicacion` | POST | Tracking GPS | Autenticado |
| `/api/rutas/generar` | POST | Optimización de rutas | Admin |
| `/api/almacen/analizar-peso` | POST | Validación de peso con IA | Autenticado |
| `/api/tesoreria/procesar-extracto` | POST | Parser bancario | Admin/Tesorero |
| `/api/almacen/simular-peso` | POST | Simulación de peso para testing | Admin |

---

## 💾 Esquema de Datos Crítico (Entidades Core)

### Tablas Principales (Postgres)

- **Ventas**: `presupuestos`, `pedidos`, `entregas`, `clientes`, `listas_precios`
- **Reparto**: `rutas_reparto`, `detalles_ruta`, `vehiculos`, `ubicaciones_repartidores`
- **Almacén**: `productos`, `lotes`, `movimientos_stock`, `produccion_ordenes`
- **Tesorería**: `tesoreria_cajas`, `tesoreria_movimientos`, `cuentas_corrientes`, `proveedores`
- **RRHH**: `rrhh_empleados`, `rrhh_asistencias`, `rrhh_liquidaciones`, `mensajes_internos`
- **Documentos**: `remitos`, `remitos_items`, `remitos_firmas`

### Enums y Estados (Valores Exactos)

- **Roles**: `'admin'`, `'vendedor'`, `'repartidor'`, `'almacenista'`, `'tesorero'`, `'encargado_sucursal'`
- **Estado Presupuesto**: `'pendiente'`, `'en_almacen'`, `'preparado'`, `'en_reparto'`, `'entregado'`, `'cancelado'`
- **Estado Pedido**: `'abierto'`, `'cerrado'`
- **Estado Entrega**: `'pendiente'`, `'en_camino'`, `'entregado'`, `'fallido'`
- **Estado Pago**: `'pendiente'`, `'parcial'`, `'pagado'`, `'fiado'`

---

## 🧩 Catálogo de Componentes UI (Building Blocks)

| Componente | Path | Descripción |
|------------|------|-------------|
| **`<DataTable />`** | `components/ui/data-table.tsx` | Tabla server-side/client-side con filtros, ordenamiento y paginación. Wrappea TanStack Table. |
| **`<MonitorMap />`** | `components/reparto/MonitorMap.tsx` | Mapa en vivo de flotas. Muestra múltiples rutas coloreadas y ubicación real. |
| **`<NavigationInteractivo />`** | `components/reparto/NavigationInteractivo.tsx` | Modo navegación turn-by-turn con voz y detección de llegada. |
| **`<PesajeItemCard />`** | `components/almacen/PesajeItemCard.tsx` | Card de pesaje con escaneo acumulativo de múltiples bolsas y validación IA. |
| **`<GpsTracker />`** | `components/reparto/GpsTracker.tsx` | Componente invisible que reporta geo-posición cada 5s. |
| **`<SignaturePad />`** | `components/shared/SignaturePad` | Captura de firma digital para entregas y remitos. |

---

## 📝 Cambios Recientes

### 2026-02-06 · Fix BarcodeScanner TDZ
- **Fix**: Error "Cannot access before initialization" al escanear en pesaje
- **Cambio**: Reordenar declaración de funciones para evitar TDZ

### 2026-02-02 · Pesaje Acumulativo de Múltiples Bolsas
- Sistema de escaneo acumulativo con lista de bolsas individuales
- Barra de progreso visual hacia el objetivo
- Gestión flexible (eliminar individual/reiniciar todo)

### 2026-01-23 · Selección Elite de Skills
- Curación de 36 skills de alta prioridad
- Migración a estructura `.claude/skills/`

### 2026-01-22 · Sistema Integral de Remitos
- Tabla `remitos` con numeración secuencial
- Motor de PDFs con pdfkit
- Cobertura: entregas, traslados, producción

### 2026-01-17 · Sistema de Mensajería Interna
- Tabla `mensajes_internos` con RLS
- Bandeja de entrada, enviados, marcado de leídos

---

## 📊 Métricas del Sistema

| Métrica | Valor |
|---------|-------|
| Componentes React | 166+ |
| Server Actions | 39 |
| Migraciones SQL | 184+ |
| Tablas BD | 80+ |
| Skills de IA | 36 |
| Tests E2E | 15+ suites |
| Cobertura de módulos | 100% (6/6) |

---

*Documento mantenido por el equipo de desarrollo.*  
*Última actualización: 6 de Febrero de 2026*
