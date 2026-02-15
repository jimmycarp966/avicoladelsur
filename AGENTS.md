# AGENTS.md - Guía para Agentes de IA

> Documento de referencia para agentes de IA que trabajan en el proyecto Avícola del Sur ERP.
> **Última actualización:** Febrero 2026

---

## 📋 Resumen del Proyecto

**Avícola del Sur ERP** es un sistema integral de gestión avícola que unifica:
- **WMS** (Warehouse Management System) - Almacén y producción
- **TMS** (Transportation Management System) - Reparto y logística
- **CRM** (Customer Relationship Management) - Ventas y clientes
- **ERP** (Enterprise Resource Planning) - Finanzas, RRHH y sucursales

El sistema está en **PRODUCCIÓN** y potencia sus operaciones con inteligencia artificial (Google Gemini) para decisiones en tiempo real.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Framework** | Next.js | 16.x (App Router) |
| **Frontend** | React | 19.x |
| **Lenguaje** | TypeScript | 5.9.x |
| **Estilos** | Tailwind CSS | 4.x |
| **UI Components** | shadcn/ui | Latest |
| **Backend** | Supabase | Postgres 15+ |
| **Autenticación** | Supabase Auth | - |
| **Estado Global** | Zustand | 5.x |
| **Formularios** | React Hook Form + Zod | 7.x + 4.x |
| **Tablas** | TanStack Table | 8.x |
| **Testing** | Playwright | 1.57+ |
| **IA** | Google Vertex AI (Gemini) | 2.5 Flash / 3.0 Pro |

---

## 🚀 Comandos de Desarrollo

```bash
# Instalación de dependencias
npm install

# Desarrollo local
npm run dev

# Build de producción
npm run build

# Servidor de producción (requiere build previo)
npm run start

# Linting
npm run lint

# Tests específicos
npm run test:sucursales           # Tests de POS sucursales
npm run test:bot:webhook          # Tests de webhook del bot
npm run test:bot:e2e              # Tests E2E del bot con Playwright
npm run verificar-bot             # Verificar datos del bot
```

---

## 📁 Estructura del Proyecto

```
src/
├── actions/                    # Server Actions (lógica de negocio server-side)
│   ├── auth.actions.ts
│   ├── ventas.actions.ts
│   ├── almacen.actions.ts
│   ├── reparto.actions.ts
│   ├── tesoreria.actions.ts
│   ├── rrhh.actions.ts
│   └── ...
│
├── app/                        # Next.js App Router
│   ├── (admin)/                # Layout de administración
│   │   ├── (dominios)/         # Módulos de negocio
│   │   │   ├── almacen/        # WMS - Stock, lotes, producción
│   │   │   ├── ventas/         # CRM - Presupuestos, clientes
│   │   │   ├── reparto/        # TMS - Rutas, monitor GPS
│   │   │   ├── tesoreria/      # Finanzas - Cajas, movimientos
│   │   │   ├── rrhh/           # RRHH - Empleados, liquidaciones
│   │   │   ├── sucursales/     # Multi-sucursal
│   │   │   └── reportes/       # Reportes consolidados
│   │   └── dashboard/          # Dashboard principal
│   │
│   ├── (repartidor)/           # PWA para repartidores (mobile-first)
│   │   ├── entregas/
│   │   ├── ruta/[ruta_id]/
│   │   └── home/
│   │
│   ├── sucursal/               # POS de sucursales
│   ├── api/                    # Route handlers (webhooks, cron jobs)
│   ├── catalogo/               # Catálogo público web
│   └── login/                  # Autenticación
│
├── components/
│   ├── ui/                     # Componentes base shadcn/ui
│   ├── tables/                 # Tablas con TanStack
│   ├── forms/                  # Formularios reutilizables
│   ├── layout/                 # Layouts (sidebar, headers)
│   └── [modulo]/               # Componentes específicos por módulo
│
├── lib/
│   ├── supabase/               # Clientes Supabase (server/browser)
│   ├── schemas/                # Esquemas Zod para validación
│   ├── services/               # Servicios externos (WhatsApp, Google)
│   ├── rutas/                  # Algoritmos de optimización de rutas
│   ├── vertex/                 # Agente de IA (Gemini)
│   ├── conciliacion/           # Motor de conciliación bancaria
│   └── utils/                  # Utilidades generales
│
├── store/                      # Estado global Zustand
├── types/                      # Tipos TypeScript
└── hooks/                      # Custom React hooks

supabase/
├── migrations/                 # 150+ migraciones SQL
└── functions/                  # Funciones Edge (si aplica)

tests/                          # Tests E2E con Playwright
scripts/                        # Scripts de automatización
public/                         # Assets estáticos
```

