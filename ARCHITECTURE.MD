# Arquitectura del Sistema de Gestión Integral - Avícola del Sur

**Docs relacionadas:** [README](./README.md) · [Architecture Summary](./ARCHITECTURE_SUMMARY.md) · [Supabase Setup](./SUPABASE_SETUP.md)

---

## 📋 Información General

**Sistema ERP Completo y Funcional** diseñado para eliminar silos de información entre Almacén, Ventas, Reparto, Tesorería y RRHH, creando una única fuente de la verdad en Supabase con planificación semanal de rutas, GPS tracking en tiempo real y optimización automática.

### 🎯 Estado Actual (Febrero 2026) - PRODUCCIÓN ✅

| Módulo | Estado | Características Clave |
|--------|--------|----------------------|
| **WMS (Almacén)** | ✅ Producción | Stock FIFO, lotes, producción con mermas, pesaje con IA |
| **TMS (Reparto)** | ✅ Producción | GPS tracking, optimización ORS/Google, navegación interactiva |
| **CRM (Ventas)** | ✅ Producción | Bot WhatsApp, catálogo web, presupuestos, listas de precios |
| **ERP (Finanzas)** | ✅ Producción | Conciliación bancaria con IA, cajas, cuentas corrientes |
| **RRHH** | ✅ Producción | Asistencia, liquidaciones, adelantos, mensajería interna |
| **Sucursales** | ✅ Producción | POS, auditoría de precios, transferencias, remitos |

### Diferenciales Técnicos (Febrero 2026)

1. **Inteligencia Artificial Omnipresente**
   - Google Gemini 2.5 Flash (validaciones rápidas) y 3.0 Pro (razonamiento complejo)
   - Conciliación bancaria automática con matching inteligente
   - Validación de peso en balanza con detección de anomalías
   - Memory Bank para aprendizaje automático de preferencias de clientes

2. **Logística Autónoma**
   - Optimización híbrida: OpenRouteService (OSM) + Google Directions + fallback local
   - Navegación interactiva con selección de rutas alternativas
   - PWA offline-first con tracking GPS cada 5 segundos
   - Alertas automáticas de desvío (>200m) y clientes saltados (<100m)

3. **Producción Científica**
   - Control de rendimientos esperados vs reales
   - Diferenciación entre merma líquida y desperdicio sólido
   - Producción incremental con Memory Bank
   - Remitos de producción automáticos

4. **Tesorería Blindada**
   - Motor de conciliación bancaria con parser robusto (PDF/Excel)
   - Acreditación atómica vía RPC SQL para evitar condiciones de carrera
   - Validación cruzada de rendiciones de choferes
   - Gestión de proveedores con facturas y pagos

5. **Sistema de Remitos Integral**
   - Numeración secuencial independiente por tipo
   - Generación de PDFs con pdfkit + firmas digitales
   - Snapshots de datos para inmutabilidad histórica
   - Cobertura: entregas, traslados y producción

---

## 🛠️ Stack Tecnológico - COMPLETO ✅

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| **Framework** | Next.js | 16.x (App Router) | Server Components, Server Actions, PPR |
| **Frontend** | React | 19.x | Interfaz moderna con hooks y suspense |
| **Lenguaje** | TypeScript | 5.9.x | Tipado estricto, paths aliases |
| **Estilos** | Tailwind CSS | 4.x | Estilos utilitarios, mobile-first |
| **UI Components** | shadcn/ui | Latest | Componentes accesibles y personalizables |
| **Estado Global** | Zustand | 5.x | Estado mínimo: sesión, notificaciones |
| **Formularios** | React Hook Form + Zod | 7.x + 4.x | Validación type-safe, UX optimizada |
| **Tablas** | TanStack Table | 8.x | Paginación, filtros, sorting, grouping |
| **Backend** | Supabase | Postgres 15+ | Auth, Storage, Realtime, Edge Functions |
| **Mapas** | Google Maps JS API | v3 | Visualización GPS, rutas, autocompletado |
| **Routing** | OpenRouteService | VROOM | Optimización TSP, datos OSM actualizados |
| **IA Core** | Google Vertex AI | Gemini 2.5/3.0 | Chatbot, validaciones, conciliación |
| **WhatsApp** | Twilio / Meta API | v1 | Bot de ventas, notificaciones |
| **PDF** | pdfkit | Latest | Generación de remitos y reportes |
| **Barcode** | @zxing/library | 0.21+ | Escaner de códigos de balanza |
| **Testing** | Playwright | 1.57+ | Tests E2E automatizados |

