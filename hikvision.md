# Integracion Hikvision (Hik-Connect) para RRHH Horarios

Fecha: 2026-02-13

Este documento resume como se implemento la prueba de integracion para leer marcaciones (entrada/salida) desde Hikvision y mostrarlas en `RRHH > Horarios`.

## Aclaracion operativa (2026-02-13)

- Las marcaciones se consultan en tiempo real por API de Hikvision (Hik-Connect).
- En Supabase no necesariamente existe una tabla cruda con todos los eventos Hik; por eso el mapeo se resuelve en la capa de integracion.
- Si aparecen filas "No mapeado", el problema es de correspondencia entre `employeeNo`/`personCode` de Hik y el maestro de `rrhh_empleados`.
- Recomendacion: usar un campo dedicado `hik_person_code` para vincular personas (evitar sobrecargar `dni` con codigos externos).

## Estado validado en entorno real (2026-02-13, tarde)

- Endpoint operativo confirmado en este tenant:
  - `POST /api/hccgw/acs/v1/event/certificaterecords/search`
- Endpoints alternativos de attendance probados devolvieron `404` en este tenant (no habilitados actualmente).
- El payload real incluye nombre y codigo en:
  - `personInfo.baseInfo.firstName`
  - `personInfo.baseInfo.lastName`
  - `personInfo.baseInfo.personCode`
  - y en algunos casos `personInfo.id` como identificador interno.

### Tipos de evento observados

- `110005`: evento de asistencia util (con persona en la mayoria de casos).
- `110517`: evento tecnico/no autenticado, normalmente sin persona (`personCode` vacio).
- `110552`: evento menos frecuente (no dominante en RRHH).

### Comportamiento importante del API

- Aunque se envie rango de fecha del dia, Hik puede devolver historico mezclado de varias fechas.
- Por eso se aplico filtrado por fecha de negocio del lado servidor antes de consolidar RRHH.
- Se implemento paginado server-side para traer multiples paginas (no quedarse solo en pagina 1).

### Mapeo RRHH aplicado

Orden de mapeo activo:

1. `personCode/employeeNo` contra `dni/cuil/legajo`.
2. Fallback por nombre (`firstName + lastName` de Hik vs `nombre + apellido` en RRHH, normalizado).
3. Mapeo persistente en BD (`public.rrhh_hik_person_map`).
4. Fallback por variable de entorno:
   - `HIK_CONNECT_PERSON_MAP=personCode=LEG001,otroCodigo=UUID_o_DNI_o_CUIL`

## Actualizacion operativa (2026-02-26)

- Se agrego `public.rrhh_hik_person_map` para guardar vinculaciones Hik -> `rrhh_empleados` de forma estable.
- Se unifico el uso del mapeo en:
  - `RRHH > Horarios` (sync diario y mensual)
  - proceso automatico de liquidaciones RRHH
- Si la tabla no existe aun, el sistema sigue funcionando con fallback a `HIK_CONNECT_PERSON_MAP`.

### Backfill y autovinculacion masiva

Se agrego script operativo:

- `npm run rrhh:hik:backfill -- --from=YYYY-MM-DD --to=YYYY-MM-DD --apply`

Comportamiento:

1. Lee eventos Hik por dia y normaliza marcaciones.
2. Intenta mapear por `rrhh_hik_person_map`, env map, DNI/CUIL/legajo y UUID.
3. Si un codigo Hik no tiene match y se usa `--apply`, crea empleado placeholder y lo vincula.
4. Sincroniza `rrhh_asistencia` respetando cargas manuales existentes.

Opciones utiles:

- `--apply`: aplica cambios reales (sin esto corre en dry-run).
- `--no-create-placeholders`: no crea empleados nuevos para codigos sin match.

### Nota sobre IDs con ceros (liquidacion externa)

- En archivos de control horario externos (ej: `202601 Liquidación Enero AVS.xlsx`) aparece formato `00000013`.
- Ese tipo de ID puede convivir con formatos numericos y/o valores con sufijo `.0` por export de Excel.
- Recomendacion: normalizar IDs al importar (`trim`, quitar `.0` cuando aplique, mantener ceros a la izquierda si el ID es de longitud fija).

## Objetivo

Leer eventos de control de acceso/asistencia desde Hik-Connect y convertirlos a una vista de horarios diarios:

- Entrada: primera marcacion del dia por empleado.
- Salida: ultima marcacion del dia por empleado.
- Estado: mapeado con empleados RRHH por `employeeNo`/`personCode` (con fallback por DNI cuando aplique).

## Enfoque aplicado (Plan B)

No usamos librerias de terceros no oficiales para autenticacion principal.  
Se implemento un cliente HTTP propio en el backend para:

