# Avícola del Sur - ERP Integral

> **Instrucción para el agente:** Este archivo contiene el contexto esencial del proyecto. Léelo siempre al inicio.

## 📚 Lee Siempre
- **Reglas:** `.framework/LAWS.md`
- **Historial:** `.context/MEMORY.md`
- **Arquitectura completa:** `ARCHITECTURE_SUMMARY.md`

---

## 🛠️ Stack Tecnológico
- **Framework:** Next.js 16 (App Router, Server Actions)
- **Frontend:** React 19 + TypeScript + TailwindCSS v4 + shadcn/ui
- **Base de Datos:** Supabase (Postgres 15+) + RLS + Realtime
- **IA:** Gemini 2.5 Flash (rápido) / Gemini 3.0 Pro (razonamiento)
- **Mapas:** Google Maps JS + Directions + Places API & Leaflet

---

## 📁 Estructura de Código
```
src/
├── actions/        # Server Actions (mutaciones)
├── app/            # Rutas y páginas
├── components/     # UI (shadcn + dominios)
├── lib/            # Servicios y utilidades
└── types/          # Definiciones TypeScript

supabase/
└── migrations/     # SQL migrations (150+ archivos)
```

---

## 📦 Módulos Principales
1. **Reparto (TMS)** - Logística last-mile, GPS, rutas
2. **Tesorería** - Cajas, conciliación bancaria, cuentas corrientes
3. **Almacén** - Stock FIFO, producción, pesajes
4. **Ventas** - CRM, presupuestos, chatbot WhatsApp
5. **RRHH** - Empleados, asistencias, liquidaciones

---

## 🚫 Reglas Críticas (de LAWS.md)
1. **Server Actions** para todas las mutaciones
2. **RLS siempre activo** - Nunca deshabilitar
3. **FIFO obligatorio** para descuento de stock
4. **Tablas en español** (`productos`, `clientes`, `pedidos`)
5. **Zod** para validaciones cliente/servidor
6. **Debugging con hipótesis** - No cambios drásticos sin diagnóstico (ver §7)
7. **Plan antes de codear** - Explicar qué, cómo, riesgos y pruebas (ver §8)

---

## ⚠️ Lecciones Recientes (Críticas)

| Fecha | Lección |
|-------|---------|
| 2026-01-10 | Tabla `gastos` y `gastos_categorias` recreadas por hotfix |
| 2026-01-08 | Coordenadas de clientes: usar `ST_X()` y `ST_Y()` de PostGIS |
| 2026-01-08 | Campo correcto: `precio_lista_id` (no `lista_precio_id`) |
| 2026-01-08 | RLS en `rutas_reparto` y `detalles_ruta` requiere política para inserts |
| 2026-01-11 | Montos Conciliación: Usar `limpiarMonto()` para parsear strings monetarios |
| 2026-01-11 | Acreditación: Siempre vía `fn_acreditar_saldo_cliente_v2` (atómica) |
| 2026-01-11 | Indexación: No usar índices de array para vincular datos de Gemini; usar `archivo_origen` |
| 2026-01-12 | Dependencias: `leaflet` y `react-leaflet` requeridos para Heatmaps; `next.config.ts` no acepta `serverActions` en root |

---

## 🔧 Comandos Útiles
```bash
npm run dev          # Desarrollo local
npm run build        # Build producción
supabase db push     # Aplicar migraciones
```
