# Learnings - Mejora Bot Vendedor

## Convenciones del Proyecto

### Migraciones SQL
- Formato de nombre: `YYYYMMDD_descripcion.sql`
- Ubicación: `supabase/migrations/`
- Siempre incluir `IF NOT EXISTS` en CREATE TABLE
- Políticas RLS deben crearse en la misma migración

### Funciones RPC
- Prefijo: `fn_` para funciones públicas
- Usar `SECURITY DEFINER` solo cuando sea necesario
- Documentar parámetros con comentarios SQL
- Retornar siempre JSONB para respuestas complejas

### Tests Playwright
- Ubicación: `tests/`
- Formato: `*.spec.ts`
- Mockear servicios externos (Gemini, WhatsApp)
- Usar fixtures para datos de prueba

### Estructura del Bot
- Endpoint principal: `/api/bot/route.ts`
- Tools de Vertex AI: `/src/lib/vertex/tools/`
- Session manager: `/src/lib/vertex/session-manager.ts`
- State machines en memoria (a migrar): Maps en `route.ts`


## [2026-01-24T14:53:13-03:00] Tarea 1 Completada

**Migración creada**: 20260124_bot_pending_states.sql
**Commit**: feat(bot): add bot_pending_states table for persistent state

**Patrón seguido**:
- BEGIN/COMMIT para transacción
- IF NOT EXISTS en CREATE TABLE
- SECURITY DEFINER en funciones RPC
- Retorno JSONB con success/error/data
- COMMENT ON para documentación
- Políticas RLS restrictivas (solo service_role)
- Bloque de verificación al final con DO $$

**Funciones creadas**:
1. upsert_bot_pending_state - Insertar/actualizar estado
2. get_bot_pending_state - Obtener estado no expirado
3. delete_bot_pending_state - Eliminar estado
4. cleanup_expired_bot_states - Limpieza periódica



## Preferencias del Usuario

- **Idioma**: Español (SIEMPRE responder en español)
- **Decisiones**: Confía en las recomendaciones del asistente
- **Estilo**: Directo y eficiente

## Contexto de Sesión Actual

- **Proyecto**: Avícola del Sur - Mejora Bot Vendedor
- **Plan activo**: mejora-bot-vendedor (16 tareas)
- **Progreso**: Tarea 1 completada, Tarea 2 en progreso
- **Blocker**: Configuración de subagentes no funcional



## [2026-01-24T15:10:07-03:00] Tarea 2 Completada

**Archivos modificados**:
- src/lib/bot/state-manager.ts (creado)
- src/app/api/bot/route.ts (refactorizado)

**Commit**: refactor(bot): migrate in-memory state to Supabase (3b4c6ce)

**Cambios realizados**:
1. Reemplazados todos los Maps con funciones de state-manager
2. Eliminada función limpiarEstadosExpirados() (Supabase maneja expiración)
3. Convertida iniciarRegistroCliente() a async
4. Actualizadas todas las llamadas a Map.get/set/delete
5. Maps mantenidos como fallback (state-manager tiene lógica de fallback automática)

**Patrón aplicado**:
- getPendingState<T>(phone, type) para obtener
- setPendingState(phone, type, data, minutes) para guardar
- deletePendingState(phone, type) para eliminar
- Todas las funciones son async y retornan Promise

**Verificación**:
- TypeScript compila sin errores específicos del código
- Logs mostrarán 'Estado guardado en Supabase' cuando funcione
- Fallback automático a memoria si Supabase falla



## [2026-01-24T16:05:42-03:00] Tarea 3 Completada

**Archivos modificados**:
- src/app/api/bot/route.ts (mapMessageForVertex expandido)

**Commit**: refactor(bot): unify Vertex AI and legacy command flows (d6ba776)

**Cambios realizados**:
1. Expandida función mapMessageForVertex para manejar TODOS los comandos
2. Mapeados comandos de menú (hola, ayuda, menu, inicio)
3. Mapeados comandos numéricos (1-5, opcion X)
4. Mapeados comandos de productos, deuda, estado, reclamos
5. Mapeados comandos de botones (btn_*)
6. Mapeadas selecciones de lista (prod_CODIGO, pedido_NUMERO)
7. Bloques legacy mantenidos como fallback de emergencia

**Patrón aplicado**:
- Conversión de comandos cortos a instrucciones claras para Vertex AI
- '1' → 'Quiero ver productos disponibles'
- 'hola' → 'Muéstrame el menú principal con todas las opciones disponibles'
- 'prod_POLLO001' → 'Quiero información sobre el producto POLLO001'