---

## 🏗️ Arquitectura Server-Authoritative

El sistema sigue una arquitectura **Server-Authoritative** estricta para garantizar consistencia y seguridad:

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAPA DE PRESENTACIÓN                    │
│  src/app/ │ src/components/                                      │
│  • Server Components (default)                                  │
│  • Client Components ('use client')                             │
│  • UI State (hooks, form state)                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / Server Actions
┌────────────────────────────▼────────────────────────────────────┐
│                      CAPA DE ORQUESTACIÓN                       │
│  src/actions/                                                   │
│  • Backend-for-Frontend (BFF)                                   │
│  • Validación de inputs (Zod)                                   │
│  • Autorización (roles, RLS)                                    │
│  • Llamadas a servicios y RPCs                                  │
│  • Formateo de respuestas                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ Service Calls
┌────────────────────────────▼────────────────────────────────────┐
│                       CAPA DE DOMINIO                           │
│  src/lib/services/ │ src/lib/rutas/                              │
│  • Lógica pura de negocio                                       │
│  • Algoritmos (optimización, TSP)                               │
│  • Integraciones externas (Google, Twilio)                      │
│  • Servicios de IA (Gemini, Vertex)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │ RPC / SQL
┌────────────────────────────▼────────────────────────────────────┐
│                      CAPA DE DATOS ATÓMICOS                     │
│  supabase/migrations/ (184+ archivos)                           │
│  • Funciones RPC PostgreSQL                                     │
│  • Triggers y constraints                                       │
│  • Row Level Security (RLS)                                     │
│  • Transacciones ACID garantizadas                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujos de Datos Principales

### Flujo A: Presupuesto → Pedido → Entrega (Happy Path)

```
Bot WhatsApp / Vendedor Web
    ↓
[Server Action] crearPresupuestoAction()
    ↓
RPC: fn_crear_presupuesto_desde_bot() / fn_crear_presupuesto()
    ↓
• Reserva preventiva de stock (lotes FIFO)
• Asignación automática de turno según hora
• Estado: 'en_almacen'
    ↓
Almacén: Pesaje de productos balanza (PesajeItemCard)
    ↓
[Server Action] convertirPresupuestoAPedidoAction()
    ↓
RPC: fn_convertir_presupuesto_a_pedido()
    ↓
• Descuento real de stock
• Creación de entrega(s)
• Asignación a ruta existente o nueva
    ↓
Reparto: PWA con GPS tracking
    ↓
Entrega + Cobro + Firma digital
    ↓
Tesorería: Validación de cobros + Acreditación
```

### Flujo B: Conciliación Bancaria con IA

```
Admin sube PDF/Excel bancario
    ↓
[API] /api/tesoreria/procesar-extracto
    ↓
Parser robusto: segmentación + normalización de montos
    ↓
Gemini 3.0 Pro: Matching difuso con movimientos_caja
    ↓
Sugerencias de conciliación (confianza > 80%)
    ↓
Admin revisa y confirma matches
    ↓
RPC: fn_acreditar_saldo_cliente_v2()
    ↓
Transacción atómica: Cuenta Corriente + Caja + Movimiento
```

### Flujo C: GPS Tracking en Tiempo Real

