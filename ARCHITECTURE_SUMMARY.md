# Resumen de arquitectura

Actualizado: 2026-03-27

## TL;DR

Avicola del Sur ERP es un monolito modular en Next.js 16 + Supabase con varias superficies activas:

- backoffice admin por dominios
- PWA de repartidor
- app de sucursal
- catalogo publico
- conciliacion bancaria
- bot de WhatsApp multi-proveedor
- WebMCP experimental

## Mapa corto del sistema

| Area | Ubicacion principal |
| --- | --- |
| Paginas admin | `src/app/(admin)` |
| PWA repartidor | `src/app/(repartidor)` |
| App sucursal | `src/app/sucursal` |
| Catalogo publico | `src/app/catalogo` |
| Conciliacion | `src/app/tesoreria/conciliacion` |
| APIs | `src/app/api` |
| Orquestacion | `src/actions` |
| Servicios e integraciones | `src/lib` |
| Base de datos | `supabase/migrations` |
| Harness | `docs/harness`, `scripts/harness`, `tools/harness-core` |

## Dominios vivos

- almacen
- ventas
- reparto
- tesoreria
- rrhh
- sucursales
- reportes

## Integraciones clave

### WhatsApp

`/api/bot` soporta Kapso, Meta, Twilio y compatibilidad con Botpress. El proveedor se selecciona con `WHATSAPP_PROVIDER`.

### Rutas

Fallback real del motor:

1. ORS
2. Google Directions
3. local

Modo avanzado:

1. Google Optimization API
2. Google Fleet Routing
3. fallback base

### IA

Capas activas:

- Gemini
- Vertex AI
- Document AI
- Dialogflow
- Speech-to-Text

La matriz funcional actual esta en `docs/IA_CAPABILITIES.md`.

### RRHH

RRHH ya incluye Hik-Connect, legajo disciplinario, licencias con adjuntos, adelantos con planes/cuotas, reglas de liquidacion por periodo/puesto y cambios fuertes de marzo 2026.

## Observaciones importantes

- `supabase/migrations` es la fuente principal del modelo de datos.
- `src/types/database.types.ts` fue reconciliado manualmente el 2026-03-27, pero `supabase/migrations` sigue siendo la fuente primaria y RRHH asistencia/Hik todavia merece verificacion de drift.
- La pagina raiz de RRHH redirige a `/rrhh/empleados`.
- `docs/harness/*` sigue siendo fuente de verdad del harness.
- Varias auditorias viejas en `docs/` son historicas y no deben leerse como documentacion canonica.

## Leer despues

- detalle completo: `ARCHITECTURE.MD`
- guia principal del repo: `README.md`
- RRHH: `RRHH_README.md`
- IA: `docs/IA_CAPABILITIES.md`
- flujo comercial y de rutas: `docs/FLUJO_PRESUPUESTOS_PEDIDOS_RUTAS.md`