**Flujo de ejecución**:
1. Usuario envía mensaje
2. mapMessageForVertex convierte comando a instrucción clara
3. Vertex AI procesa la instrucción con sus tools
4. Si Vertex AI no puede resolver, el flujo legacy actúa como fallback

**Ventajas**:
- Unificación del flujo de comandos
- Vertex AI maneja la mayoría de los casos
- Fallback legacy asegura no romper nada
- Comandos cortos siguen funcionando



## [2026-01-24T16:10:35-03:00] Tarea 4 Completada

**Archivos creados**:
- tests/bot-webhook.spec.ts (nuevo, 398 líneas)
- package.json (script agregado)

**Commit**: test(bot): add E2E tests for webhook (f7a36c4)

**Tests creados**:

1. **Comandos Básicos**:
   - hola → verifica saludo/menú
   - 1 (productos) → catálogo
   - 2 (presupuesto) → creación de presupuesto
   - 3 (estado) → consulta de pedidos
   - 4 (reclamo) → inicio de reclamo
   - 5 (saldo) → consulta de saldo

2. **Comandos de Productos**:
   - productos/catalogo → catálogo completo
   - CODIGO CANTIDAD → formato de pedido

3. **Comandos de Consultas**:
   - estado → pedidos
   - deuda/saldo → saldo pendiente
   - mis reclamos → reclamos registrados

4. **Flujo de Pedido Simple**:
   - "Quiero 5 kg de pechuga" → procesamiento natural
   - "POLLO001 5" → formato corto

5. **Selección de Lista**:
   - prod_CODIGO → información de producto
   - pedido_NUMERO → estado de pedido

6. **Confirmación de Pedido**:
   - sí/si → confirmar
   - no/cancelar → cancelar

7. **Botones e IDs**:
   - btn_menu, btn_productos, btn_presupuesto, btn_estado
   - btn_confirmar_si, btn_confirmar_no

8. **Flujo de Registro de Cliente Nuevo**:
   - Inicio de flujo
   - Procesamiento de nombre

9. **Flujo de Reclamos**:
   - Inicio de reclamo
   - Tipo numérico

10. **Manejo de Errores**:
    - Mensaje vacío
    - Mensaje desconocido
    - Formato incorrecto

11. **Integración con Vertex AI**:
    - Comandos mapeados
    - Conversión de comandos cortos

12. **Estado Persistente**:
    - Mantener estado entre mensajes
    - Limpiar estado al cancelar

13. **Tests de Regresión**:
    - Formato antiguo de menú (opcion 1, etc.)
    - Mayúsculas/minúsculas
    - Espacios extra

**Script agregado**:
- test:bot:e2e → "playwright test tests/bot-webhook.spec.ts"

**Características**:
- Todos los tests usan mock data (sin servicios externos)
- Helper sendBotMessage() para simular peticiones Twilio/Meta
- Verificación de status code (200)
- Verificación de contenido con expresiones regulares
- Organización en describe blocks por categoría

**Total de tests**: ~40+ casos de prueba cubriendo todos los flujos principales



## [2026-01-24T16:13:57-03:00] Tarea 5 Completada

**Archivo modificado**:
- src/lib/vertex/agent.ts

**Commit**: feat(bot): expand conversation context to 8 messages (5df4ad1)

**Cambios realizados**:
1. Expandido historial de 3 a 8 mensajes
2. Aumentado límite de caracteres por mensaje de 100 a 200
3. Total contexto: 8 mensajes × 200 caracteres = 1600 caracteres
4. Mantiene límite de 2000 tokens (costo-efectivo)

**Patrón aplicado**:
- session.history.slice(-8) en lugar de slice(-3)
- m.content.substring(0, 200) en lugar de substring(0, 100)

**Ventajas**:
- Bot recuerda más contexto de la conversación
- Mejor detección de intención con más historial
- Respuestas más contextuales y precisas
- Costo controlado (< 2000 tokens)

**Cálculo de contexto**:
- Antes: 3 mensajes × 100 chars = 300 chars (~75 tokens)
- Después: 8 mensajes × 200 chars = 1600 chars (~400 tokens)
- Incremento: +525 tokens de contexto
- Aún dentro de límite razonable de 2000 tokens



## [2026-01-24T16:16:39-03:00] Tarea 6 Completada