```
PWA Repartidor
    ↓
navigator.geolocation.watchPosition()
    ↓
POST /api/reparto/ubicacion (cada 5s)
    ↓
Supabase: ubicaciones_repartidores (INSERT)
    ↓
Realtime subscription (broadcast)
    ↓
Monitor Admin: Google Maps actualizado automáticamente
    ↓
Alertas: Desvío >200m | Cliente saltado <100m
```

---

## 📁 Estructura de Directorios Detallada

```
avicola-del-sur/
├── src/
│   ├── actions/                    # 39 Server Actions
│   │   ├── almacen.actions.ts      # Stock, lotes, movimientos FIFO
│   │   ├── produccion.actions.ts   # Órdenes de desposte, rendimientos
│   │   ├── presupuestos.actions.ts # Cotizaciones, conversión a pedidos
│   │   ├── presupuestos-dia.actions.ts # Cola de preparación diaria
│   │   ├── ventas.actions.ts       # Clientes, facturas, listas de precios
│   │   ├── reparto.actions.ts      # Rutas, vehículos, asignaciones
│   │   ├── plan-rutas.actions.ts   # Planificación semanal
│   │   ├── tesoreria.actions.ts    # Cajas, movimientos, cierres
│   │   ├── conciliacion*.actions.ts # Matching bancario con IA
│   │   ├── rrhh.actions.ts         # Empleados, asistencia, liquidaciones
│   │   ├── mensajes.actions.ts     # Mensajería interna
│   │   ├── sucursales*.actions.ts  # Gestión multi-sucursal
│   │   ├── remitos.actions.ts      # Generación de remitos PDF
│   │   └── reportes*.actions.ts    # 8 reportes especializados
│   │
│   ├── app/                        # Next.js App Router
│   │   ├── (admin)/               # Layout administrativo con sidebar
│   │   │   ├── (dominios)/
│   │   │   │   ├── almacen/       # WMS completo
│   │   │   │   │   ├── productos/      # CRUD productos
│   │   │   │   │   ├── lotes/          # Gestión de lotes FIFO
│   │   │   │   │   ├── produccion/     # Desposte, rendimientos
│   │   │   │   │   ├── presupuestos-dia/ # Cola de preparación
│   │   │   │   │   ├── presupuesto/[id]/pesaje/  # Pesaje con escáner
│   │   │   │   │   ├── control-stock/  # Auditoría física
│   │   │   │   │   └── en-preparacion/ # Pedidos en preparación
│   │   │   │   │
│   │   │   │   ├── ventas/        # CRM completo
│   │   │   │   │   ├── presupuestos/   # Cotizaciones
│   │   │   │   │   ├── clientes/       # Gestión de clientes
│   │   │   │   │   ├── listas-precios/ # Listas dinámicas
│   │   │   │   │   └── reclamos/       # Gestión de reclamos
│   │   │   │   │
│   │   │   │   ├── reparto/       # TMS completo
│   │   │   │   │   ├── planificacion/  # Planificación semanal
│   │   │   │   │   ├── monitor/        # GPS tracking tiempo real
│   │   │   │   │   ├── rutas/          # Gestión de rutas
│   │   │   │   │   └── vehiculos/      # Checklist, mantenimiento
│   │   │   │   │
│   │   │   │   ├── tesoreria/     # Finanzas
│   │   │   │   │   ├── cajas/          # Gestión de cajas
│   │   │   │   │   ├── cuentas-corrientes/ # CC clientes
│   │   │   │   │   ├── validar-rutas/  # Validación de cobros
│   │   │   │   │   ├── proveedores/    # Facturas y pagos
│   │   │   │   │   └── tesoro/         # Reserva central
│   │   │   │   │
│   │   │   │   ├── rrhh/          # Recursos Humanos
│   │   │   │   │   ├── empleados/      # Gestión de empleados
│   │   │   │   │   ├── asistencia/     # Control de presentismo
│   │   │   │   │   ├── liquidaciones/  # Cálculo de nómina
│   │   │   │   │   ├── adelantos/      # Adelantos controlados
│   │   │   │   │   ├── mensajes/       # Mensajería interna
│   │   │   │   │   └── evaluaciones/   # Evaluaciones de desempeño
│   │   │   │   │
│   │   │   │   ├── sucursales/    # Multi-sucursal
│   │   │   │   │   ├── transferencias/ # Traslados de stock
│   │   │   │   │   └── [id]/           # Detalle por sucursal
│   │   │   │   │
│   │   │   │   └── reportes/      # 9 tipos de reportes
│   │   │   │
│   │   │   └── dashboard/         # Dashboard principal
│   │   │
│   │   ├── (repartidor)/          # PWA móvil para repartidores
│   │   │   ├── home/              # Dashboard del repartidor
│   │   │   ├── entregas/          # Lista de entregas del día
│   │   │   └── ruta/[ruta_id]/    # Navegación interactiva
│   │   │
│   │   ├── sucursal/              # POS sucursales
│   │   │   ├── dashboard/         # Panel local
│   │   │   └── ventas/            # Punto de venta táctil
│   │   │
│   │   ├── api/                   # Endpoints API
│   │   │   ├── bot/               # Webhook y procesamiento del bot
│   │   │   ├── webhooks/whatsapp-meta/  # Webhook oficial de Meta
│   │   │   ├── reparto/ubicacion/ # API de tracking GPS
│   │   │   ├── rutas/generar/     # Optimización de rutas
│   │   │   ├── almacen/analizar-peso/  # Validación de peso con IA
│   │   │   └── tesoreria/procesar-extracto/  # Parser bancario
│   │   │
│   │   ├── catalogo/              # Catálogo web público
│   │   └── login/                 # Autenticación
│   │
│   ├── components/                # 166+ componentes React
│   │   ├── ui/                    # 50+ componentes shadcn/ui
│   │   ├── almacen/               # 13 componentes (PesajeForm, PesajeItemCard)
│   │   ├── reparto/               # 12 componentes (MonitorMap, NavigationInteractivo)
│   │   ├── rrhh/                  # Componentes de RRHH
│   │   ├── sucursales/            # Componentes de sucursales
│   │   ├── tables/                # Tablas reutilizables
│   │   ├── forms/                 # Formularios reutilizables
│   │   └── layout/                # Layouts (AdminSidebar, etc)
│   │
│   ├── lib/                       # 108 archivos de utilidades
│   │   ├── services/              # Integraciones externas
│   │   │   ├── ruta-optimizer.ts  # Optimización híbrida TSP
│   │   │   ├── google-directions.ts
│   │   │   ├── ors-directions.ts  # OpenRouteService
│   │   │   ├── gemini.ts          # Google Gemini
│   │   │   └── whatsapp.ts        # Twilio/Meta
│   │   │
│   │   ├── rutas/                 # Lógica de rutas
│   │   │   ├── local-optimizer.ts # Nearest Neighbor + 2-opt
│   │   │   └── next-client-selector.ts
│   │   │
│   │   ├── conciliacion/          # Motor de conciliación
│   │   │   ├── gemini-matcher.ts  # Matching con IA
│   │   │   └── parser-extracto.ts # Parser PDF/Excel
│   │   │
│   │   ├── vertex/                # Agente de IA
│   │   │   ├── agent.ts           # Orquestador principal
│   │   │   ├── memory-extractor.ts
│   │   │   └── tools/             # Tools del bot
│   │   │
│   │   ├── schemas/               # Esquemas Zod
│   │   ├── supabase/              # Clientes Supabase
│   │   │   ├── server.ts          # Cliente server-side
│   │   │   └── client.ts          # Cliente browser-side
│   │   │
│   │   └── utils/                 # Utilidades generales
│   │       └── pesaje.ts          # Helpers de pesaje
│   │
│   ├── hooks/                     # Custom React hooks
│   ├── store/                     # Zustand stores
│   └── types/                     # TypeScript types
│
├── supabase/                      # 184+ migraciones SQL
│   ├── migrations/                # Historial de cambios
│   └── seed.sql                   # Datos iniciales
│
├── scripts/                       # Scripts de automatización
├── tests/                         # Tests E2E con Playwright
└── docs/                          # Documentación adicional
```

