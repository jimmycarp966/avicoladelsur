---
description: Diagnóstico rápido de errores comunes en el sistema
---
# 🔍 Workflow: Debug (/debug)

Diagnóstico estructurado siguiendo metodología de `.framework/LAWS.md` §7.

## Uso
El usuario dice: `/debug "Error al crear ruta de reparto"`

## Metodología Obligatoria (LAWS §7)

1. **Identificar Síntoma**: Leer error exacto, stack trace, logs.

2. **Consultar Errores Conocidos** (específicos del proyecto):

   | Síntoma | Causa Común | Solución | Archivo |
   |---------|-------------|----------|----------|
   | "new row violates RLS" | Política INSERT faltante | Agregar `WITH CHECK` en migración | `supabase/migrations/` |
   | "relation does not exist" | Migración no aplicada | `supabase db push` o SQL Editor | `supabase/migrations/` |
   | Coordenadas `null` | PostGIS mal consultado | Usar `ST_X()`, `ST_Y()` | Queries con `location` |
   | Precio en `0` | Campo incorrecto | `precio_lista_id` ✅ (no `lista_precio_id`) | Listas de precios |
   | Bot no responde | Webhook no recibe/procesa | Verificar `/api/bot` + logs Vercel | `src/app/api/bot/route.ts` |
   | Vertex AI auth falla | Credenciales mal configuradas | `GOOGLE_APPLICATION_CREDENTIALS` + base64 | `src/lib/vertex/ensure-google-credentials.ts` |
   | Stock negativo | FIFO no respetado | Verificar `fn_descontar_stock_fifo` | RPC Supabase |
   | "Cannot read ... of undefined" | Datos faltantes en response | Optional chaining `?.` + nullish `??` | Queries Supabase |
   | Supabase CLI "project ref" | No está linkeado | `supabase link` (solo en local) | - |

3. **Formular 5-7 Hipótesis**: Basado en error, código relacionado y lecciones de `MEMORY.md`.

4. **Seleccionar Top 2**: Las más probables. **Consultar al usuario antes de aplicar**.

5. **Agregar Logs Mínimos** (no saturar):
   ```typescript
   console.log('[DEBUG:módulo] Variable:', JSON.stringify(variable, null, 2))
   ```

6. **Aplicar Fix** solo cuando logs confirmen causa raíz.

7. **Probar con logs activos** → si funciona → **limpiar logs** → marcar resuelto.

## Recursos por Síntoma

- **RLS/DB**: `supabase/migrations/` + Supabase SQL Editor
- **Server Actions**: `src/actions/*` (277+ funciones)
- **Bot WhatsApp**: `src/app/api/bot/route.ts` + `src/lib/vertex/agent.ts`
- **Vertex AI**: `src/lib/vertex/*` (tools, session, prompt)
- **Supabase Clients**: `src/lib/supabase/server.ts` (admin vs anon)

## Scripts de Diagnóstico

```powershell
// turbo
# Test bot webhook (simula Twilio)
npm run test:bot:webhook

# Ver Server Actions por módulo
Get-ChildItem src/actions/*.ts | Select-String "export.*Action"

# Ver migraciones recientes
Get-ChildItem supabase/migrations/*.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

## Lecciones Críticas Recientes (ver `GEMINI.md` + `MEMORY.md`)
- Tabla `gastos` recreada por hotfix (2026-01-10)
- PostGIS: `ST_X()`, `ST_Y()` para coordenadas
- Montos: usar `limpiarMonto()` parser
- Acreditación: `fn_acreditar_saldo_cliente_v2` (atómica)
- Pesables mayoristas: `peso_final` tiene prelación sobre conversión
