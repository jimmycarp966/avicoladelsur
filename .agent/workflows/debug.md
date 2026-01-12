---
description: Diagnóstico rápido de errores comunes en el sistema
---
# 🔍 Workflow: Debug (/debug)

Este flujo proporciona un diagnóstico estructurado para resolver problemas rápidamente.

## Uso
El usuario dice: `/debug "Error al crear ruta de reparto"`

## Pasos

1. **Identificar Síntoma**: Leer el error exacto o comportamiento inesperado.

2. **Consultar Errores Conocidos**:
   | Síntoma | Causa Común | Solución |
   |---------|-------------|----------|
   | "new row violates row-level security" | Falta política RLS para INSERT | Agregar `WITH CHECK (true)` |
   | "relation does not exist" | Tabla faltante o migración no aplicada | Verificar `supabase/migrations/` |
   | Coordenadas `null` | PostGIS mal consultado | Usar `ST_X()` y `ST_Y()` |
   | "Cannot read properties of undefined" | Datos faltantes en respuesta | Verificar query y optional chaining |
   | Precio en `0` | Campo incorrecto en lista | Usar `precio_lista_id` (no `lista_precio_id`) |

3. **Formular Hipótesis (5-7)**: Basado en el error y código relacionado.

4. **Seleccionar Top 2**: Las más probables según contexto.

5. **Agregar Logs Mínimos**:
   ```typescript
   console.log('[DEBUG] Variable:', JSON.stringify(variable, null, 2));
   ```

6. **Confirmar con Usuario**: Antes de aplicar fix.

7. **Aplicar Fix → Probar → Limpiar Logs**.

## Recursos Rápidos

- **RLS Policies**: `supabase/migrations/` + SQL Editor
- **Server Actions**: `src/actions/`
- **Tipos**: `src/types/`
- **Supabase Client**: `src/lib/supabase/`

## Lecciones Recientes (de MEMORY.md)
- Tabla `gastos` recreada por hotfix (2026-01-10)
- PostGIS: usar `ST_X()` y `ST_Y()` para coordenadas
- Campo correcto: `precio_lista_id`