---

## 🏗️ Arquitectura Server-Authoritative

El sistema sigue una arquitectura **Server-Authoritative** estricta:

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| **Presentación** | `src/app` & `components` | Rendering UI, estado efímero |
| **Orquestación** | `src/actions` | Backend-for-Frontend, validaciones |
| **Dominio/Servicios** | `src/lib/services` | Lógica de negocio pura |
| **Datos Atómicos** | `supabase/functions` | RPCs PostgreSQL para transacciones |

### Patrón Server Actions

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function miAction(datos: DatosInput) {
  const supabase = createClient()
  
  // 1. Validar con Zod
  // 2. Verificar permisos
  // 3. Ejecutar lógica (preferir RPC)
  // 4. Revalidar caché
  // 5. Retornar resultado
}
```

---

## 🔐 Seguridad y Roles

### Sistema de Roles

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| `admin` | Total | Acceso completo al sistema |
| `vendedor` | Ventas | Presupuestos, pedidos, clientes |
| `repartidor` | PWA | Entregas, tracking GPS |
| `almacenista` | Almacén | Stock, lotes, pesaje |
| `tesorero` | Tesorería | Cajas, movimientos, validaciones |
| `encargado_sucursal` | Sucursal | POS, inventario local |

### Row Level Security (RLS)

- **NUNCA** deshabilitar RLS en tablas
- Las políticas RLS están definidas en las migraciones SQL
- Para operaciones admin usar `createAdminClient()` con service_role key

### Middleware (`middleware.ts`)

- Verificación de autenticación en cada request
- Redirección de roles a rutas específicas
- Verificación de expiración de tokens

---

## 📊 Flujos de Negocio Críticos

### 1. Venta Completa (Happy Path)

```
Bot WhatsApp / Vendedor
    ↓
Presupuesto (reserva preventiva de stock)
    ↓
Almacén (pesaje de productos balanza)
    ↓
Conversión a Pedido (descuento real de stock)
    ↓
Asignación a Ruta (zona + turno + fecha)
    ↓
Reparto (GPS tracking, cobros, firmas)
    ↓
Tesorería (validación de cobros, cierres)
```

### 2. Control de Stock FIFO

- El stock se maneja por **lotes** con fecha de vencimiento
- Los descuentos siguen estrictamente orden FIFO
- Las reservas de presupuestos expiran automáticamente

### 3. Conciliación Bancaria con IA

- Ingesta de extractos bancarios (PDF/Excel)
- Matching inteligente con Gemini 3.0 Pro
- Acreditación atómica vía RPC

---

## 🤖 Integración de IA

### Modelos Utilizados

| Modelo | Uso | Ubicación |
|--------|-----|-----------|
| Gemini 2.5 Flash | Validaciones rápidas, chatbot | `src/lib/gemini.ts` |
| Gemini 2.5 Flash | Extracción de preferencias | `src/lib/vertex/memory-extractor.ts` |
| Gemini 3.0 Pro | Conciliación bancaria | `src/lib/conciliacion/gemini-matcher.ts` |

### Tools del Bot (Vertex AI)

- `consultar-stock` - Stock en tiempo real
- `consultar-precios` - Precios por lista
- `consultar-estado` - Estado de pedidos
- `consultar-saldo` - Cuenta corriente
- `crear-presupuesto` - Nueva cotización
- `crear-reclamo` - Gestión de reclamos

---

## 🧪 Estrategia de Testing

### Tests E2E con Playwright

```bash
# Ejecutar todos los tests
npx playwright test

# Ejecutar test específico
npx playwright test tests/bot-webhook.spec.ts

