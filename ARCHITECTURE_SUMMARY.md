# 🏗️ Arquitectura del Sistema - Avícola del Sur ERP

**Última Actualización:** Enero 2026
**Estado:** ✅ PRODUCCIÓN

## 📋 TL;DR (Resumen Ejecutivo)

Sistema ERP modular completo para Avícola del Sur que unifica **Almacén (WMS)**, **Ventas (CRM)**, **Reparto (TMS)**, **Tesorería** y **RRHH** en una única fuente de verdad sobre **Supabase**.

### Diferenciales Clave (Enero 2026)
1.  **IA Omnipresente**: Google Gemini integrado en validación de stock (pesaje), conciliación bancaria inteligente, chatbot de ventas y optimización de rutas.
2.  **Reparto Autónomo**: Navegación interactiva con selección de rutas (Google Directions), decisión inteligente del próximo cliente y GPS tracking en tiempo real.
3.  **Conciliación Bancaria AI**: Motor que ingesta extractos PDF/Excel y matchea transacciones automáticamente con movimientos de caja.
4.  **Producción Científica**: Módulo de desposte con análisis de rendimientos esperados vs reales y control estricto de mermas.

---

## 🛠️ Stack Tecnológico

- **Framework**: Next.js 15 (App Router, Server Actions)
- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Base de Datos**: Supabase (Postgres 15+) + RLS + Realtime
- **IA Core**: Google Gemini 2.5 Flash (alta velocidad) y 3.0 Pro (razonamiento complejo)
- **Mapas**: Google Maps JS API + Directions API + Places API
- **Infraestructura**: Vercel (Frontend/Edge) + Supabase (Backend/Storage)
- **Protocolo IA**: Model Context Protocol (MCP) para integración de herramientas externas

---

## 📦 Módulos Principales (Mapa Técnico)

### 1. 🚛 Reparto (TMS) & Navegación
*Scope: Logística last-mile, app de conductor y monitoreo.*
- **Backend Logic**: `reparto.actions.ts` (CRUD), `ruta-optimizer.ts` (Algoritmo TSP híbrido), `google-directions.ts`.
- **Data Models**: `rutas_reparto` (Cabecera), `detalles_ruta` (Entregas), `ubicaciones_repartidores` (Tracking), `preferencias_rutas_repartidor`.
- **UI Key Components**: `NavigationInteractivo.tsx` (App Conductor), `MonitorMap.tsx` (Admin Dashboard), `RutaAlternativasSelector.tsx`.
- **Features 2.0**:
  - Selección de rutas alternativas (Google Alternatives).
  - Priorización inteligente de clientes (`next-client-selector.ts`).

### 2. 💰 Tesorería & Conciliación IA
*Scope: Flujo de dinero, cajas, bancos y cuentas corrientes.*
- **Backend Logic**: `conciliacion.actions.ts` (Ingesta), `tesoreria.actions.ts` (Movimientos).
- **AI Core**: `gemini-matcher.ts` (Gemini 3.0 Pro para matching difuso de transacciones).
- **Data Models**: `tesoreria_cajas`, `movimientos_caja`, `conciliacion_bancaria_items`, `cuentas_corrientes`.
- **Features 2.0**:
  - Conciliación PDF->BD automática.
  - Validación de rendiciones de ruta (Cruce Cobros vs Remesa).

### 3. 🏭 Almacén & Producción
*Scope: Inventario, manufactura (desposte) y recepción.*
- **Backend Logic**: `produccion.actions.ts` (Desposte), `almacen.actions.ts` (Stock), `rendimientos.actions.ts`.
- **Data Models**: `lotes` (FIFO Kernel), `movimientos_stock`, `produccion_ordenes`, `produccion_config` (Rendimientos teóricos).
- **Features 2.0**:
  - Control de Merma Líquida vs Sólida.
  - Validación de Peso IA (Detección de outliers en balanza).

### 4. 🛒 Ventas & Clientes
*Scope: CRM, facturación y toma de pedidos.*
- **Backend Logic**: `ventas.actions.ts`, `bot/route.ts` (Webhook WhatsApp), `listas-precios.actions.ts`.
- **Data Models**: `pedidos` (Agregador de entregas), `presupuestos`, `clientes`, `listas_precios`.
- **Features 2.0**:
  - Chatbot NLU para toma de pedidos natural.
  - Listas de precios dinámicas con vigencia y auditoría de cambios.

