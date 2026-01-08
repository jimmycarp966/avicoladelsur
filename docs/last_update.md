# Última Actualización - Avícola del Sur ERP

**Fecha:** 2026-01-08 20:05 (GMT-3)

## Cambios Detectados

Los cambios fueron aplicados directamente en la base de datos Supabase (no hay commits de código):

### Scripts SQL Ejecutados:

1. **Políticas RLS - `rutas_reparto`**
   - `rutas_reparto_select_authenticated` (SELECT)
   - `rutas_reparto_update_authenticated` (UPDATE)
   - La política INSERT ya existía

2. **Políticas RLS - `detalles_ruta`**
   - `detalles_ruta_select_authenticated` (SELECT)
   - `detalles_ruta_insert_authenticated` (INSERT)
   - `detalles_ruta_update_authenticated` (UPDATE)
   - `detalles_ruta_delete_authenticated` (DELETE)

3. **Función RPC - `fn_get_cliente_con_coordenadas`**
   - Corregida para usar `ST_Y()` y `ST_X()` de PostGIS
   - Antes fallaba tratando `geometry` como `JSONB`

## Resumen

Se corrigieron políticas RLS en tablas `rutas_reparto` y `detalles_ruta` que bloqueaban la creación de rutas desde la UI. Se actualizó la función RPC `fn_get_cliente_con_coordenadas` para extraer correctamente coordenadas desde tipo PostGIS geometry. Ahora la optimización de rutas con Google Directions funciona correctamente.

## Archivos de Documentación Modificados

- `ARCHITECTURE_SUMMARY.md` - Sección "Cambio reciente" actualizada
- `docs/CHANGELOG.md` - Nueva entrada agregada
- `docs/last_update.md` - Este archivo

## Diagrama

No se requiere actualización del diagrama (cambios solo en BD/RLS).