# Modo UI para debugging
npx playwright test --ui
```

### Scripts de Verificación

- `npm run verificar-bot` - Diagnóstico completo del bot
- `npm run test:sucursales` - Suite de POS sucursales
- `./scripts/demo-presupuestos.sh` - Flujo completo de prueba

### Verificación SQL Rápida

```sql
-- Verificar últimos presupuestos
SELECT numero_presupuesto, estado, created_at 
FROM presupuestos 
ORDER BY created_at DESC LIMIT 5;

-- Verificar stock por lote
SELECT * FROM fn_consultar_stock_por_lote(NULL);

-- Verificar rutas activas
SELECT * FROM rutas_reparto WHERE estado = 'en_curso';
```

---

## 📝 Convenciones de Código

### TypeScript

- **Estricto**: `strict: true` en tsconfig.json
- **Paths**: Usar alias `@/*` para imports
- **Tipos**: Definir en `src/types/`, importar desde `@/types`

### Estilos (Tailwind CSS v4)

- Mobile-first para módulos de reparto
- Componentes atómicos con shadcn/ui
- Gradientes sutiles y glassmorphism para UI premium

### Formularios

- Validación con Zod en cliente y servidor
- React Hook Form para manejo de estado
- Mismo schema en cliente y servidor

---

## ⚠️ Consideraciones Importantes

### Build de TypeScript

El proyecto tiene `ignoreBuildErrors: true` en `next.config.ts` debido a incompatibilidad temporal entre Zod v4 y `@hookform/resolvers`. **NO** intentar arreglar esto sin autorización explícita.

### Proveedor de Mapas

**Google Maps** es el único proveedor permitido. No usar Leaflet ni otras librerías.

### Lógica de Negocio

- **NUNCA** poner lógica crítica en componentes del cliente
- Usar Server Actions o funciones RPC de PostgreSQL
- Operaciones multi-tabla DEBEN ser atómicas

### Stock

- Siempre usar FIFO para descuentos de stock
- Validar disponibilidad antes de crear presupuestos
- Las reservas expiran automáticamente

---

## 🔧 Variables de Entorno

Crear archivo `.env.local`:

```env
# Supabase (REQUERIDO)
NEXT_PUBLIC_SUPABASE_URL=https://tu-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Google Cloud
GOOGLE_MAPS_API_KEY=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_GEMINI_API_KEY=

# WhatsApp (Twilio o Meta)
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# OpenRouteService (para rutas)
OPENROUTESERVICE_API_KEY=
```

---

## 📚 Documentación Adicional

| Documento | Descripción |
|-----------|-------------|
| `README.md` | Documentación completa del sistema |
| `ARCHITECTURE_SUMMARY.md` | Resumen de arquitectura técnica |
| `ARCHITECTURE.MD` | Arquitectura profunda con diagramas |
| `CLAUDE.md` | Guía específica para Claude Code |
| `TESTING.md` | Plan de pruebas maestro |
| `SUPABASE_SETUP.md` | Configuración de base de datos |
| `.framework/LAWS.md` | Reglas inamovibles del proyecto |

### Skills Disponibles

Ubicadas en `.claude/skills/`:

- `erp-ventas-chatbot` - Módulo de ventas y bot
- `erp-reparto` - Logística y rutas
- `erp-produccion-stock` - Almacén y producción
- `erp-rrhh-liquidaciones` - RRHH y nóminas
- `erp-sucursales-auditoria` - Sucursales y control
- `erp-tesoreria` - Finanzas y cajas

---

## 🆘 Debugging Rápido

### Logs del Middleware

Los logs de autenticación se muestran en consola con prefijo `[MIDDLEWARE AUTH LOG]`.

### Logs del Bot

Buscar en consola logs con prefijos:
- `[Bot]` - Webhook y procesamiento
- `[Vertex]` - Inicialización de IA
- `[Tool]` - Ejecución de tools
- `[Agent]` - Orquestador

### Verificar Conexión Supabase

```typescript
const { data, error } = await supabase.from('productos').select('*').limit(1);
console.log('Test Supabase:', { data, error });
```

---

## 📞 Contacto y Soporte

Para soporte técnico contactar al equipo de desarrollo.

**Repositorio:** Avícola del Sur ERP  
**Versión:** Enero 2026 (v2.3)  
**Estado:** ✅ PRODUCCIÓN
