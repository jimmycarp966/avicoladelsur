# Capacidades IA - Avicola del Sur ERP

## Objetivo
Definir de forma explicita que partes usan IA real, cuales son hibridas y cuales no usan IA.

## Estrategias
- `none`: no ejecuta inferencia de IA.
- `assisted`: motor base de reglas/estadistica + enriquecimiento IA opcional.
- `primary`: la funcionalidad principal depende de IA.

## Proveedores
- `gemini`: razonamiento y generacion de texto.
- `vertex`: prediccion ML en endpoints `predict`.
- `document_ai`: extraccion estructurada de documentos.

## Contrato API estandar
Todos los endpoints IA deben devolver:

```json
{
  "ai": {
    "strategy": "none|assisted|primary",
    "used": true,
    "provider": "none|gemini|vertex|document_ai",
    "model": "string|null",
    "fallbackUsed": false,
    "reason": "string",
    "latencyMs": 123
  }
}
```

## Variables de entorno
- Canonica: `GOOGLE_GEMINI_API_KEY`
- Compatibilidad legacy: `GOOGLE_AI_API_KEY`
- Vertex: `GOOGLE_VERTEX_AI_ENABLED=true` + credenciales GCP
- Document AI: `GOOGLE_DOCUMENT_AI_*`

## Rutas canonicas nuevas
- `POST /api/predictions/stock-coverage`
- `GET /api/predictions/customer-risk`
- `POST /api/tesoreria/clasificar-gasto`
- `POST /api/tesoreria/validar-cobro`

## Rutas legacy mantenidas (deprecadas)
- `POST /api/ia/prediccion-stock`
- `GET /api/ia/clientes-riesgo`
- `POST /api/ia/clasificar-gasto`
- `POST /api/ia/validar-cobro`

Estas rutas siguen activas para no romper integraciones, pero deben migrarse a las canonicas.
