# Vercel setup

Actualizado: 2026-03-27

Esta guia resume las variables de entorno que hoy afectan un deploy funcional en Vercel.

## 1. Variables minimas

### Base app / Supabase

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Cron

```bash
CRON_SECRET=generate-a-long-random-secret
```

## 2. Variables recomendadas segun features

### Mapas y routing

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-public-google-maps-key
GOOGLE_MAPS_API_KEY=your-server-google-maps-key
GOOGLE_MAPS_FLEET_ROUTING_API_KEY=your-fleet-routing-key
NEXT_PUBLIC_OPENROUTESERVICE_API_KEY=your-ors-key
GRAPHHOPPER_API_KEY=your-graphhopper-key
```

### Bot y WhatsApp

```bash
WHATSAPP_PROVIDER=auto
WHATSAPP_ENABLE_BUTTONS=true

WHATSAPP_META_ACCESS_TOKEN=...
WHATSAPP_META_PHONE_NUMBER_ID=...
WHATSAPP_META_APP_ID=...
WHATSAPP_META_APP_SECRET=...
WHATSAPP_META_VERIFY_TOKEN=...
WHATSAPP_META_WEBHOOK_URL=https://your-domain.vercel.app/api/webhooks/whatsapp-meta

KAPSO_API_KEY=...
KAPSO_WHATSAPP_PHONE_NUMBER_ID=...
KAPSO_WHATSAPP_WEBHOOK_SECRET=...
KAPSO_WHATSAPP_BASE_URL=https://api.kapso.ai/meta/whatsapp

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=...

BOTPRESS_WEBHOOK_URL=...
BOTPRESS_API_KEY=...
BOTPRESS_WEBHOOK_TOKEN=...
```

### Google Cloud / IA

```bash
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_CLOUD_REGION=southamerica-east1
GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64=...

GOOGLE_GEMINI_API_KEY=...
GOOGLE_GEMINI_MODEL=gemini-2.5-flash
GOOGLE_GEMINI_LOCATION=us-central1

GOOGLE_VERTEX_AI_ENABLED=true
GOOGLE_VERTEX_AI_LOCATION=us-central1

GOOGLE_DOCUMENT_AI_PROJECT_ID=...
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=...
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=...

GOOGLE_DIALOGFLOW_PROJECT_ID=...
GOOGLE_DIALOGFLOW_AGENT_ID=...
GOOGLE_DIALOGFLOW_LANGUAGE_CODE=es-AR

GOOGLE_SPEECH_TO_TEXT_ENABLED=true
GOOGLE_SPEECH_TO_TEXT_LANGUAGE_CODE=es-AR
```

### RRHH / Hik-Connect

```bash
HIK_CONNECT_BASE_URL=...
HIK_CONNECT_API_KEY=...
HIK_CONNECT_API_SECRET=...
HIK_CONNECT_TOKEN_PATH=/api/hccgw/platform/v1/token/get
HIK_CONNECT_EVENTS_PATH=/api/hccgw/acs/v1/event/certificaterecords/search
HIK_CONNECT_EVENTS_METHOD=POST
HIK_CONNECT_AUTH_MODE=hcc_token
HIK_CONNECT_PERSON_MAP=
HIK_CONNECT_PAGE_SIZE=200
HIK_CONNECT_MAX_PAGES_HISTORICAL=100
HIK_ATTENDANCE_DEBOUNCE_MINUTES=1
```

### WebMCP y toggles

```bash
NEXT_PUBLIC_WEBMCP_ENABLED=false
RRHH_AUTO_LIQUIDACIONES_UI_FALLBACK=false
```

## 3. Como cargar variables

### Dashboard

1. Abrir proyecto en Vercel.
2. Ir a Settings -> Environment Variables.
3. Cargar las variables por entorno.
4. Redeploy del ambiente afectado.

### CLI

```bash
vercel env add VARIABLE_NAME
```

## 4. Verificaciones utiles

- UI de mapas: verificar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- endpoints cron: verificar `CRON_SECRET`
- webhook Meta: verificar URL y `WHATSAPP_META_VERIFY_TOKEN`
- bot multi-proveedor: verificar `WHATSAPP_PROVIDER`
- RRHH horarios: verificar `HIK_CONNECT_*`
- WebMCP: verificar `NEXT_PUBLIC_WEBMCP_ENABLED`

## 5. Referencias

- `env.example`
- `README.md`
- `docs/GOOGLE_CLOUD_SETUP.md`
- `docs/WHATSAPP_KAPSO_SETUP.md`
- `docs/WHATSAPP_META_SETUP.md`
