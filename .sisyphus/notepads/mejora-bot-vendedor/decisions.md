# Decisions - Mejora Bot Vendedor

## Decisiones Arquitectónicas

### Estado Persistente
- **Decisión**: Usar Supabase en lugar de Redis
- **Razón**: Ya integrado, sin costo extra, consistente con el resto del sistema
- **Tabla**: `bot_pending_states` separada de `bot_sessions`

### Contexto Conversacional
- **Decisión**: Expandir de 3 a 8 mensajes
- **Razón**: Balance entre contexto útil y costos de Gemini
- **Límite**: 8 mensajes × 200 chars = 1600 chars (< 2000 tokens)

### Memory Bank
- **Decisión**: Persistencia permanente en tabla separada
- **Razón**: Hechos aprendidos no deben expirar con sesiones
- **Tabla**: `cliente_memoria` (nueva)

### Upselling
- **Decisión**: Basado en análisis de ventas reales
- **Razón**: Más preciso que sugerencias manuales
- **Función**: `fn_analizar_productos_complementarios()`

### Notificaciones
- **Decisión**: Opt-out por defecto, máx 3/día
- **Razón**: Balance entre engagement y no ser spam
- **Horario**: 8am-8pm solamente
