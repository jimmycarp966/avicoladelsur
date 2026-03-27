# Flujo presupuestos -> pedidos -> rutas

Actualizado: 2026-03-27

Este documento describe el flujo operativo vigente entre ventas, almacen y reparto.

## 1. Entradas al flujo

El flujo puede comenzar desde:

- backoffice de ventas (`/ventas/presupuestos/nuevo`)
- bot de WhatsApp (`/api/bot`)
- catalogo publico integrado a WhatsApp (`/catalogo`)

## 2. Presupuesto

Rutas y piezas principales:

- `/ventas/presupuestos`
- `/ventas/presupuestos/nuevo`
- `/ventas/presupuestos/[id]`
- `/ventas/presupuestos/[id]/editar`
- `/api/ventas/presupuestos/crear`
- `/api/ventas/presupuestos/listar`
- `/api/ventas/presupuestos/[id]`
- `/api/ventas/presupuestos/enviar-almacen`
- `src/actions/presupuestos.actions.ts`

Notas:

- el presupuesto puede nacer desde web o bot
- el flujo actual convive con procesos automaticos y acciones manuales
- la transicion a almacen y la conversion a pedido ya no deben documentarse como simples scripts SQL aislados

## 3. Almacen y pesaje

Rutas principales:

- `/almacen/presupuestos-dia`
- `/almacen/presupuesto/[id]/pesaje`
- `/almacen/en-preparacion`
- `/almacen/pedidos`
- `/almacen/pedidos/[id]`

APIs y acciones relevantes:

- `/api/almacen/presupuesto/pesaje`
- `/api/almacen/analizar-peso`
- `/api/almacen/presupuesto/finalizar`
- `/api/almacen/presupuesto/convertir-pedido`
- `src/actions/pesajes.actions.ts`
- `src/actions/presupuestos-dia.actions.ts`
- `src/actions/en-preparacion.actions.ts`

Notas:

- existe soporte para productos pesables y analisis de anomalias
- `POST /api/almacen/analizar-peso` sigue siendo un endpoint legacy y no usa aun el contrato moderno de metadata IA

## 4. Pedido

Una vez convertido, el flujo sigue en:

- `/almacen/pedidos`
- `/almacen/pedidos/[id]`
- `/api/almacen/presupuesto/convertir-pedido`
- `/api/pedidos/[id]/pdf`

El pedido puede terminar en reparto o en otros subflujos operativos, segun el caso.

## 5. Ruta y reparto

Rutas principales:

- `/reparto/planificacion`
- `/reparto/planificacion/semana`
- `/reparto/planificacion/historial`
- `/reparto/rutas`
- `/reparto/rutas/nueva`
- `/reparto/rutas/[id]`
- `/reparto/rutas/[id]/optimizar`
- `/reparto/monitor`

PWA del repartidor:

- `/ruta-diaria`
- `/ruta/[ruta_id]`
- `/ruta/[ruta_id]/mapa`
- `/ruta/[ruta_id]/entrega/[entrega_id]`
- `/entregas`

APIs relevantes:

- `/api/reparto/pedidos/[pedidoId]/asignar-ruta`
- `/api/reparto/rutas-planificadas`
- `/api/reparto/rutas-activas`
- `/api/reparto/ubicacion`
- `/api/reparto/ubicaciones`
- `/api/reparto/ubicacion-actual`
- `/api/reparto/entrega`
- `/api/reparto/devolucion`
- `/api/reparto/devoluciones`
- `/api/reparto/alertas`
- `/api/rutas/generar`
- `/api/rutas/alternativas`
- `/api/rutas/optimize-advanced`

## 6. Orden real del motor de optimizacion

Flujo base de optimizacion:

1. OpenRouteService
2. Google Directions
3. optimizador local

Flujo avanzado:

1. Google Cloud Optimization API
2. Google Fleet Routing
3. flujo base ORS -> Google -> local

No documentar Fleet Routing o Cloud Optimization como obligatorios para operar el sistema base.

## 7. Seguimiento y estados

El monitor, la PWA y varios endpoints de reparto dependen de:

- asignacion de ruta
- orden de visita
- ETAs estimados
- tracking GPS
- cierre de ruta
- cobros y validaciones posteriores

El cierre del flujo no termina en reparto: suele continuar en tesoreria con validacion de cobros y movimientos.

## 8. Documentos relacionados

- `README.md`
- `ARCHITECTURE.MD`
- `docs/USUARIO_REPARTIDOR.md`
- `docs/IA_CAPABILITIES.md`
