# Mejora Bot Vendedor y Resolución de Problemas al 100%

## Context

### Original Request
Mejorar al 100% el sistema de Bot (vendedor y resolución de problemas) de Avícola del Sur.

### Interview Summary
**Key Discussions**:
- **Problemas actuales**: Errores técnicos (estado en memoria volátil), no entiende bien mensajes (contexto limitado), falta personalización (Memory Bank expira)
- **Nuevas funcionalidades**: Upselling sutil, notificaciones proactivas, dashboard de métricas
- **Prioridad**: Resolver bugs técnicos primero, luego mejorar

**Research Findings**:
- Estado del bot usa Maps en memoria (`registroClientesPendientes`, `reclamosPendientes`, `pendingConfirmations`) que se pierden en Vercel serverless
- Contexto conversacional limitado a 3 mensajes × 100 chars
- Memory Bank en `bot_sessions` expira a las 24h
- Arquitectura dual: Vertex AI Agent + flujo hardcodeado legacy (puede causar inconsistencias)
- Tests Playwright existentes pero NO cubren webhook del bot

### Metis Review
**Identified Gaps** (addressed):
- Necesidad de crear tabla `bot_pending_states` para estado persistente
- Unificar flujos Vertex AI y legacy
- Definir criterios de aceptación específicos por fase
- Implementar tests de regresión antes de modificar flujos
- Agregar opt-out para notificaciones proactivas

---

## Work Objectives

### Core Objective
Estabilizar el bot eliminando pérdida de estado en Vercel, mejorar comprensión de mensajes expandiendo contexto, agregar upselling sutil, sistema de notificaciones proactivas y dashboard de métricas.

### Concrete Deliverables
1. Tabla Supabase `bot_pending_states` para estado persistente
2. Contexto conversacional expandido a 8 mensajes
3. Memory Bank persistente (no expira)
4. Sistema de upselling sutil integrado en flujo de pedidos
5. Sistema de notificaciones proactivas con 5 tipos
6. Dashboard de métricas del bot en `/reportes/bot`
7. Tests Playwright para webhook del bot

### Definition of Done
- [ ] `npm run test:bot:e2e` pasa sin errores
- [ ] Bot responde correctamente después de reinicio de Vercel
- [ ] Métricas visibles en dashboard para admin

### Must Have
- Estado persistente en Supabase (NO en memoria)
- Contexto de al menos 8 mensajes en detección de intención
- Tests de regresión antes de cada cambio

### Must NOT Have (Guardrails)
- NO modificar el flujo de presupuestos/pedidos existente (funciona)
- NO cambiar modelo Gemini (Flash → Pro) sin validar costos
- NO enviar notificaciones sin opt-out del cliente
- NO más de 3 notificaciones proactivas por día por cliente
- NO tocar funciones RPC de Supabase que no sean del bot

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (TDD donde sea posible)
- **Framework**: Playwright para E2E

### Test Approach
Cada FASE incluirá tests Playwright que validen los flujos modificados antes de pasar a la siguiente.

---

## Task Flow