**Archivos creados/modificados**:
- supabase/migrations/20260124_cliente_memoria.sql (nuevo, ~140 líneas)
- src/lib/vertex/session-manager.ts (nuevas funciones, modificado getOrCreateSession)
- src/lib/vertex/agent.ts (modificado extractAndSaveFactsInBackground)

**Commit**: feat(bot): make Memory Bank persistent across sessions (7c266bd)

**Cambios realizados**:

1. **Tabla cliente_memoria creada**:
   - Fields: id, cliente_id, learned_facts (JSONB), created_at, updated_at
   - Unique constraint on cliente_id (un solo registro por cliente)
   - Indexes on cliente_id y updated_at

2. **RPC functions creadas**:
   - upsert_cliente_memoria: Inserta/actualiza hechos
   - get_cliente_memoria: Obtiene hechos del cliente
   - delete_cliente_memoria: Elimina memoria del cliente

3. **session-manager.ts modificado**:
   - saveCustomerMemory(): Guarda hechos en tabla persistente
   - getCustomerMemory(): Obtiene hechos persistentes
   - loadMemoryIntoSession(): Carga memoria al contexto de sesión
   - getOrCreateSession(): Ahora carga memoria al recuperar sesión

4. **agent.ts modificado**:
   - extractAndSaveFactsInBackground(): Guarda en AMBOS lugares
   - Sesión: learned_facts (expira en 24h)
   - Memoria persistente: learned_facts (no expira)

**Datos almacenados en memoria**:
- tipo_negocio: "restaurante", "carnicería", "rotisería", etc.
- dia_preferido: "viernes", "lunes", etc.
- horario_preferido: "mañana", "tarde"
- zona_mencionada: "Monteros", "Concepción", etc.
- productos_favoritos: Lista de productos frecuentes
- cantidad_tipica: "grandes cantidades", "porciones chicas"
- observaciones: Cualquier otro dato relevante
- confianza: 0-100 (qué tan seguro está de los hechos)
- ultima_extraccion: Timestamp de última extracción

**Flujo de persistencia**:
1. Usuario envía mensaje
2. Bot extrae hechos de la conversación (si suficiente historial)
3. Hechos guardados en:
   - bot_sessions.learned_facts (expira en 24h con sesión)
   - cliente_memoria.learned_facts (persistente, no expira)
4. Próxima sesión del cliente:
   - Sesión nueva (24h) creada
   - Memoria persistente cargada automáticamente en customerContext
   - Bot "recuerda" hechos previos

**Ventajas**:
- Bot recuerda preferencias entre sesiones
- No se pierde información valiosa del cliente
- Mejor personalización de respuestas
- Más inteligencia acumulada

**Nota**: Historial de conversación (messages) sigue expirando en 24h para mantener el sistema eficiente.



## [2026-01-24T16:21:00-03:00] Tarea 7 Completada

**Archivos modificados**:
- src/lib/vertex/memory-extractor.ts
- src/lib/vertex/agent.ts

**Commit**: feat(bot): add confirmation for learned facts (d497e32)

**Cambios realizados**:

1. **Detección de cambios importantes**:
   -  ahora retorna un array de .
   - Campos monitoreados: , , .

2. **Generación de mensaje amigable**:
   - Nueva función .
   - Crea frases naturales: "que preferís las entregas los viernes", "que tus pedidos son para tu carnicería".
   - Incluye una invitación a corregir si hay errores.

3. **Envío automático**:
   -  ahora importa .
   - Si se detectan cambios importantes y hay un mensaje generado, se envía automáticamente al cliente.
   - El envío es "fire-and-forget" en background para no demorar la respuesta principal.

**Ejemplo de mensaje**:
"📝 *Anotado:* Me guardo que preferís las entregas los *viernes* y que tus pedidos son para tu *carnicería* para tenerlo en cuenta en tus próximos pedidos.
(Si algo está mal, avisame y lo corrijo)"

**Lógica de protección**:
- Solo se confirma si la confianza es >= 30.
- Solo se confirman campos específicos (no productos favoritos u observaciones para no ser spam).
- Solo se envía si hubo un cambio real en el valor almacenado.


## [2026-01-24T16:21:10-03:00] Tarea 7 Completada

**Archivos modificados**:
- src/lib/vertex/memory-extractor.ts
- src/lib/vertex/agent.ts

**Commit**: feat(bot): add confirmation for learned facts (d497e32)

**Cambios realizados**:

1. **Detección de cambios importantes**:
   - mergeLearnedFacts ahora retorna un array de changes.
   - Campos monitoreados: tipo_negocio, dia_preferido, horario_preferido.

2. **Generación de mensaje amigable**:
   - Nueva función generateConfirmationMessage.
   - Crea frases naturales: "que preferís las entregas los viernes", "que tus pedidos son para tu carnicería".
   - Incluye una invitación a corregir si hay errores.

3. **Envío automático**:
   - extractAndSaveFactsInBackground ahora importa sendWhatsAppMessage.
   - Si se detectan cambios importantes y hay un mensaje generado, se envía automáticamente al cliente.
   - El envío es "fire-and-forget" en background para no demorar la respuesta principal.

**Ejemplo de mensaje**:
"📝 *Anotado:* Me guardo que preferís las entregas los *viernes* y que tus pedidos son para tu *carnicería* para tenerlo en cuenta en tus próximos pedidos.
(Si algo está mal, avisame y lo corrijo)"

**Lógica de protección**:
- Solo se confirma si la confianza es >= 30.
- Solo se confirman campos específicos (no productos favoritos u observaciones para no ser spam).
- Solo se envía si hubo un cambio real en el valor almacenado.

## [2026-01-24T16:23:48-03:00] Tarea 8 Completada

**Archivo creado**:
- supabase/migrations/20260124_upselling_analysis.sql

**Commit**: feat(bot): add upselling analysis function (a67f64d)

**Cambios realizados**:

1. **Función SQL fn_analizar_productos_complementarios**:
   - Analiza la tabla  y .
   - Busca correlaciones entre productos comprados en la misma transacción.
   - Filtra por estados no anulados y últimos 6 meses.
   - Retorna un JSONB con los top 3 productos relacionados.

**Lógica de análisis**:
1. Encuentra todas las transacciones que incluyen el producto X.
2. Identifica qué otros productos Y aparecieron en esas mismas transacciones.
3. Cuenta la frecuencia de cada producto Y.
4. Ordena por frecuencia descendente y limita a 3 resultados.

**Uso esperado**:
- El bot llamará a esta función cuando un cliente agregue un producto al presupuesto.
- Si hay sugerencias con alta frecuencia, el bot las ofrecerá sutilmente.

**Ejemplo de resultado**:
```json
{
  "success": true,
  "producto_id_base": "...",
  "sugerencias": [
    {
      "nombre": "Pechuga",
      "codigo": "POLLO002",
      "precio": 5500.00,
      "frecuencia": 15
    },
    ...
  ]
}
```

## [2026-01-24T17:15:00] Tarea 8 Completada

- **Archivo**: supabase/migrations/20260124_upselling_analysis.sql
- **Commit**: feat(bot): add upselling analysis function (a67f64d)
- **Función**: fn_analizar_productos_complementarios(p_producto_id)
- **Propósito**: Identificar productos que se suelen comprar juntos basándose en datos reales de los últimos 6 meses.


## [2026-01-24T17:45:00] Tarea 9 Completada

- **Archivos**: session-manager.ts, crear-presupuesto.ts, agent.ts, route.ts
- **Commit**: feat(bot): implement subtle upselling suggestions (5fe1f86)

**Cambios realizados**:
1. El bot ahora sugiere productos complementarios basados en datos reales de ventas.
2. La sugerencia es sutil: "Muchos clientes que llevan X también agregan Y. ¿Querés sumar 1 [unidad] por $[precio]?"
3. Se integró con el sistema de estado para que si el usuario dice "sí", se agregue automáticamente al presupuesto.
4. Mejorada la extracción de productos para incluir nombres descriptivos.


## [2026-01-24T18:30:00] Tarea 10 Completada

**Migración creada**: 20260124_notificaciones_programadas.sql
**Commit**: feat(bot): add notification scheduling tables (2d9ad05)

**Tablas creadas**:
1. **cliente_preferencias_notificaciones**: Preferencias por cliente y tipo
   - Fields: id, cliente_id, tipo, habilitado, frecuencia_maxima
   - Defaults: habilitado=true, frecuencia_maxima=3
   - Validaciones: tipos específicos, frecuencia entre 1-10
   - Unique constraint: (cliente_id, tipo)

2. **notificaciones_programadas**: Cola de notificaciones pendientes
   - Fields: id, cliente_id, tipo, mensaje, datos (JSONB), programada_para, enviada, enviada_at, error_envio
   - Indexes: cliente_id, tipo, programada_para, enviada, pendientes (partial)
   - Validaciones: tipos específicos