### 5. 👥 RRHH (Human Resources)
*Scope: Gestión de personal, asistencia y pagos.*
- **Backend Logic**: `rrhh.actions.ts`, `reportes-empleados.actions.ts`.
- **Data Models**: `rrhh_empleados`, `rrhh_asistencias` (Geo-fenced), `rrhh_liquidaciones`, `rrhh_adelantos`.
- **Features 2.0**:
  - Cálculo de nómina automático basado en presentismo.
  - Adelantos con límite automático según sueldo básico.

---

## 🤖 Servicios de IA & Google Cloud

| Servicio | Implementación | Propósito |
|----------|----------------|-----------|
| **Gemini 2.5 Flash** | `src/lib/gemini.ts` | Validaciones rápidas (balanza), Chatbot ventas, Clasificación de Gastos. |
| **Gemini 3.0 Pro** | `conciliacion/gemini-matcher.ts` | Razonamiento complejo: Conciliación bancaria y Auditoría de Cobros. |
| **Maps JS API** | `components/shared/LocationPicker` | Selector de ubicaciones y visualización de rutas |
| **Directions API** | `lib/rutas/google-directions.ts` | Cálculo de rutas óptimas y alternativas |
| **Places API** | `lib/google-cloud/places.ts` | Autocompletado de direcciones |
| **Predictions API** | `api/ia/prediccion-stock` | Endpoint cron para predecir quiebres de stock. |
| **Risk API** | `api/ia/clientes-riesgo` | Análisis de historial de pagos para scoring de crédito. |


---

---

## 🏗️ Patrones de Arquitectura de Software

El sistema sigue una arquitectura **Server-Authoritative** estricta para garantizar consistencia y seguridad:

| Capa | Ubicación | Responsabilidad | Ejemplo |
|------|-----------|-----------------|---------|
| **1. Presentación** | `src/app` & `components` | Rendering UI, estado efímero. No contiene reglas de negocio. | `RutaAlternativasSelector.tsx` |
| **2. Orquestación** | `src/actions` | **Backend-for-Frontend**. Valida inputs (Zod), verifica permisos, llama a servicios y formatea respuestas para la UI. | `reparto.actions.ts` |
| **3. Dominio/Servicios** | `src/lib/services` | Lógica pura de negocio, algoritmos complejos e integraciones (Google/Twilio). Desacoplado de la UI. | `ruta-optimizer.ts`, `gemini.ts` |
| **4. Datos Atómicos** | `supabase/functions` | **RPCs de Postgres**. Garantizan atomicidad transaccional y consistencia de datos a nivel BD. | `fn_asignar_pedido_a_ruta` |

---

## 📁 Estructura de Directorios Auditada

```
src/
├── actions/                  # Server Actions (Mutaciones seguraas)
├── app/
│   ├── (admin)/              # Dashboard Backoffice (Layout principal)
│   │   ├── (dominios)/       # Módulos de negocio (almacen, ventas, etc)
│   ├── (repartidor)/         # App Móvil (Layout simplificado)
│   ├── api/                  # Endpoints (Webhooks, Cron jobs, Proxy)
├── components/
│   ├── ui/                   # Design System (shadcn)
│   ├── [modulo]/             # Componentes específicos de dominio
├── lib/
│   ├── conciliacion/         # Motor de conciliación bancaria
│   ├── rutas/                # Lógica de navegación y optimización
│   ├── services/             # Integraciones externas (WhatsApp, Google)
│   ├── supabase/             # Clientes BD
├── supabase/
│   ├── migrations/           # 150+ archivos de historial SQL
```

---

## 🧭 Mapa de Navegación del Sistema (Menú Oficial)

Jerarquía completa de opciones disponibles en el Sidebar Administrativo (`AdminSidebar.tsx`):

*   **📊 Dashboard**: Vista general de KPIs (`/dashboard`)
*   **📦 Almacén**:
    *   `Productos`, `Lotes` (Stock), `Producción` (Desposte)
    *   `Presupuestos del Día` (Cola de preparación), `Pedidos` (Histórico)
    *   `Transferencias`, `Recepción`, `Documentos IA`