---

## 🤖 Integración de IA - Arquitectura Detallada

### Modelos Utilizados

| Modelo | Uso | Implementación | Latencia |
|--------|-----|----------------|----------|
| **Gemini 2.5 Flash** | Validación de peso, chatbot ventas, clasificación | `src/lib/services/gemini.ts` | < 500ms |
| **Gemini 2.5 Flash** | Extracción de preferencias (Memory Bank) | `src/lib/vertex/memory-extractor.ts` | < 1s |
| **Gemini 3.0 Pro** | Conciliación bancaria, auditoría compleja | `src/lib/conciliacion/gemini-matcher.ts` | < 3s |

### Memory Bank Inteligente

Sistema de aprendizaje automático para personalizar la atención:

```typescript
// Extracción de hechos después de cada conversación
interface MemoryFact {
  categoria: 'preferencia_producto' | 'tipo_negocio' | 'horario_preferido' | ...
  hecho: string           // "Prefiere pollo entero"
  confianza: number       // 0.85
  fuente: string          // Mensaje del cliente
  fecha_extraccion: Date
}
```

Almacenado en tabla `cliente_memories` y utilizado en prompts subsiguientes.

---

## 🔐 Seguridad y RLS (Row Level Security)

### Sistema de Roles

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| `admin` | Total | Acceso completo al sistema |
| `vendedor` | Ventas + Clientes | Presupuestos, pedidos, catálogo |
| `repartidor` | PWA + Reparto | Entregas, tracking GPS, cobros |
| `almacenista` | Almacén | Stock, lotes, pesaje, producción |
| `tesorero` | Tesorería | Cajas, movimientos, validaciones |
| `encargado_sucursal` | Sucursal | POS local, inventario, ventas |

