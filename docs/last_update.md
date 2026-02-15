# Evidencia de Actualizacion
**Fecha y Hora:** 13 de febrero de 2026 - 06:38

## Archivos Modificados
- `hikvision.md`
- `docs/CHANGELOG.md`
- `docs/last_update.md`

## Resumen del Cambio
Se actualizo la documentacion de RRHH Horarios para aclarar que las marcaciones se consultan por API de Hikvision (Hik-Connect), que el estado "No mapeado" depende del mapeo `employeeNo`/`personCode` contra RRHH, y que se recomienda un campo dedicado `hik_person_code` para un vinculo estable sin usar `dni` como identificador externo.

## Nota Operativa
No se aplicaron cambios de codigo ni migraciones en esta tarea; solo documentacion.
