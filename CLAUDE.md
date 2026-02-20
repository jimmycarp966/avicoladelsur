# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos de Desarrollo

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo

# Build y Producción
npm run build           # Compilar para producción
npm run start           # Iniciar servidor de producción

# Linting
npm run lint            # Ejecutar ESLint

# Tests Específicos
npm run test:sucursales           # Tests de sucursales
npm run test:bot:webhook          # Tests de webhook del bot
npm run test:bot:e2e              # Tests E2E del bot con Playwright
npm run verificar-bot             # Verificar datos del bot
```

## Arquitectura del Sistema

### Stack Tecnológico
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **UI**: shadcn/ui (Radix UI primitives), Lucide React icons
- **Backend**: Supabase (PostgreSQL + Auth + Storage), Server Actions
- **Mapas**: Google Maps API (unico proveedor permitido, NO usar Leaflet)
- **IA**: Google Cloud Vertex AI (Gemini), Dialogflow
- **Estado**: Zustand, React Hook Form + Zod
- **PDF**: PDFKit para generación de documentos

### Estructura del Proyecto

```
src/
├── app/
│   ├── (admin)/          # Layout principal para administración
│   │   └── (dominios)/   # 5 dominios principales: ventas, reparto, almacen, tesoreria, rrhh
│   ├── (repartidor)/     # Layout específico para repartidores (mobile-first)
│   ├── sucursal/         # Punto de venta para sucursales
│   ├── api/              # Route handlers de Next.js
│   └── layout.tsx        # Root layout con providers
├── components/
│   ├── ui/               # Componentes base de shadcn/ui
│   ├── tables/           # Componentes de tablas reutilizables
│   ├── charts/           # Componentes de gráficos (Recharts)
│   ├── forms/            # Formularios especializados
│   └── layout/           # Layouts (sidebar, nav, etc.)
├── lib/
│   ├── supabase/         # Clientes de Supabase (server y browser)
│   ├── schemas/          # Esquemas Zod para validación
│   ├── services/         # Servicios externos (Google Cloud, WhatsApp, etc.)
│   ├── vertex/           # Agente de IA (Gemini) y tools
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Utilidades generales
└── middleware.ts         # (No existe - auth manejado en Server Components)
```

### Dominios Principales (5)

1. **Ventas** (`src/app/(admin)/(dominios)/ventas/`)
   - Presupuestos, pedidos, facturas, clientes, listas de precios
   - Flujo: Presupuesto → Pedido → Ruta → Entrega → Facturación

2. **Reparto** (`src/app/(admin)/(dominios)/reparto/`)
   - Rutas diarias, planificación semanal, vehículos, GPS tracking
   - Optimización de rutas con Google Maps Directions API

3. **Almacén** (`src/app/(admin)/(dominios)/almacen/`)
   - Productos, lotes, stock FIFO, pesaje de productos balanza
   - Control de stock con reservas y expiración de reservas

4. **Tesorería** (`src/app/(admin)/(dominios)/tesoreria/`)
   - Cajas, movimientos, cierres de caja, gastos, conciliación bancaria

5. **RRHH** (`src/app/(admin)/(dominios)/rrhh/`)
   - Empleados, asistencia, liquidaciones, adelantos, novedades, licencias
   - Liquidaciones calculadas por RPC: `fn_rrhh_preparar_liquidacion_mensual` → `fn_rrhh_recalcular_liquidacion`
   - `rrhh_liquidacion_reglas_puesto.tipo_calculo`: `'hora'` (paga por horas reales) | `'turno'` (paga 1 jornal por día presente, sin horas extra — usado para repartidores)
   - `rrhh_liquidaciones.puesto_hs_extra`: puesto cuya tarifa se aplica a las horas extra cuando el empleado hace trabajo inter-rol
   - Filtro de período en `/rrhh/liquidaciones` via `searchParams` URL (`?mes=X&anio=Y`) → query al servidor sin límite; sin filtro → últimas 50

### Roles del Sistema

```typescript
// Tipos de usuario en src/lib/config.ts
ADMIN              // Acceso total
VENDEDOR           // Ventas y presupuestos
REPARTIDOR         // Rutas y entregas
ALMACENISTA        // Stock y almacén
TESORERO           // Cajas y movimientos
SUCURSAL           // Punto de venta sucursal
ENCARGADO_SUCURSAL // Gestión de sucursal
```

## Patrones de Arquitectura

### Server-Side First
La lógica crítica de negocio SIEMPRE debe estar en:
1. **Server Actions** (`src/app/api/*/route.ts`) para mutaciones
2. **PostgreSQL RPC Functions** (`supabase/migrations/*.sql`) para operaciones complejas

Nunca poner lógica de negocio en componentes del cliente.

### Cliente Supabase
- **Server**: `src/lib/supabase/server.ts` - `createClient()` usando cookies
- **Admin**: `src/lib/supabase/server.ts` - `createAdminClient()` con service_role key
- **Browser**: `src/lib/supabase/client.ts` - `createClient()` para uso en cliente

### Validaciones
- **Zod schemas** en `src/lib/schemas/` para validación de datos
- Usar los mismos schemas en cliente y servidor

### Server Actions Pattern
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function miAction(id: string) {
  const supabase = createClient()

  // 1. Validar datos
  // 2. Ejecutar lógica (preferiblemente RPC function)
  // 3. Revalidar caché si es necesario
  // 4. Retornar resultado
}
```

## Flujo Operativo Core

### Presupuestos → Pedidos → Rutas

1. **Creación de Presupuesto** (Bot WhatsApp o Web)
   - `fn_crear_presupuesto_desde_bot()` en Postgres
   - Asignación automática de turno y fecha según horario de corte
   - Estado inicial: `'en_almacen'`
   - Reserva preventiva de stock (FIFO)

2. **Almacén: Presupuestos del Día**
   - Pesaje de productos balanza (categoría = 'BALANZA')
   - Conversión a pedido: `fn_convertir_presupuesto_a_pedido()`
   - Descuento de stock físico (FIFO por lotes)

3. **Asignación a Rutas**
   - Generación automática o manual de rutas diarias
   - Optimización con Google Maps Directions API
   - Asignación de vehículo según capacidad

4. **Entrega y Facturación**
   - GPS tracking de repartidores
   - Confirmación de entrega
   - Generación de factura PDF

### Control de Stock FIFO

- El stock se controla mediante **lotes** (`lotes_stock`)
- Los descuentos SIEMPRE usan el lote más antiguo primero
- Las reservas expiran automáticamente después de un tiempo

### Migraciones SQL

- Ubicadas en `supabase/migrations/`
- Orden de ejecución: ver `supabase/migrations/ORDEN_EJECUCION_*.md`
- Siempre crear nueva migración para cambios en DB
- Usar funciones RPC para operaciones multi-tabla

## Configuración de Variables de Entorno

Crear `.env.local` en la raíz:

```env
# Supabase (REQUERIDO)
NEXT_PUBLIC_SUPABASE_URL=https://tu-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Google Cloud (opcional, para IA y mapas)
GOOGLE_MAPS_API_KEY=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_GEMINI_API_KEY=

# WhatsApp (opcional)
WHATSAPP_META_ACCESS_TOKEN=
WHATSAPP_META_PHONE_NUMBER_ID=
```

## Reglas Importantes

### NO HACER
- No deshabilitar RLS (Row Level Security)
- No usar Leaflet u otros proveedores de mapas (solo Google Maps)
- No poner lógica de negocio en componentes del cliente
- No crear archivos `.md` de documentación sin permiso explícito
- No intentar "arreglar" `ignoreBuildErrors: true` en `next.config.ts`

### HACER
- Usar Server Components por defecto
- Validar con Zod en cliente y servidor
- Usar funciones RPC para operaciones complejas de DB
- Seguir el flujo Presupuestos→Pedidos→Rutas
- Mobile-first para módulos de repartidor

### Metodología de Debugging
Antes de hacer cambios:
1. Leer código relevante
2. Formular hipótesis
3. Consultar al usuario si hay incertidumbre
4. Agregar logs mínimos para confirmar hipótesis
5. Aplicar fix solo cuando la causa raíz esté confirmada

## Testing

Always run tests after modifying authentication, delivery orders, or cash register related files. These areas have tight integration with Supabase sessions and payment flow.

## Database & Supabase

When modifying Supabase-related code, always verify:
1. Session cookies are properly set and preserved
2. RLS policies match the query being executed
3. `cash_register_id` exists in the session context before using it

## Development Workflow

For all UI/UX improvements, complete the full workflow:
1. Implement changes
2. Compile/build
3. Test the feature
4. Commit with descriptive message
5. Ask before pushing

## Code Quality

Use TypeScript for all new code and ensure type safety, especially for database queries and API routes. Avoid `any` types when working with Supabase responses.

## Archivos de Referencia

- `.framework/LAWS.md` - Reglas inamovibles de arquitectura
- `docs/FLUJO_PRESUPUESTOS_PEDIDOS_RUTAS.md` - Flujo operativo detallado
- `SUPABASE_SETUP.md` - Configuración inicial de Supabase
- `supabase/README.md` - Scripts SQL de configuración

## Skills Disponibles

El proyecto tiene varias skills especializadas. Verificar si la tarea corresponde a alguna de estas antes de proceder:

- `erp-ventas-chatbot` - Gestión de preventa, presupuestos y Bot WhatsApp
- `erp-reparto` - Optimización logística, rutas GPS y gestión de repartidores
- `erp-produccion-stock` - Control estricto de Stock FIFO, Merma Líquida y Producción
- `erp-rrhh-liquidaciones` - Liquidaciones de sueldos, asistencia, penalizaciones
- `erp-sucursales-auditoria` - Auditoría de sucursales, conteos físicos
- `erp-tesoreria` - Gestión de cajas, conciliación bancaria y precisión financiera