### Políticas RLS Clave

Todas las tablas tienen RLS habilitado. Ejemplo de patrón:

```sql
-- Política para repartidores: solo ven sus rutas asignadas
CREATE POLICY "Repartidores ven solo sus rutas" ON rutas_reparto
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM rrhh_empleados 
      WHERE rol = 'repartidor' AND id = rutas_reparto.repartidor_id
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Middleware de Aplicación

```typescript
// middleware.ts - Firewall de aplicación
export async function middleware(request: NextRequest) {
  // 1. Verificación de sesión
  // 2. Redirección por rol
  // 3. Refresco automático de tokens (< 10 min)
  // 4. Redirección de encargados_sucursal a /sucursal/dashboard
}
```

---

## ⚡ API & Webhooks

### Endpoints Públicos

| Endpoint | Método | Función | Seguridad |
|----------|--------|---------|-----------|
| `/api/webhooks/whatsapp-meta` | GET/POST | Webhook oficial WhatsApp Business | Pública (verificación Meta) |
| `/api/bot` | POST | Procesador de mensajes del bot | Pública |
| `/api/reparto/ubicacion` | POST | Tracking GPS | Token de sesión |
| `/api/rutas/generar` | POST | Optimización de rutas | Admin/Autenticado |
| `/api/almacen/analizar-peso` | POST | Validación IA de peso | Autenticado |
| `/api/tesoreria/procesar-extracto` | POST | Parser bancario | Admin/Tesorero |

### Estructura de Respuestas

Todas las respuestas siguen el formato estándar:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}
```

---

## 📊 Esquema de Datos Crítico

