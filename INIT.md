# INIT Context - Avicola del Sur ERP

Documento corto para arrancar una nueva sesion con `/init`.

## Estado actual (2026-02-18)
- Branch principal: `main`
- Ultimo commit funcional: `0678c2d7`
- SQL ya ejecutado en Supabase:
  - `supabase/migrations/20260218110000_reparto_tesoreria_combustible_recordatorios.sql`

## Cambios recientes ya implementados
- Tesoreria:
  - Vista unificada en `/tesoreria/por-sucursal`.
  - Renombre de "deposito bancario" a "transferencia".
  - Promesas del dia + hora en recordatorios (`hora_proximo_contacto`, operativa GMT-3).
- Reparto y vehiculos:
  - Validacion de vigencia de seguro.
  - Campos de vencimiento `SENASA` y `VTV`.
  - Alta de `km_inicial` (una sola vez por vehiculo).
  - Campos de combustible: capacidad de tanque y litros actuales.
  - Cierre de ruta con pregunta de carga de combustible y calculo de consumo `km/l`.
- Checklist diario vehiculo:
  - Aceite de motor en porcentaje (pasos de 10).
  - Limpieza interior/exterior: `mala | buena | excelente`.
  - Luces: observacion libre.
  - Presion de neumaticos: valor numerico en PSI.

## Archivos clave tocados
- `src/actions/reparto.actions.ts`
- `src/actions/reportes-reparto.actions.ts`
- `src/actions/tesoreria.actions.ts`
- `src/app/(admin)/(dominios)/tesoreria/por-sucursal/page.tsx`
- `src/app/(admin)/(dominios)/reparto/vehiculos/[id]/mantenimiento/page.tsx`
- `src/lib/schemas/reparto.schema.ts`
- `src/types/domain.types.ts`
- `supabase/migrations/20260218110000_reparto_tesoreria_combustible_recordatorios.sql`

## Comandos recomendados post-init
```bash
npm run build
git status -sb
```

## Nota operativa
Si se vuelve a tocar la logica de reparto/consumo o tesoreria por sucursal, validar que UI + acciones + migraciones queden alineadas.
