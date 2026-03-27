# Indice maestro de documentacion

Actualizado: 2026-03-27

Este archivo define la puerta de entrada a la documentacion viva del repo. Si un documento fuera de esta lista contradice alguno de los archivos marcados como canonicos, prevalece la documentacion canonica.

## 1. Documentacion canonica

### Base del sistema

- `README.md`
- `ARCHITECTURE.MD`
- `ARCHITECTURE_SUMMARY.md`

### Operacion por dominio

- `RRHH_README.md`
- `docs/IA_CAPABILITIES.md`
- `docs/FLUJO_PRESUPUESTOS_PEDIDOS_RUTAS.md`
- `docs/USUARIO_REPARTIDOR.md`

### Setup e infraestructura

- `docs/GOOGLE_CLOUD_SETUP.md`
- `docs/VERCEL_SETUP.md`
- `docs/WHATSAPP_KAPSO_SETUP.md`
- `docs/WHATSAPP_META_SETUP.md`
- `supabase/README.md`
- `docs/harness/README.md`
- `docs/harness/architecture.md`
- `docs/harness/guardrails.md`
- `docs/harness/script-contract.md`
- `docs/harness/flow.md`
- `docs/harness/troubleshooting.md`
- `docs/harness/maintenance.md`

### Configuracion viva

- `env.example`

## 2. Como leer el repo

Usar este orden:

1. `README.md` para orientacion general.
2. `docs/README.md` para decidir que documento manda segun el tema.
3. Documento de dominio o setup correspondiente.
4. Codigo fuente y migraciones si hay dudas de implementacion.

## 3. Documentacion complementaria

Estos archivos pueden seguir siendo utiles, pero no son la fuente principal de verdad:

- guias puntuales de alta de servicios
- snapshots operativos
- auditorias de una fecha concreta
- fixes, notas de migracion y checklists de entrega

Ejemplos:

- `docs/GOOGLE_MAPS_SETUP.md`
- `docs/DIALOGFLOW_SETUP.md`
- `docs/RRHH_ACTUALIZACIONES_2026-02.md`
- `docs/VERTEX_AI_CASOS_USO.md`

## 4. Documentacion historica

Estos archivos se conservan como contexto y no deben usarse como mapa vigente del sistema:

- `docs/AUDITORIA_GOOGLE_CLOUD.md`
- `docs/WHATSAPP_BUTTONS.md`
- `docs/auditoria-sidebar-completa.md`
- `docs/auditoria-sidebar-exhaustiva-diciembre-2025.md`

## 5. Reglas de mantenimiento

- Si cambia una ruta, modulo o superficie, actualizar `README.md` y `ARCHITECTURE.MD`.
- Si cambia una integracion o variable de entorno, actualizar `env.example` y la guia de setup correspondiente.
- Si cambia RRHH, actualizar `RRHH_README.md` antes que snapshots operativos.
- Si cambia la base de datos, tomar `supabase/migrations` como fuente primaria y revisar si hace falta regenerar `src/types/database.types.ts`.
- Si un documento deja de ser vigente pero se quiere conservar, agregar una nota explicita indicando que es historico o complementario.