### Entidades Core

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    clientes     │────▶│  presupuestos   │────▶│    pedidos      │
│  (PostGIS coords)│     │  (estado: enum) │     │  (agrupador)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                              ▼                         ▼                         ▼
                       ┌──────────────┐        ┌──────────────┐          ┌──────────────┐
                       │  entregas    │        │   facturas   │          │   cobros     │
                       │(estado_pago) │        │  (estado)    │          │(referencia)  │
                       └──────────────┘        └──────────────┘          └──────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ rutas_reparto│
                       │(GPS tracking)│
                       └──────────────┘
```

### Tablas Principales (184+ migraciones)

| Dominio | Tablas Clave |
|---------|-------------|
| **Ventas** | `presupuestos`, `pedidos`, `entregas`, `clientes`, `listas_precios`, `precios_producto` |
| **Reparto** | `rutas_reparto`, `detalles_ruta`, `vehiculos`, `ubicaciones_repartidores` |
| **Almacén** | `productos`, `lotes`, `movimientos_stock`, `produccion_ordenes`, `produccion_config` |
| **Tesorería** | `tesoreria_cajas`, `tesoreria_movimientos`, `cuentas_corrientes`, `conciliacion_bancaria_items` |
| **RRHH** | `rrhh_empleados`, `rrhh_asistencias`, `rrhh_liquidaciones`, `rrhh_adelantos`, `mensajes_internos` |
| **Documentos** | `remitos`, `remitos_items`, `remitos_firmas` |

---

## 📝 Cambios Recientes (Febrero 2026)

### 2026-02-15 · Fix UI Sidebar Móvil
- **Fix**: Espacio en blanco al final del sidebar en dispositivos móviles
- **Cambio**: Asegurar `h-full` en `AdminSidebar` y fondo correcto en el contenedor de `AdminLayout`

### 2026-02-06 · Fix BarcodeScanner - Temporal Dead Zone
- **Problema**: Error "Cannot access 'D' before initialization" al escanear en pesaje
- **Causa**: Función `stopAll` se usaba antes de declararse dentro de `startCamera`
- **Fix**: Reordenar declaraciones para evitar TDZ

### 2026-02-02 · Pesaje Acumulativo de Múltiples Bolsas
- **Nueva Funcionalidad**: Sistema de escaneo acumulativo para productos que requieren múltiples bolsas
- **UI**: Lista detallada de bolsas escaneadas con peso individual y total
- **Barra de Progreso**: Indicador visual de avance hacia el objetivo
- **Gestión Flexible**: Botones para eliminar bolsas individuales o reiniciar

### 2026-01-23 · Sistema de Skills Curadas
- **Optimización**: Reducción de 69 a 36 skills de alta prioridad
- **Estructura**: Migración a `.claude/skills/` para mejor organización

### 2026-01-22 · Sistema Integral de Remitos
- **Tabla**: `remitos` con numeración secuencial por tipo
- **PDF**: Generación con pdfkit, logos, firmas digitales
- **Cobertura**: Entregas, traslados, producción

### 2026-01-17 · Sistema de Mensajería Interna
- **Tabla**: `mensajes_internos` con RLS
- **Features**: Bandeja de entrada, enviados, marcado de leídos

---

## 🎯 Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Líneas de código TypeScript** | ~150,000+ |
| **Componentes React** | 166+ |
| **Server Actions** | 39 |
| **Migraciones SQL** | 184+ |
| **Endpoints API** | 25+ |
| **Tablas de base de datos** | 80+ |
| **Skills de IA** | 36 |
| **Tests E2E** | 15+ suites |

---

## 🚧 Próximos Desarrollos (Roadmap Q1 2026)

1. **MCP Server**: Integración con herramientas externas vía Model Context Protocol
2. **Predicciones ML**: Modelos de forecasting para stock y ventas
3. **App Nativa**: Capacitor/Cordova para PWA como app nativa
4. **Blockchain**: Trazabilidad de lotes con registro inmutable

---

*Documento actualizado: 15 de Febrero de 2026*
*Versión del sistema: v2.3*
*Estado: Producción ✅*