*   **🛒 Ventas**:
    *   `Presupuestos` (Cotizaciones), `Clientes`, `Listas de Precios`
    *   `Facturas` (Comprobantes), `Reclamos`
*   **🚛 Reparto**:
    *   `Rutas` (Planificación diaria), `Monitor GPS` (Tiempo real), `Vehículos`
*   **💰 Tesorería**:
    *   `Cajas` (Saldos), `Movimientos` (Diarios), `Cierres de Caja` (Arqueos)
    *   `Validar rutas` (Rendición choferes), `Conciliación` (Bancaria), `Cuentas Corrientes`
    *   `Tesoro` (Reserva), `Gastos`, `Por Sucursal`
*   **🤖 Inteligencia Artificial**:
    *   `Predicciones` (Stock/Ventas), `Reportes IA`, `Documentos IA`
*   **🏢 Sucursales**:
    *   `Gestión`, `Dashboard` (Vista local), `Ventas (POS)`
    *   `Inventario` (Conteos), `Alertas de Stock`, `Reportes`
*   **👥 RRHH**:
    *   `Empleados`, `Asistencia`, `Liquidaciones`, `Adelantos`
    *   `Licencias`, `Evaluaciones`, `Novedades`, `Reportes`
*   **📈 Reportes**:
    *   Ventas, Pedidos, Stock, Almacén, Reparto, Tesorería, Clientes, Empleados, Sucursales

---


## 🔄 Flujos Críticos

### 1. Venta a Entrega (The Happy Path)
1. **Pedido**: Bot/Vendedor crea pedido → `entregas` creada.
2. **Asignación**: Sistema asigna ruta automática (`next-client-selector`).
3. **Reparto**: Repartidor recibe ruta, elige camino (`RutaAlternativasSelector`).
4. **Entrega**: Check-in GPS + Cobro → Impacto en Caja/CC → Stock descontado.

### 2. Conciliación Bancaria
1. **Ingesta**: Admin sube PDF del banco.
2. **Parseo**: Sistema extrae líneas.
3. **Matching IA**: Gemini compara con `movimientos_caja` y `cobros`.
4. **Acreditación**: Admin confirma matches → Saldos conciliados.

---

## 🔐 Seguridad y Infraestructura Invisible (Middleware)

El archivo `middleware.ts` actúa como firewall de aplicación:
1.  **RBAC Estricto**:
    *   `/admin/*`: Solo `admin`.
    *   `/tesoreria/*`: `admin`, `tesorero`, `encargado_sucursal`.
    *   `/rrhh/*`: Solo `admin`.
2.  **Redirección Forzada**: Los usuarios `encargado_sucursal` son redirigidos automáticamente a `/sucursal/dashboard` si intentan acceder al dashboard general.
3.  **Sesión**: Verificación de token Supabase y refresh automático antes de expiración (<10 min).

## ⚡ API & Webhooks (Headless)

Endpoints que operan sin interfaz gráfica:

| Endpoint | Método | Función | Seguridad |
|----------|--------|---------|-----------|
| `/api/bot/webhook` | POST | Gateway de WhatsApp (Meta) | **Pública** (Valida Token Meta) |
| `/api/ia/prediccion-stock` | GET/CRON | Ejecuta modelos de predicción de inventario | Admin Only |
| `/api/ia/auditar-cobros` | POST | Cruza pagos recibidos vs pedidos cerrados | Admin Only |
| `/api/webhooks/mercadopago` | POST | Notificación de pagos exitosos | **Pública** (Valida Firma MP) |

---

## 💾 Esquema de Datos Crítico (Entidades Core)

*Referencia rápida para evitar consulas al documento completo.*

### Tablas Principales (Postgres)
- **Ventas**: `pedidos`, `detalles_pedido`, `clientes`, `presupuestos`, `cotizaciones`
- **Reparto**: `rutas_reparto`, `detalles_ruta` (entregas), `vehiculos`, `checklist_vehicular`
- **Almacén**: `productos`, `lotes` (stock), `movimientos_stock`, `produccion_ordenes`
- **Tesorería**: `tesoreria_cajas`, `tesoreria_movimientos`, `cuentas_corrientes`
- **RRHH**: `rrhh_empleados`, `rrhh_asistencias`, `rrhh_liquidaciones`

