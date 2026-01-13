---
description: Lee todo para entender el sistema
---
# 🏗️ Workflow: Entender Arquitectura (/architecture)

Este flujo proporciona una inmersión profunda en la estructura técnica del ERP.

## Pasos

1. **Lectura Fractal** (de general a específico):
   - **Nivel 1 - Vista General**: `ARCHITECTURE_SUMMARY.md` (TL;DR, módulos, stack)
   - **Nivel 2 - Reglas**: `.framework/LAWS.md` (restricciones arquitectónicas)
   - **Nivel 3 - Deep Dive**: `ARCHITECTURE.md` (esquemas DB, flujos, dominios)
   - **Nivel 4 - Contexto Vivo**: `GEMINI.md` + `.context/MEMORY.md` (lecciones recientes)

2. **Entry Points Críticos** (dónde empezar a codear):
   ```
   src/app/api/*           → Webhooks (bot, IA, externos)
   src/actions/*           → Server Actions (277+ funciones)
   src/lib/supabase/*      → DB clients (server/admin)
   src/lib/vertex/*        → Vertex AI Agent + Tools
   supabase/migrations/*   → Schema DB (150+ migraciones)
   ```

3. **Exploración de Módulos** (6 dominios principales):
   - **Ventas**: CRM, presupuestos, listas de precios, bot WhatsApp
   - **Reparto**: TMS, GPS, rutas, entregas last-mile
   - **Almacén**: Stock FIFO, lotes, pesajes, producción
   - **Tesorería**: Cajas, conciliación bancaria, cuentas corrientes, gastos
   - **RRHH**: Empleados, asistencias, liquidaciones
   - **Sucursales**: Multi-sucursal, transferencias, POS

4. **Mapa de Integraciones**:
   - **Supabase**: Postgres 15+ (RLS, RPC, Realtime)
   - **Vertex AI**: Gemini 1.5/2.5 Flash + Agent Builder + Memory Bank
   - **WhatsApp**: Twilio + Meta Business (webhook en `/api/bot`)
   - **Mapas**: Google Maps JS API (Directions, Places, Geocoding)
   - **Pagos**: Mercado Pago (pendiente integración)

5. **Archivos de Referencia Rápida**:
   - Stack: `GEMINI.md` §2
   - Esquema DB: `ARCHITECTURE.md` §9 o `ARCHITECTURE_SUMMARY.md` §12
   - Server Actions: grep `export.*function.*Action` en `src/actions/`
