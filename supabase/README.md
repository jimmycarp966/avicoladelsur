# Supabase

Actualizado: 2026-03-27

La carpeta `supabase/` contiene la evolucion real de la base de datos del proyecto. Ya no debe interpretarse como un set chico de scripts iniciales: aqui viven migraciones historicas, fixes operativos, diagnosticos y utilidades de mantenimiento.

## 1. Fuente de verdad

La fuente principal del modelo es:

- `supabase/migrations/`

Si una tabla, funcion o politica aparece en el runtime y no en una guia vieja, mirar primero las migraciones recientes.

## 2. Contenido del directorio

| Ruta | Proposito |
| --- | --- |
| `supabase/migrations/` | migraciones versionadas |
| `supabase/scripts/` | utilidades SQL puntuales |
| `supabase/database-schema.sql` | snapshot grande heredado, util como referencia historica |
| `supabase/setup-complete.sql` y fixes varios | scripts legacy / soporte |
| `supabase/regenerate-types.sql` | regeneracion de tipos |
| `supabase/README.md` | esta guia |

## 3. Recomendacion operativa

Preferir siempre un flujo guiado por migraciones y no por copiar SQL suelto en produccion.

Orden recomendado:

1. revisar migraciones pendientes
2. validar si el cambio ya existe en `supabase/migrations`
3. aplicar migraciones con CLI o proceso controlado
4. regenerar tipos si hace falta
5. actualizar documentacion si el cambio es funcional

## 4. Areas con mas movimiento reciente

### RRHH

Las migraciones mas activas recientes tocaron:

- adelantos con planes y cuotas
- legajo y descansos mensuales
- reglas de liquidacion por periodo y puesto
- tramos por puesto
- feriados
- licencias con storage privado
- reglas `lun_sab`, extras y suspensiones

### Reparto / ventas / notificaciones

Tambien hubo cambios recientes en:

- flujo presupuesto -> pesaje -> entrega
- semantica de estados del repartidor
- cron de notificaciones movido a Supabase

## 5. Scripts legacy

El directorio todavia conserva scripts SQL y fixes heredados. Usarlos solo cuando:

- se entiende exactamente el impacto
- no existe una migracion versionada equivalente
- el cambio es para diagnostico o soporte puntual

No asumir que `database-schema.sql` o `setup-complete.sql` representan el estado actual completo del proyecto.

## 6. Tipos y drift

`src/types/database.types.ts` fue reconciliado manualmente el 2026-03-27 usando migraciones y consultas reales del runtime. Mientras no se regenere desde Supabase cloud, tomarlo como snapshot util pero no como fuente absoluta. Cuando haya dudas:

1. mirar `supabase/migrations`
2. mirar consultas reales en `src/actions` y `src/app/api`
3. revisar especialmente RRHH asistencia/Hik, porque hay campos usados por runtime que no se ven claramente en migraciones versionadas
4. regenerar tipos si el cambio lo requiere

## 7. Documentos relacionados

- `README.md`
- `ARCHITECTURE.MD`
- `RRHH_README.md`
- `docs/FLUJO_PRESUPUESTOS_PEDIDOS_RUTAS.md`
