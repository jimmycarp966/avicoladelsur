# RRHH · Actualizaciones Operativas (Febrero 2026)

Nota: este archivo es un snapshot operativo de febrero 2026. La referencia vigente del modulo RRHH es `RRHH_README.md`.

## Fecha
- 2026-02-20

## Resumen
Se realizaron ajustes para mejorar consistencia de datos en formularios RRHH y estabilidad del flujo de liquidaciones.

## Cambios implementados
- Se unifico la carga de empleados activos en formularios RRHH usando `obtenerEmpleadosActivosAction`.
  - Pantallas alcanzadas:
    - `/rrhh/evaluaciones/nueva`
    - `/rrhh/licencias/nueva`
    - `/rrhh/asistencia/marcar`
    - `/rrhh/adelantos/nuevo`
- Se unifico la carga de sucursales activas para evaluaciones usando `obtenerSucursalesActivasAction`.
- Se fortalecio el acceso a detalle de liquidacion (`/rrhh/liquidaciones/[id]`) con seleccion de cliente admin/no-admin para evitar 404 falsos por RLS.
- Se incorporo configuracion funcional de liquidaciones en:
  - `/rrhh/liquidaciones/configuracion`
  - Permite definir:
    - dias base por periodo (`rrhh_liquidacion_reglas_periodo`)
    - parametros por puesto (`rrhh_liquidacion_reglas_puesto`)
- Se incorporaron ajustes manuales al calcular liquidaciones (`/rrhh/liquidaciones/calcular`):
  - horas adicionales manuales
  - turnos especiales manuales
  - observaciones de RRHH
- Se mejoro la tabla de liquidaciones para mostrar mejor identidad de empleado:
  - fallback: nombre completo -> email -> "Sin nombre"
  - incluye legajo cuando esta disponible

## Impacto esperado
- Menos casos de listas vacias de empleados en formularios RRHH.
- Menos errores de navegacion al abrir planillas de liquidacion.
- Mayor control operativo de RRHH sobre parametros de calculo y ajustes extraordinarios.

## Referencias tecnicas
- `src/actions/rrhh.actions.ts`
- `src/app/(admin)/(dominios)/rrhh/evaluaciones/nueva/evaluacion-form.tsx`
- `src/app/(admin)/(dominios)/rrhh/licencias/nueva/licencia-form.tsx`
- `src/app/(admin)/(dominios)/rrhh/asistencia/marcar/marcar-asistencia-form.tsx`
- `src/app/(admin)/(dominios)/rrhh/adelantos/nuevo/adelanto-form.tsx`
- `src/app/(admin)/(dominios)/rrhh/liquidaciones/[id]/page.tsx`
- `src/app/(admin)/(dominios)/rrhh/liquidaciones/calcular/calcular-liquidaciones-form.tsx`
- `src/app/(admin)/(dominios)/rrhh/liquidaciones/configuracion/page.tsx`
- `src/app/(admin)/(dominios)/rrhh/liquidaciones/configuracion/configuracion-liquidaciones-client.tsx`
- `src/components/tables/LiquidacionesTable.tsx`
