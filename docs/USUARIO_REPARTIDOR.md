# Usuario Repartidor

## Acceso

El acceso operativo del repartidor arranca en:

- `/home`
- `/checkin`
- `/ruta-diaria`
- `/ruta/[ruta_id]`
- `/entregas`
- `/perfil`

## Flujo Diario

1. `/home` muestra la ruta activa del día y los accesos rápidos.
1. `/checkin` es el gate real: acá se completa el checklist de inicio.
1. `/ruta-diaria` lista las rutas asignadas para hoy.
1. `/ruta/[ruta_id]` es la hoja de ruta operativa.
1. `/entregas` concentra el listado de entregas y cobros.
1. `/perfil` muestra datos de usuario y sesión.

## Qué Hace Cada Pantalla

- `/home`: resumen de la ruta activa, estado general y CTA contextual.
- `/checkin`: checklist de inicio. Si la ruta está lista, abre la hoja de ruta.
- `/ruta-diaria`: listado de rutas con acciones claras para abrir ruta o completar check-in.
- `/ruta/[ruta_id]`: hoja de ruta. La vista principal arranca en lista y el mapa queda como vista secundaria.
- `/entregas`: detalle operativo de las entregas del día.
- `/perfil`: información personal y sesión.

## GPS

- El GPS auto-arranca cuando la ruta está en `en_curso`.
- Si no hay conexión, las ubicaciones se guardan en una cola local mínima y se reintentan cuando vuelve la red.
- No hay offline completo para firma o cobros: solo retry local de ubicaciones.

## Estados de Pago

Estados canónicos que debe mostrar la UI:

- `pagado`
- `pagara_despues`
- `parcial`
- `cuenta_corriente`
- `rechazado`

Alias legacy aceptado solo por compatibilidad:

- `pendiente` -> `pagara_despues`

## Notas

- `/inicio` sigue siendo una rama secundaria de caja/transferencias y no forma parte del nav principal.
- No documentar URLs legacy como `/repartidor/*`.
- No documentar el flujo actual con endpoints legacy como `/api/entregas/*`.
