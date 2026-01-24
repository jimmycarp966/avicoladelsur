# Issues - Mejora Bot Vendedor

## Problemas Conocidos

### Estado en Memoria Volátil
- **Problema**: Maps (`registroClientesPendientes`, `reclamosPendientes`, `pendingConfirmations`) se pierden en Vercel serverless
- **Ubicación**: `src/app/api/bot/route.ts:266-280`
- **Impacto**: Clientes pierden progreso en flujos de registro/reclamo
- **Solución**: Task 1-2 (migrar a Supabase)

### Contexto Limitado
- **Problema**: Solo 3 mensajes de historial en detección de intención
- **Ubicación**: `src/lib/vertex/agent.ts:121-126`
- **Impacto**: Bot "olvida" contexto en conversaciones largas
- **Solución**: Task 5 (expandir a 8 mensajes)

### Memory Bank Expira
- **Problema**: Hechos aprendidos se pierden tras 24h
- **Ubicación**: `src/lib/vertex/session-manager.ts:68-70`
- **Impacto**: Bot no recuerda preferencias del cliente
- **Solución**: Task 6 (tabla permanente)

### Flujos Duplicados
- **Problema**: Arquitectura dual (Vertex AI + legacy hardcodeado)
- **Ubicación**: `src/app/api/bot/route.ts:1448-1484`
- **Impacto**: Inconsistencias en respuestas
- **Solución**: Task 3 (unificar en Vertex AI)
