# IA Capabilities

Actualizado: 2026-03-27

Este documento define que capacidades usan IA real, cuales son asistidas y cuales siguen siendo endpoints sin inferencia en tiempo real.

La fuente principal de esta matriz es:

- `src/lib/ai/capability-registry.ts`
- `src/app/api/ia/*`
- `src/app/api/predictions/*`
- `src/app/api/reportes/ia/*`
- `src/app/api/documents/process/route.ts`

## Estrategias

- `none`: no ejecuta inferencia
- `assisted`: mezcla reglas / estadistica / heuristicas con enriquecimiento IA
- `primary`: la respuesta principal depende de IA

## Proveedores

- `none`
- `gemini`
- `vertex`
- `document_ai`

## Contrato recomendado

Los endpoints modernos devuelven metadata IA con esta forma:

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

No todos los endpoints legacy ya cumplen este contrato.

## Matriz actual

| Capability | Strategy | Provider | UI principal | Endpoints |
| --- | --- | --- | --- | --- |
| `stock_prediction` | `assisted` | `gemini` | `/dashboard`, `/dashboard/predicciones` | `/api/ia/prediccion-stock`, `/api/predictions/stock-coverage` |
| `customer_risk` | `assisted` | `gemini` | `/dashboard` | `/api/ia/clientes-riesgo`, `/api/predictions/customer-risk` |
| `expense_classification` | `assisted` | `gemini` | `/tesoreria/gastos` | `/api/tesoreria/clasificar-gasto`, `/api/ia/clasificar-gasto` |
| `payment_validation` | `assisted` | `gemini` | `/tesoreria/validar-rutas` | `/api/tesoreria/validar-cobro`, `/api/ia/validar-cobro` |
| `payment_audit` | `none` | `none` | `/tesoreria` | `/api/ia/auditar-cobros` |
| `reports_chat` | `primary` | `gemini` | `/reportes/ia` | `/api/reportes/ia/generate`, `/api/reportes/ia/chat` |
| `document_processing` | `primary` | `document_ai` | `/almacen/documentos` | `/api/documents/process` |
| `weight_anomaly` | `assisted` | `gemini` | `/almacen/presupuesto/[id]/pesaje` | `/api/almacen/analizar-peso` |

## Endpoints relacionados no cubiertos por el registry

Estos endpoints son relevantes para IA o prediccion, aunque hoy no todos esten registrados en `AI_CAPABILITY_REGISTRY`:

| Endpoint | Estado actual |
| --- | --- |
| `/api/predictions/demand` | prediccion asistida, con metadata IA |
| `/api/predictions/alerts` | lectura sin inferencia en tiempo real |
| `/api/documents/process` | procesamiento primario con Document AI |
| `/api/almacen/analizar-peso` | endpoint legacy de analisis de pesaje; no usa aun el contrato moderno de metadata |
| `/api/ia/capabilities` | inventario publico de capacidades registradas |

## Rutas canonicas y legacy

### Canonicas

- `/api/predictions/stock-coverage`
- `/api/predictions/customer-risk`
- `/api/predictions/demand`
- `/api/predictions/alerts`
- `/api/tesoreria/clasificar-gasto`
- `/api/tesoreria/validar-cobro`
- `/api/reportes/ia/generate`
- `/api/reportes/ia/chat`
- `/api/documents/process`

### Legacy mantenidas

- `/api/ia/prediccion-stock`
- `/api/ia/clientes-riesgo`
- `/api/ia/clasificar-gasto`
- `/api/ia/validar-cobro`
- `/api/almacen/analizar-peso`

## Variables de entorno

Variables base:

- `GOOGLE_GEMINI_API_KEY`
- `GOOGLE_GEMINI_MODEL`
- `GOOGLE_GEMINI_LOCATION`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_REGION`

Compatibilidad / fallback:

- `GEMINI_API_KEY`
- `GOOGLE_AI_API_KEY`
- `GOOGLE_CLOUD_CREDENTIALS`
- `GOOGLE_CLOUD_CREDENTIALS_BASE64`
- `GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64`
- `GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH`

Integraciones especificas:

- `GOOGLE_VERTEX_AI_ENABLED`
- `GOOGLE_VERTEX_AI_LOCATION`
- `GOOGLE_DOCUMENT_AI_PROJECT_ID`
- `GOOGLE_DOCUMENT_AI_LOCATION`
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS`
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS`

## Notas operativas

- definir `GOOGLE_GEMINI_MODEL` explicitamente en ambiente
- si se agrega una nueva capability, actualizar este archivo y el registry
- si un endpoint usa IA pero no expone metadata, marcarlo como legacy hasta normalizarlo