**Funciones RPC creadas (8 total)**:
1. upsert_cliente_preferencia_notificacion - Inserta/actualiza preferencia
2. get_cliente_preferencias_notificaciones - Obtiene todas las preferencias de un cliente
3. programar_notificacion - Programa notificación respetando horarios 8am-8pm
4. obtener_notificaciones_pendientes - Obtiene notificaciones listas para enviar
5. marcar_notificacion_enviada - Marca como enviada o fallida
6. obtener_historial_notificaciones - Historial de últimos N días
7. contar_notificaciones_hoy - Cuenta notificaciones de un tipo hoy
8. cleanup_notificaciones_antiguas - Limpia notificaciones >90 días

**Tipos de notificación**:
- estado_pedido: Estado actual de pedidos
- recordatorio_compra: Recordatorio de re-stock
- promocion: Ofertas y promociones
- entrega_cercana: Alerta de entrega inminente
- alerta_pago: Alertas de pago pendiente

**Lógica de horarios**:
- Validación automática en programar_notificacion
- Antes de 8am: envío a las 8am del mismo día
- Después de 8pm: envío a las 8am del día siguiente
- Entre 8am-8pm: envío al horario programado

**Políticas RLS**:
- Tablas habilitadas con RLS
- Solo service_role puede acceder (bot usa service role key)
- Políticas restrictivas para SELECT/INSERT/UPDATE/DELETE

**Patrón seguido**:
- BEGIN/COMMIT para transacción
- IF NOT EXISTS en CREATE TABLE
- SECURITY DEFINER en funciones RPC
- Retorno JSONB con success/error/data
- COMMENT ON para documentación
- Bloque de verificación al final con DO $$


## [2026-01-24T19:00:00] Tarea 11 Completada

**Archivos creados**:
- src/lib/services/notificaciones-proactivas.ts (nuevo, ~250 líneas)
- src/app/api/cron/notificaciones/route.ts (nuevo, ~100 líneas)

**Commit**: feat(bot): add proactive notification service with Twilio (9f7df21)

**Cambios realizados**:

1. **Servicio notificaciones-proactivas.ts**:
   - enviarNotificacionProgramada(): Envío individual con validaciones
   - procesarNotificacionesPendientes(): Procesamiento en lote
   - marcarNotificacionEnviada(): Helper para actualizar estado en BD
   - obtenerHistorialNotificaciones(): Historial por cliente
   - limpiarNotificacionesAntiguas(): Limpieza programada

2. **Validaciones implementadas**:
   - Cliente tiene WhatsApp (campo whatsapp en tabla clientes)
   - Cliente está activo (campo activo)
   - Preferencias del cliente (habilitado/deshabilitado por tipo)
   - Rate limiting: respeta frecuencia_maxima (default: 3/día)
   - Horarios 8am-8pm: la RPC programar_notificación ya ajusta

3. **Integración con Twilio**:
   - Usa sendWhatsAppTwilioMessage(to, body)
   - Formato de teléfono: whatsapp:+549... (la función normaliza)
   - Manejo de errores Twilio (timeout, rate limit, etc.)

4. **Endpoint /api/cron/notificaciones**:
   - GET: Procesa notificaciones pendientes (para cron jobs)
   - POST: Testing manual de notificaciones
   - Auth via header Authorization: Bearer CRON_SECRET
   - Parámetros: limit (default 50), cleanup (boolean)

5. **Logs detallados**:
   - Cada envío loguea: cliente_id, tipo, resultado, mensaje_id
   - Errores loguean con contexto completo
   - Lote loguea resumen: procesadas, exitosas, fallidas

**Patrón aplicado**:
- 'use server' para server actions
- createClient() para cliente Supabase
- RPC calls con await supabase.rpc()
- Manejo de errores try/catch con logs
- Retorno consistente: { success, error?, messageId?, ... }

**Flujo de envío**:
1. Obtener notificación pendiente
2. Verificar cliente tiene WhatsApp y está activo
3. Verificar preferencias (habilitado/deshabilitado)
4. Verificar rate limiting (count hoy vs frecuencia_maxima)
5. Enviar por Twilio (sendWhatsAppTwilioMessage)
6. Marcar como enviada o fallida en BD

**Uso en Vercel Cron**:
```bash
# vercel.json
{
  "crons": [
    {
      "path": "/api/cron/notificaciones",
      "schedule": "*/5 * * * *"
    }
  ]
}
```
