# RRHH

Actualizado: 2026-03-27

## Resumen

RRHH es uno de los modulos mas evolucionados del repo. Ya no se limita a empleados, asistencia y liquidaciones basicas: hoy incluye integracion con Hik-Connect, legajo disciplinario, licencias con adjuntos, adelantos con planes/cuotas, mensajes internos y un flujo de liquidaciones configurable por periodo y puesto.

La ruta raiz `/rrhh` redirige actualmente a `/rrhh/empleados`.

## Superficies activas

| Ruta | Proposito |
| --- | --- |
| `/rrhh/empleados` | listado y acceso al legajo |
| `/rrhh/empleados/nuevo` | alta de empleado |
| `/rrhh/empleados/[id]` | legajo, eventos, historial y relaciones RRHH |
| `/rrhh/empleados/[id]/editar` | edicion de empleado |
| `/rrhh/empleados/[id]/incidencias/nueva` | carga de evento / incidencia |
| `/rrhh/empleados/[id]/incidencias/[eventoId]/documento` | documento imprimible del evento |
| `/rrhh/horarios` | lectura y sincronizacion de marcaciones Hik-Connect |
| `/rrhh/licencias` | licencias y descansos |
| `/rrhh/licencias/nueva` | carga de licencia o vacaciones |
| `/rrhh/adelantos` | adelantos y estado operativo |
| `/rrhh/adelantos/nuevo` | alta de adelanto |
| `/rrhh/evaluaciones` | evaluaciones |
| `/rrhh/evaluaciones/nueva` | nueva evaluacion |
| `/rrhh/mensajes` | mensajeria interna |
| `/rrhh/novedades` | novedades de RRHH |
| `/rrhh/novedades/nueva` | alta de novedad |
| `/rrhh/reportes` | reportes de RRHH |
| `/rrhh/liquidaciones` | listado de liquidaciones |
| `/rrhh/liquidaciones/calcular` | calculo y ajustes previos |
| `/rrhh/liquidaciones/configuracion` | reglas por periodo y por puesto |
| `/rrhh/liquidaciones/[id]` | planilla, jornadas, cuotas, feriados y workflow |
| `/rrhh/liquidaciones/[id]/recibo` | recibo imprimible |
| `/rrhh/liquidaciones/[id]/recibo/simple` | version simplificada del recibo |

## Capacidades reales hoy

### Empleados y legajo

- datos personales, laborales y de sucursal
- vinculacion con usuarios del sistema
- categoria y sueldo basico
- legajo disciplinario e historial de eventos
- documentos firmables e imprimibles por incidencia

### Horarios y asistencia

- consulta diaria de marcaciones Hik-Connect
- sincronizacion mensual desde Hik-Connect
- mapeo `employee_no` / persona Hik a empleado RRHH
- filtros y advertencias de consulta parcial
- debounce de marcaciones repetidas
- resguardo para no sobrescribir cargas manuales

### Licencias

- vacaciones
- enfermedad
- maternidad
- estudio
- otros permisos

Flujo operativo actual:

- carga con formulario dedicado
- certificados y adjuntos
- revision manual
- almacenamiento privado
- impacto posterior sobre asistencia y liquidaciones

### Adelantos

El modelo actual ya no es solo "adelanto simple".

Incluye:

- adelantos monetarios y en producto
- validacion de limites
- aprobacion / rechazo
- planes de adelanto
- cuotas asociadas a liquidaciones
- RLS especifico para accesos administrativos

### Evaluaciones y mensajes

- evaluaciones de desempeno
- metricas operativas complementarias
- mensajes internos
- novedades segmentadas

### Liquidaciones

El flujo actual contempla:

- calculo por empleado y periodo
- reglas por periodo
- reglas por puesto
- jornadas de liquidacion
- feriados
- tramos por puesto
- cuotas de adelantos vinculadas
- workflow de calculada -> aprobada -> autorizada/pagada
- recalcado, detalle y control manual

## Tablas y entidades relevantes

La documentacion de RRHH debe mirar primero `supabase/migrations`, porque el runtime ya usa entidades que no siempre aparecen en tipos generados viejos.

Entidades operativas relevantes hoy:

- `rrhh_empleados`
- `rrhh_categorias`
- `rrhh_asistencia`
- `rrhh_licencias`
- `rrhh_adelantos`
- `rrhh_adelanto_planes`
- `rrhh_adelanto_cuotas`
- `rrhh_novedades`
- `rrhh_evaluaciones`
- `rrhh_liquidaciones`
- `rrhh_liquidacion_detalles`
- `rrhh_liquidacion_jornadas`
- `rrhh_liquidacion_reglas_periodo`
- `rrhh_liquidacion_reglas_puesto`
- `rrhh_liquidacion_tramos_puesto`
- `rrhh_descansos_mensuales`
- `rrhh_legajo_eventos`
- `rrhh_feriados`

## Integraciones

### Hik-Connect

Piezas principales:

- `src/app/(admin)/(dominios)/rrhh/horarios`
- `src/actions/rrhh-horarios.actions.ts`
- `src/lib/services/rrhh-horarios.service.ts`
- `scripts/rrhh-hik-backfill.js`

Variables relevantes:

- `HIK_CONNECT_BASE_URL`
- `HIK_CONNECT_API_KEY`
- `HIK_CONNECT_API_SECRET`
- `HIK_CONNECT_TOKEN_PATH`
- `HIK_CONNECT_EVENTS_PATH`
- `HIK_CONNECT_EVENTS_METHOD`
- `HIK_CONNECT_AUTH_MODE`
- `HIK_CONNECT_PERSON_MAP`
- `HIK_CONNECT_PAGE_SIZE`
- `HIK_CONNECT_MAX_PAGES_HISTORICAL`
- `HIK_ATTENDANCE_DEBOUNCE_MINUTES`

### Storage y documentos

Licencias y legajo disciplinario ya usan almacenamiento y URLs firmadas para documentos sensibles.

## Cambios estructurales de marzo 2026

Cambios que ya impactan soporte y operacion:

- adelantos atomicos con planes y cuotas
- unificacion de legajo y descansos mensuales
- reglas `lun_sab`
- resolucion de tarifa por turno
- tramos por puesto
- extras y suspensiones
- bloqueo de asistencia futura dentro del mes actual
- acceso administrativo sobre licencias
- bucket privado para archivos de licencias

## APIs de RRHH

Rutas relevantes:

- `/api/rrhh/empleados/activos`
- `/api/rrhh/asistencia/marcar`
- `/api/rrhh/adelantos/crear`
- `/api/rrhh/adelantos/[id]/aprobar`
- `/api/rrhh/adelantos/[id]/rechazar`
- `/api/rrhh/liquidaciones/calcular`
- `/api/rrhh/liquidaciones/[id]/detalle`
- `/api/rrhh/liquidaciones/[id]/recalcular`
- `/api/rrhh/liquidaciones/[id]/aprobar`
- `/api/rrhh/liquidaciones/[id]/autorizar`
- `/api/rrhh/liquidaciones/[id]/pagar`
- `/api/rrhh/liquidaciones/[id]/control`
- `/api/rrhh/reportes`
- `/api/cron/rrhh/liquidaciones-en-curso`
- `/api/cron/rrhh/liquidaciones-mensuales`

## Notas de mantenimiento

- si cambia el modelo de liquidaciones, actualizar primero este archivo y luego `README.md`
- si cambia la integracion Hik, actualizar tambien `env.example`
- para revisar drift real del modulo, contrastar siempre paginas RRHH + APIs RRHH + migraciones recientes