```
FASE 1A (Estado) → FASE 1B (Unificar flujos) → FASE 2 (NLU)
                                                    ↓
FASE 3 (Upselling) ←──────────────────────────────────┘
     ↓
FASE 4 (Notificaciones) → FASE 5 (Dashboard)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1, 2 | FASE 1A y 1B son secuenciales (1B depende de 1A) |
| B | 4, 5 | Upselling y mejoras de personalización son independientes |
| C | 8, 9 | Notificaciones: BD y servicio son independientes |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Unificar flujos requiere estado persistente primero |
| 3 | 2 | Tests E2E validan cambios de FASE 1 |
| 4, 5 | 3 | FASE 2 requiere FASE 1 estable |
| 6, 7 | 5 | Upselling usa NLU mejorado |
| 8, 9, 10 | 3 | Notificaciones pueden iniciar tras FASE 1 |
| 11, 12 | 10 | Dashboard requiere datos de notificaciones |

---

## TODOs

### FASE 1A: Estabilización - Estado Persistente

- [x] 1. Crear tabla `bot_pending_states` en Supabase

  **What to do**:
  - Crear migración SQL con tabla para almacenar estados de flujos pendientes
  - Campos: `id`, `phone_number`, `state_type` (registro|reclamo|confirmacion), `state_data` (JSONB), `created_at`, `expires_at`
  - Índice único en `(phone_number, state_type)`
  - Crear funciones RPC: `upsert_bot_pending_state`, `get_bot_pending_state`, `delete_bot_pending_state`

  **Must NOT do**:
  - NO modificar tabla `bot_sessions` existente (separar concerns)

  **Parallelizable**: NO (es el primer task)

  **References**:
  - `src/lib/vertex/session-manager.ts` - Patrón de funciones RPC para sesiones
  - `src/app/api/bot/route.ts:266-280` - Definición de interfaces `RegistroClienteEstado` y `ReclamoEstado`
  - `supabase/migrations/` - Convención de nombres de migraciones

  **Acceptance Criteria**:
  - [ ] Migración aplicada: `supabase migration up` sin errores
  - [ ] Tabla existe: `SELECT * FROM bot_pending_states LIMIT 1` no da error
  - [ ] RPC funciona: Ejecutar `SELECT upsert_bot_pending_state(...)` exitosamente

  **Commit**: YES
  - Message: `feat(bot): add bot_pending_states table for persistent state`
  - Files: `supabase/migrations/YYYYMMDD_bot_pending_states.sql`

---

- [x] 2. Migrar Maps en memoria a Supabase

  **What to do**:
  - Crear `src/lib/bot/state-manager.ts` con funciones para manejar estado persistente
  - Implementar `getPendingState(phone, type)`, `setPendingState(phone, type, data)`, `deletePendingState(phone, type)`
  - Modificar `route.ts` para usar nuevo state-manager en lugar de Maps
  - Mantener Maps como fallback si Supabase falla (con warning log)
  - Eliminar función `limpiarEstadosExpirados()` (ya no necesaria con expires_at en BD)

  **Must NOT do**:
  - NO eliminar los Maps inmediatamente (mantener como fallback temporal)
  - NO modificar la lógica de negocio de los flujos (solo el almacenamiento)

  **Parallelizable**: NO (depende de task 1)

  **References**:
  - `src/app/api/bot/route.ts:266-298` - Maps actuales y función de limpieza
  - `src/app/api/bot/route.ts:353-598` - Funciones `procesarRegistroCliente` y `procesarReclamo` que usan los Maps
  - `src/lib/vertex/session-manager.ts` - Patrón de manejo de sesiones con Supabase

  **Acceptance Criteria**:
  - [ ] Archivo existe: `src/lib/bot/state-manager.ts`
  - [ ] Logs muestran: "Estado guardado en Supabase" (no en memoria)
  - [ ] Reiniciar servidor y continuar flujo de registro funciona

  **Commit**: YES
  - Message: `refactor(bot): migrate in-memory state to Supabase`
  - Files: `src/lib/bot/state-manager.ts`, `src/app/api/bot/route.ts`

---

### FASE 1B: Estabilización - Unificar Flujos

- [x] 3. Unificar flujo Vertex AI y legacy

  **What to do**:
  - Mover TODA la lógica de comandos al flujo de Vertex AI
  - Eliminar bloques `else if (bodyLower.includes('hola'))` y similares
  - Actualizar `mapMessageForVertex` para manejar todos los casos
  - El flujo legacy solo debe quedar como fallback de emergencia

  **Must NOT do**:
  - NO eliminar completamente el fallback (mantener para casos extremos)
  - NO cambiar las respuestas del bot (solo unificar el flujo)

  **Parallelizable**: NO (depende de task 2)

  **References**:
  - `src/app/api/bot/route.ts:1170-1188` - Función `mapMessageForVertex`
  - `src/app/api/bot/route.ts:1448-1484` - Bloques hardcodeados para "hola", "menu", etc.
  - `src/lib/vertex/agent.ts:100-323` - Función `processMessageWithTools`

  **Acceptance Criteria**:
  - [ ] Comando "hola" procesado por Vertex AI (ver logs)
  - [ ] Comando "1" (menú numérico) procesado por Vertex AI
  - [ ] Respuestas idénticas al comportamiento actual

  **Commit**: YES
  - Message: `refactor(bot): unify Vertex AI and legacy command flows`
  - Files: `src/app/api/bot/route.ts`

---

- [x] 4. Crear tests E2E para webhook del bot

  **What to do**:
  - Crear `tests/bot-webhook.spec.ts` con tests Playwright
  - Cubrir escenarios: saludo, menú numérico, pedido simple, registro cliente nuevo, reclamo
  - Mockear respuestas de Twilio/Meta para tests locales
  - Agregar script `test:bot:e2e` en package.json

  **Must NOT do**:
  - NO hacer tests que dependan de Gemini en vivo (mockear)
  - NO hacer tests que modifiquen datos reales

  **Parallelizable**: NO (valida tasks anteriores)

  **References**:
  - `tests/admin-bot-chat.spec.ts` - Test existente de UI del bot
  - `scripts/test-bot-webhook.ts` - Script de test manual existente
  - `src/app/api/bot/route.ts` - Endpoint a testear

  **Acceptance Criteria**:
  - [ ] `npm run test:bot:e2e` ejecuta y pasa
  - [ ] Coverage de escenarios: saludo (✓), menú (✓), pedido (✓), registro (✓), reclamo (✓)
  - [ ] Tests no dependen de servicios externos (mocks)

  **Commit**: YES
  - Message: `test(bot): add E2E tests for webhook`
  - Files: `tests/bot-webhook.spec.ts`, `package.json`

---

### FASE 2: Mejoras NLU y Personalización

- [x] 5. Expandir contexto conversacional a 8 mensajes

  **What to do**:
  - Modificar `agent.ts` para usar últimos 8 mensajes en `historialReciente`
  - Aumentar límite de caracteres por mensaje de 100 a 200
  - Total: 8 mensajes × 200 chars = 1600 chars de contexto

  **Must NOT do**:
  - NO exceder 2000 tokens de contexto (costos de Gemini)

  **Parallelizable**: YES (con task 6)

  **References**:
  - `src/lib/vertex/agent.ts:121-126` - Código actual de historial
  - `src/lib/vertex/prompts/system-prompt.ts` - System prompt que recibe el contexto

  **Acceptance Criteria**:
  - [ ] Test: Enviar 5 mensajes, el 6to debe recordar el contexto del 1ero
  - [ ] Logs muestran: "Contexto: 8 mensajes"

  **Commit**: YES
  - Message: `feat(bot): expand conversation context to 8 messages`
  - Files: `src/lib/vertex/agent.ts`

---

- [x] 6. Hacer Memory Bank persistente (no expira)

  **What to do**:
  - Crear tabla `cliente_memoria` con campos: `cliente_id`, `learned_facts` (JSONB), `created_at`, `updated_at`
  - Migrar `learned_facts` de `bot_sessions` a `cliente_memoria`
  - Modificar `session-manager.ts` para guardar/cargar de nueva tabla
  - El historial de conversación sigue expirando (24h), pero los hechos NO

  **Must NOT do**:
  - NO eliminar tabla `bot_sessions` (sigue usándose para historial)

  **Parallelizable**: YES (con task 5)

  **References**:
  - `src/lib/vertex/session-manager.ts:68-70` - Expiración actual de 24h
  - `src/lib/vertex/memory-extractor.ts` - Lógica de extracción de hechos
  - `src/lib/vertex/agent.ts:488-540` - Función `extractAndSaveFactsInBackground`

  **Acceptance Criteria**:
  - [ ] Migración aplicada: tabla `cliente_memoria` existe
  - [ ] Test: Guardar hecho, esperar 25h, hecho sigue disponible
  - [ ] Historial de conversación sigue expirando normalmente

  **Commit**: YES
  - Message: `feat(bot): make Memory Bank persistent across sessions`
  - Files: `supabase/migrations/YYYYMMDD_cliente_memoria.sql`, `src/lib/vertex/session-manager.ts`

---

- [x] 7. Agregar confirmación de hechos aprendidos

  **What to do**:
  - Cuando Memory Bank aprende algo nuevo, el bot confirma al cliente
  - Ejemplo: "Anotado que preferís entregas los viernes"
  - Agregar opción "corregir" si el cliente dice que está mal
  - Implementar en `memory-extractor.ts`

  **Must NOT do**:
  - NO confirmar cada hecho (solo los importantes: día preferido, tipo negocio)
  - NO más de 1 confirmación por conversación

  **Parallelizable**: NO (depende de task 6)

  **References**:
  - `src/lib/vertex/memory-extractor.ts:14-50` - Tipos de hechos que se extraen
  - `src/lib/vertex/prompts/system-prompt.ts:50-80` - Personalización basada en hechos

  **Acceptance Criteria**:
  - [ ] Test: Mencionar "soy restaurante", bot responde "Anotado que tenés un restaurante"
  - [ ] Cliente puede corregir: "No, soy rotisería" → bot actualiza

  **Commit**: YES
  - Message: `feat(bot): add learned facts confirmation to user`
  - Files: `src/lib/vertex/memory-extractor.ts`, `src/lib/vertex/agent.ts`

---

### FASE 3: Upselling Sutil

- [x] 8. Crear tabla de productos complementarios con análisis de ventas

  **What to do**:
  - Crear tabla `productos_complementarios`: `producto_id`, `complementario_id`, `mensaje_sugerencia`, `frecuencia_conjunta`, `prioridad`
  - Crear función RPC `fn_analizar_productos_complementarios()` que analiza `detalles_pedido` para detectar productos que se compran juntos frecuentemente
  - Poblar tabla automáticamente con los 3 productos más frecuentes por cada producto
  - Crear función RPC `get_productos_complementarios(producto_id)` para consultas

  **Must NOT do**:
  - NO crear sugerencias manuales (deben venir del análisis de datos reales)

  **Parallelizable**: YES (con task 9)

  **References**:
  - `src/types/database.types.ts` - Tipos de tablas existentes
  - Tabla `productos` - Estructura de productos

  **Acceptance Criteria**:
  - [ ] Tabla existe con al menos 10 relaciones de productos
  - [ ] RPC retorna complementarios correctamente

  **Commit**: YES
  - Message: `feat(bot): add complementary products table for upselling`
  - Files: `supabase/migrations/YYYYMMDD_productos_complementarios.sql`

---

- [x] 9. Implementar sugerencias de upselling en flujo de pedido

  **What to do**:
  - Modificar `crearPresupuestoTool` para consultar productos complementarios
  - Agregar sugerencia sutil al final de confirmación de presupuesto
  - Formato: "Muchos clientes también llevan [producto], ¿agregamos?"
  - Si cliente dice "sí", agregar al presupuesto existente

  **Must NOT do**:
  - NO sugerir más de 2 productos por presupuesto
  - NO sugerir si el presupuesto ya tiene más de 5 items

  **Parallelizable**: NO (depende de task 8)

  **References**:
  - `src/lib/vertex/tools/crear-presupuesto.ts` - Tool actual de creación
  - `src/app/api/bot/route.ts:1394-1411` - Respuesta al crear presupuesto

  **Acceptance Criteria**:
  - [ ] Test: Pedir "ala" → bot sugiere "pechuga"
  - [ ] Test: Responder "sí" → presupuesto actualizado con producto sugerido
  - [ ] Test: Presupuesto con 6 items → NO hay sugerencia

  **Commit**: YES
  - Message: `feat(bot): implement subtle upselling suggestions`
  - Files: `src/lib/vertex/tools/crear-presupuesto.ts`, `src/app/api/bot/route.ts`

---

### FASE 4: Notificaciones Proactivas

- [x] 10. Crear sistema de notificaciones en BD

  **What to do**:
  - Crear tabla `notificaciones_programadas`: `id`, `cliente_id`, `tipo`, `mensaje`, `datos` (JSONB), `programada_para`, `enviada`, `created_at`
  - Tipos: `estado_pedido`, `recordatorio_compra`, `promocion`, `entrega_cercana`, `alerta_pago`
  - Crear tabla `cliente_preferencias_notificaciones`: `cliente_id`, `tipo`, `habilitado`, `frecuencia_maxima`
  - Por defecto: todas habilitadas, máx 3/día

  **Must NOT do**:
  - NO enviar notificaciones sin verificar preferencias del cliente

  **Parallelizable**: YES (con task 11)

  **References**:
  - `src/lib/services/notificaciones.ts` - Sistema de notificaciones existente (para pedidos)
  - Tabla `clientes` - Datos de clientes

  **Acceptance Criteria**:
  - [x] Tablas creadas y con políticas RLS
  - [x] Por defecto, nuevo cliente tiene todas las notificaciones habilitadas

  **Commit**: YES (2d9ad05)
  - Message: `feat(bot): add notification scheduling tables`
  - Files: `supabase/migrations/20260124_notificaciones_programadas.sql`

---

- [x] 11. Crear servicio de envío de notificaciones

  **What to do**:
  - Crear `src/lib/services/notificaciones-proactivas.ts`
  - Implementar función `enviarNotificacionProgramada(notificacion_id)`
  - Integrar con WhatsApp (Meta o Twilio según configuración)
  - Crear API route `/api/cron/notificaciones` para ejecución programada
  - Implementar rate limiting (máx 3/día por cliente)

  **Must NOT do**:
  - NO enviar en horarios no laborales (8am-8pm)
  - NO enviar si cliente no tiene WhatsApp

  **Parallelizable**: NO (depende de task 10)

  **References**:
  - `src/lib/services/whatsapp-meta.ts` - Servicio de WhatsApp existente
  - `src/lib/services/notificaciones.ts` - Patrones existentes

  **Acceptance Criteria**:
  - [x] Servicio puede enviar notificación de prueba
  - [x] Rate limiting funciona: 4ta notificación del día no se envía
  - [x] Notificación fuera de horario se reprograma

  **Commit**: YES (9f7df21)
  - Message: `feat(bot): add proactive notification service with Twilio`
  - Files: `src/lib/services/notificaciones-proactivas.ts`, `src/app/api/cron/notificaciones/route.ts`

---

- [ ] 12. Implementar triggers de notificaciones

  **What to do**:
  - **Estado pedido**: Trigger en cambio de estado de pedido → programar notificación
  - **Recordatorio compra**: Cron job diario que detecta clientes que compraron hace X días y no han vuelto
  - **Entrega cercana**: Trigger cuando repartidor está a <500m del cliente
  - **Alerta pago**: Cron job para saldos vencidos

  **Must NOT do**:
  - NO enviar recordatorio a clientes inactivos hace más de 60 días
  - NO enviar alerta de pago si saldo < $1000

  **Parallelizable**: NO (depende de task 11)

  **References**:
  - `src/actions/pedidos.actions.ts` - Acciones de cambio de estado
  - `src/app/api/reparto/ubicacion/route.ts` - API de ubicación de repartidor

  **Acceptance Criteria**:
  - [ ] Cambiar estado de pedido → notificación programada en BD
  - [ ] Cliente que no compra hace 7 días y solía comprar semanal → recordatorio
  - [ ] Repartidor llega a 500m → cliente notificado

  **Commit**: YES
  - Message: `feat(bot): implement notification triggers for all types`
  - Files: `src/actions/pedidos.actions.ts`, `src/app/api/cron/recordatorios/route.ts`

---

- [ ] 13. Agregar opt-out de notificaciones en bot

  **What to do**:
  - Agregar comando "notificaciones" al bot
  - Mostrar estado actual y permitir activar/desactivar cada tipo
  - Agregar link de opt-out en cada notificación enviada
  - Implementar en nuevo tool `gestionarNotificacionesTool`

  **Must NOT do**:
  - NO permitir desactivar notificaciones de estado de pedido (son transaccionales)

  **Parallelizable**: NO (depende de task 11)

  **References**:
  - `src/lib/vertex/tools/` - Estructura de tools existentes
  - `src/app/api/bot/route.ts` - Integración de tools

  **Acceptance Criteria**:
  - [ ] Comando "notificaciones" muestra opciones
  - [ ] Cliente puede desactivar recordatorios
  - [ ] Cada notificación tiene "Responde STOP para desactivar"

  **Commit**: YES
  - Message: `feat(bot): add notification opt-out management`
  - Files: `src/lib/vertex/tools/gestionar-notificaciones.ts`, `src/app/api/bot/route.ts`

---

### FASE 5: Dashboard de Métricas

- [ ] 14. Crear tabla de métricas del bot

  **What to do**:
  - Crear tabla `bot_metricas_diarias`: `fecha`, `total_mensajes`, `mensajes_exitosos`, `mensajes_fallidos`, `presupuestos_creados`, `tiempo_respuesta_promedio_ms`
  - Crear tabla `bot_metricas_productos`: `fecha`, `producto_id`, `veces_pedido`, `cantidad_total`
  - Crear trigger en `bot_messages` que actualiza métricas

  **Must NOT do**:
  - NO almacenar contenido de mensajes en métricas (privacidad)

  **Parallelizable**: YES (con task 15)

  **References**:
  - `src/app/(admin)/(dominios)/reportes/` - Estructura de reportes existentes
  - Tabla `bot_messages` - Fuente de datos

  **Acceptance Criteria**:
  - [ ] Tablas creadas con índices apropiados
  - [ ] Trigger actualiza métricas al insertar mensaje

  **Commit**: YES
  - Message: `feat(bot): add daily metrics tables`
  - Files: `supabase/migrations/YYYYMMDD_bot_metricas.sql`

---

- [ ] 15. Crear dashboard de métricas del bot

  **What to do**:
  - Crear página `/reportes/bot` con dashboard
  - Mostrar: mensajes/día (gráfico), tasa conversión, tiempo respuesta promedio, top 10 productos
  - Filtros: rango de fechas, comparación con período anterior
  - Usar Recharts (ya instalado)

  **Must NOT do**:
  - NO mostrar datos de clientes individuales (solo agregados)

  **Parallelizable**: NO (depende de task 14)

  **References**:
  - `src/app/(admin)/(dominios)/reportes/` - Estructura de reportes existentes
  - `src/components/charts/` - Componentes de gráficos existentes

  **Acceptance Criteria**:
  - [ ] Página accesible en `/reportes/bot`
  - [ ] Muestra 4 métricas principales con gráficos
  - [ ] Filtro de fechas funciona

  **Commit**: YES
  - Message: `feat(bot): add metrics dashboard`
  - Files: `src/app/(admin)/(dominios)/reportes/bot/page.tsx`, `src/actions/bot-metricas.actions.ts`

---

- [ ] 16. Agregar métricas al sidebar de admin

  **What to do**:
  - Agregar link "Métricas Bot" en sección Reportes del sidebar
  - Mostrar badge con mensajes de hoy si hay actividad

  **Must NOT do**:
  - NO mostrar a roles que no sean admin

  **Parallelizable**: NO (depende de task 15)

  **References**:
  - `src/components/layout/Sidebar.tsx` - Sidebar actual

  **Acceptance Criteria**:
  - [ ] Link visible en sidebar para admin
  - [ ] Badge muestra número de mensajes de hoy

  **Commit**: YES
  - Message: `feat(bot): add metrics link to admin sidebar`
  - Files: `src/components/layout/Sidebar.tsx`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(bot): add bot_pending_states table` | migration | `supabase migration up` |