1. Obtener token desde Hik-Connect.
2. Consultar eventos de acceso/asistencia.
3. Normalizar datos de eventos.
4. Agrupar por empleado y fecha de negocio.

## Endpoints que funcionaron

Base URL validada:

- `https://isa.hikcentralconnect.com`

Token:

- `POST /api/hccgw/platform/v1/token/get`

Eventos:

- `POST /api/hccgw/acs/v1/event/certificaterecords/search`

## Modo de autenticacion que funciono

Modo configurado:

- `hcc_token`

Flujo:

1. Se envia `appKey` + `secretKey` al endpoint de token.
2. Hik devuelve token en `data.accessToken` (camelCase).
3. Para endpoint de eventos se envia header `token: <accessToken>`.

Importante:

- No usar `Authorization: Bearer ...` para este flujo especifico.
- Se agrego soporte para distintas formas de token en respuesta por compatibilidad.

## Variables de entorno usadas

Configurar en `.env.local` (sin commitear secretos):

```env
HIK_CONNECT_BASE_URL=https://isa.hikcentralconnect.com
HIK_CONNECT_TOKEN_PATH=/api/hccgw/platform/v1/token/get
HIK_CONNECT_EVENTS_PATH=/api/hccgw/acs/v1/event/certificaterecords/search
HIK_CONNECT_EVENTS_METHOD=POST
HIK_CONNECT_AUTH_MODE=hcc_token

HIK_CONNECT_API_KEY=TU_APP_KEY
HIK_CONNECT_API_SECRET=TU_SECRET_KEY
```

## Archivos implementados

- `src/lib/services/hikconnect.client.ts`
- `src/lib/services/rrhh-horarios.service.ts`
- `src/actions/rrhh-horarios.actions.ts`
- `src/app/(admin)/(dominios)/rrhh/horarios/page.tsx`
- `src/app/(admin)/(dominios)/rrhh/horarios/horarios-client.tsx`

## Comportamiento de la pantalla de Horarios

- Permite consultar por fecha.
- Muestra cantidad de registros completos (entrada + salida).
- Muestra advertencias de integracion cuando hay eventos omitidos.
- Si hay eventos sin `employeeNo` o `timestamp`, se omiten.

## Problemas encontrados y solucionados

1. Error de token no encontrado

- Causa: el parser buscaba `access_token` y Hik devolvia `data.accessToken`.
- Solucion: ampliar parser para soportar ambos formatos.

2. Respuesta sin eventos por paginado grande

- Causa: `pageSize` muy alto devolvia resultados vacios/inesperados.
- Solucion: usar `pageSize` maximo de 200.

3. Muchos "No mapeado" en empleados

- Causa: faltaban DNI/CUIL o no coincidia clave de mapeo con RRHH.
- Solucion: completar/migrar DNI en `rrhh_empleados` y mejorar matching.

4. Advertencias excesivas por evento

- Causa: se emitia warning por cada item incompleto.
- Solucion: resumir advertencias para no saturar UI/logs.

## Reglas de mapeo de eventos a empleados

Prioridad usada para intentar mapear:

1. `employeeNo`/`personCode` del evento Hik contra identificador interno equivalente en RRHH (preferido: `hik_person_code`).
2. DNI/documento del evento vs `rrhh_empleados.dni` (solo si realmente corresponde a DNI argentino).
3. CUIL/legajo como fallback de compatibilidad (si se define en la implementacion).
4. Fallback a "No mapeado" si no hay match confiable.

### Criterio de calidad de datos

- Si faltan `employeeNo` o `timestamp`, el evento se omite por seguridad.
- Si hay alta cantidad de omitidos, revisar configuracion de payload y permisos del endpoint de eventos.
- Si hay registros completos pero sin match RRHH, completar mapeo de personas antes de cerrar liquidaciones.

## Recomendaciones para produccion

1. Crear un proceso de sincronizacion maestro de personas (Hik -> RRHH) con identificador unico estable.
2. Guardar eventos crudos en tabla historica para auditoria.
3. Agregar job incremental por rango horario (cada 5-15 min).
4. Definir zona horaria de negocio explicita para cierre de dia.
5. Configurar alertas cuando la API devuelva 0 eventos en un dia normalmente activo.

## Checklist rapido de debugging

1. Verificar que `HIK_CONNECT_API_KEY` y `HIK_CONNECT_API_SECRET` existan.
2. Verificar base/paths exactos de token y eventos.
3. Confirmar que el token se recibe en `data.accessToken`.
4. Revisar si la fecha consultada tiene eventos reales.
5. Revisar eventos omitidos por campos faltantes.
6. Revisar mapeo RRHH (DNI cargado y consistente).

## Nota de seguridad

- No exponer API Key/Secret en cliente.
- Mantener consumo Hikvision solo del lado servidor.
- Rotar credenciales si alguna key fue compartida por chat o logs.
