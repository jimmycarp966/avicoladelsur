# Google Cloud setup

Actualizado: 2026-03-27

Esta guia describe la configuracion actual de Google Cloud para este repo. Si otra nota o auditoria contradice este archivo, esta guia es la referencia vigente.

## 1. Que usa hoy el proyecto

| Area | Uso actual | Variables principales |
| --- | --- | --- |
| Gemini | reportes IA, chat, enriquecimientos y capacidades asistidas | `GOOGLE_GEMINI_API_KEY`, `GOOGLE_GEMINI_MODEL`, `GOOGLE_GEMINI_LOCATION` |
| Vertex AI | predicciones y algunos servicios de ML | `GOOGLE_VERTEX_AI_ENABLED`, `GOOGLE_VERTEX_AI_LOCATION` |
| Document AI | procesamiento documental | `GOOGLE_DOCUMENT_AI_*` |
| Maps frontend | script de Google Maps en cliente | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Maps backend | geocoding, directions y fallbacks | `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_FLEET_ROUTING_API_KEY` |
| Dialogflow | integracion del bot | `GOOGLE_DIALOGFLOW_*` |
| Speech-to-Text | transcripcion / soporte de voz | `GOOGLE_SPEECH_TO_TEXT_*` |
| Optimization / Fleet Routing | optimizacion avanzada opcional | `GOOGLE_OPTIMIZATION_API_ENABLED`, `GOOGLE_MAPS_FLEET_ROUTING_API_KEY` |

## 2. Credenciales

El repo soporta varios modos. Usar uno explicito y mantenerlo documentado por ambiente:

- `GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64`
- `GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH`
- `GOOGLE_CLOUD_CREDENTIALS`
- `GOOGLE_CLOUD_CREDENTIALS_BASE64`

Variables base:

- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_CLOUD_REGION`

## 3. Modelos Gemini

Definir `GOOGLE_GEMINI_MODEL` explicitamente. No depender de defaults implicitos del codigo.

Hoy el codigo todavia conserva un fallback legacy a `gemini-3-pro-preview` cuando la variable no esta definida. Tratar ese fallback como transicional y no como configuracion recomendada.

Valor recomendado para operacion general:

```bash
GOOGLE_GEMINI_MODEL=gemini-2.5-flash
```

Si se quiere un modelo mas pesado para casos puntuales, documentarlo por ambiente y por feature.

## 4. Maps y routing

### Frontend

El script de mapas del frontend usa `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

### Backend

Servicios de backend y scripts pueden usar:

- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_MAPS_FLEET_ROUTING_API_KEY`

### Orden real de routing

El sistema base no depende exclusivamente de Google:

1. ORS
2. Google Directions
3. optimizador local

Para optimizacion avanzada:

1. Google Optimization API
2. Google Fleet Routing
3. fallback base

No tratar Fleet Routing y Optimization como prerequisitos obligatorios del flujo normal.

## 5. Variables recomendadas

```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_REGION=southamerica-east1

GOOGLE_GEMINI_API_KEY=your-gemini-api-key
GOOGLE_GEMINI_MODEL=gemini-2.5-flash
GOOGLE_GEMINI_LOCATION=us-central1

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-public-google-maps-key
GOOGLE_MAPS_API_KEY=your-server-google-maps-key
GOOGLE_MAPS_FLEET_ROUTING_API_KEY=your-fleet-routing-key
NEXT_PUBLIC_OPENROUTESERVICE_API_KEY=your-ors-key
GRAPHHOPPER_API_KEY=your-graphhopper-key

GOOGLE_VERTEX_AI_ENABLED=true
GOOGLE_VERTEX_AI_LOCATION=us-central1

GOOGLE_DOCUMENT_AI_PROJECT_ID=your-project-id
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=your-processor-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=your-processor-id

GOOGLE_DIALOGFLOW_PROJECT_ID=your-project-id
GOOGLE_DIALOGFLOW_AGENT_ID=your-agent-id
GOOGLE_DIALOGFLOW_LANGUAGE_CODE=es-AR

GOOGLE_SPEECH_TO_TEXT_ENABLED=true
GOOGLE_SPEECH_TO_TEXT_LANGUAGE_CODE=es-AR

GOOGLE_OPTIMIZATION_API_ENABLED=false
```

## 6. Checklist local

1. Configurar credenciales GCP.
2. Definir `GOOGLE_GEMINI_MODEL`.
3. Configurar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para UI.
4. Configurar `NEXT_PUBLIC_OPENROUTESERVICE_API_KEY` para flujo base de rutas.
5. Agregar claves opcionales solo si se va a usar optimizacion avanzada.

## 7. Referencias canonicas

- `README.md`
- `docs/VERCEL_SETUP.md`
- `docs/IA_CAPABILITIES.md`
- `env.example`

## 8. Nota sobre auditorias viejas

`docs/AUDITORIA_GOOGLE_CLOUD.md` queda como documento historico. No usarlo como checklist actual de setup.