| 2 | `refactor(bot): migrate in-memory state to Supabase` | state-manager, route | reiniciar servidor, continuar flujo |
| 3 | `refactor(bot): unify Vertex AI and legacy flows` | route.ts | logs muestran Vertex para todo |
| 4 | `test(bot): add E2E tests` | tests, package.json | `npm run test:bot:e2e` |
| 5 | `feat(bot): expand context to 8 messages` | agent.ts | test de memoria |
| 6 | `feat(bot): persistent Memory Bank` | migration, session-manager | test de persistencia |
| 7 | `feat(bot): learned facts confirmation` | memory-extractor, agent | test de confirmación |
| 8 | `feat(bot): complementary products table` | migration | query retorna datos |
| 9 | `feat(bot): subtle upselling` | crear-presupuesto, route | test de sugerencia |
| 10 | `feat(bot): notification tables` | migration | tablas existen |
| 11 | `feat(bot): notification service` | notificaciones-proactivas | envío de prueba |
| 12 | `feat(bot): notification triggers` | actions, cron | trigger funciona |
| 13 | `feat(bot): notification opt-out` | tool, route | comando funciona |
| 14 | `feat(bot): metrics tables` | migration | trigger actualiza |
| 15 | `feat(bot): metrics dashboard` | page, actions | página carga |
| 16 | `feat(bot): metrics in sidebar` | Sidebar | link visible |

---

## Success Criteria

### Verification Commands
```bash
# Tests E2E del bot
npm run test:bot:e2e  # Expected: All tests pass

# Verificar migración de estado
curl -X POST localhost:3000/api/bot -d "Body=hola&From=whatsapp:+5491234567890"
# Reiniciar servidor
curl -X POST localhost:3000/api/bot -d "Body=mi nombre es Juan Perez&From=whatsapp:+5491234567890"
# Expected: Flujo continúa correctamente

# Verificar métricas
curl localhost:3000/api/bot/metricas?fecha=2026-01-24
# Expected: JSON con métricas del día
```

### Final Checklist
- [ ] Bot no pierde estado entre reinicios de Vercel
- [ ] Contexto de 8 mensajes funciona
- [ ] Memory Bank persiste más de 24h
- [ ] Upselling sugiere productos correctamente
- [ ] Notificaciones se envían según triggers
- [ ] Dashboard muestra 4 métricas principales
- [ ] Tests E2E pasan
- [ ] Ningún test existente roto