### Enums y Estados (Valores Exactos)
- **Roles**: `'admin'`, `'vendedor'`, `'repartidor'`, `'almacenista'`, `'tesorero'`, `'encargado_sucursal'`
- **Estado Pedido**: `'pendiente'`, `'confirmado'`, `'preparando'`, `'en_camino'`, `'entregado'`, `'cancelado'`
- **Estado Ruta**: `'planificada'`, `'en_curso'`, `'completada'`, `'cancelada'`
- **Estado Entrega**: `'pendiente'`, `'en_camino'`, `'entregado'`, `'fallido'`, `'ausente'`
- **Estado Pago**: `'pendiente'`, `'pagado'`, `'parcial'`, `'cuenta_corriente'`
- **Tipos Movimiento Stock**: `'ingreso'`, `'salida'`, `'ajuste'`, `'merma'`, `'produccion'`

---

## 🧩 Catálogo de Componentes UI (Building Blocks)

*Usar estos componentes pre-fabricados para evitar duplicación.*

| Componente | Path | Descripción |
|------------|------|-------------|
| **`<DataTable />`** | `components/ui/data-table.tsx` | Tabla server-side/client-side con filtros, ordenamiento y paginación listos. Wrappea TanStack Table. |
| **`<GoogleMapSelector />`** | `components/ui/google-map-selector.tsx` | Input de formulario para seleccionar coordenadas. Incluye buscador y marcador arrastrable. |
| **`<MonitorMap />`** | `components/reparto/MonitorMap.tsx` | Mapa en vivo de flotas. Muestra múltiples rutas coloreadas y ubicación real de choferes. |
| **`<NavigationInteractivo />`** | `components/reparto/NavigationInteractivo.tsx` | Modo navegación turn-by-turn con voz y detección de llegada. |
| **`<GpsTracker />`** | `components/reparto/GpsTracker.tsx` | Componente invisible que reporta geo-posición en segundo plano. |
| **`<SignaturePad />`** | `components/shared/SignaturePad` | (Verificar path) Captura de firma digital para entregas. |
| **`<PrintPreparacionParcial />`** | `components/almacen/PrintPreparacionParcial.tsx` | Impresión parcial de lista de preparación (productos pendientes de pesaje). |
| **`<PedidosPreparadosView />`** | `components/almacen/PedidosPreparadosView.tsx` | Vista agrupada de pedidos terminados por zona/cliente. |

---

## 📝 Cambio Reciente (2026-01-09)

**Implementaciones realizadas:**

1. **Reportes de Producción Inteligentes** (`/reportes/produccion`):
   - Nueva función `obtenerEstadisticasProduccionAction` con métricas de merma, eficiencia y desperdicios
   - Dashboard con KPIs: Órdenes, Eficiencia %, Merma Líquida, Desperdicio Sólido
   - Tendencias visuales, Top 10 productos y rendimiento por destino
   - Alertas inteligentes (merma >15% o eficiencia <80%)

2. **Validación Producción Paso 3**:
   - Función `validarDestinosCompletos()` bloquea finalización si hay destinos sin productos

3. **Impresión Parcial Lista Preparación**:
   - Componente `PrintPreparacionParcial` para imprimir solo productos pendientes de pesaje

4. **Validación Barcode en Pesajes**:
   - Handler `handleScan` valida coincidencia PLU vs código producto

5. **Campo requiere_pesaje**:
   - Nuevo campo en schema de productos para forzar pesaje incluso en mayorista

6. **Mapeo de Zonas (Migración 2026-01-09)**:
   - Nueva columna `zona_id` (FK) en tabla clientes.
   - Script masivo ejecutado para vincular ~600 clientes con sus zonas geográficas.
   - Formulario de Cliente actualizado para selección estructurada.

7. **Migración y Automatización de Listas de Precios (Migración 2026-01-09)**:
   - Asignación masiva de "Lista Mayorista" a todos los clientes activos (~200).
   - Actualización de `PresupuestoForm` para detectar y seleccionar automáticamente la lista de precios asignada al cliente.

**Impacto:** Migración de esquema (ADD COLUMN zona_id) y migración de datos masiva aplicada. Automatización de flujo de ventas.
