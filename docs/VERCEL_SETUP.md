# 🚀 Configuración de Variables de Entorno en Vercel

Esta guía te explica cómo configurar las variables de entorno (incluyendo la Google Maps API Key) en Vercel para producción.

## 📋 Pasos para Configurar en Vercel

### Opción 1: Desde el Dashboard de Vercel (Recomendado)

1. **Accede a tu proyecto en Vercel**
   - Ve a [vercel.com](https://vercel.com)
   - Inicia sesión
   - Selecciona tu proyecto "Avicola del Sur" (o el nombre que tenga)

2. **Ve a la configuración del proyecto**
   - Haz clic en **"Settings"** (Configuración)
   - En el menú lateral, selecciona **"Environment Variables"** (Variables de Entorno)

3. **Agrega la Google Maps API Key**
   - Haz clic en **"Add New"** (Agregar Nueva)
   - **Key**: `GOOGLE_MAPS_API_KEY`
   - **Value**: `AIzaSyAfsPP-qnCmulna4zNbLEQkDk_88MB-n3o`
   - **Environment**: Selecciona todas las opciones:
     - ✅ Production (Producción)
     - ✅ Preview (Previsualización)
     - ✅ Development (Desarrollo)
   - Haz clic en **"Save"** (Guardar)

4. **Redesplegar la aplicación**
   - Ve a la pestaña **"Deployments"** (Despliegues)
   - Haz clic en los tres puntos (⋯) del último despliegue
   - Selecciona **"Redeploy"** (Redesplegar)
   - O simplemente haz un nuevo commit y push (Vercel desplegará automáticamente)

### Opción 2: Desde la CLI de Vercel

Si prefieres usar la terminal:

```bash
# 1. Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# 2. Iniciar sesión
vercel login

# 3. Agregar la variable de entorno
vercel env add GOOGLE_MAPS_API_KEY

# Cuando se solicite:
# - Value: AIzaSyAfsPP-qnCmulna4zNbLEQkDk_88MB-n3o
# - Environment: Selecciona Production, Preview y Development

# 4. Verificar que se agregó
vercel env ls
```

## ✅ Verificar que Funciona

### Método 1: Revisar Logs de Vercel

1. Ve a tu proyecto en Vercel
2. Selecciona un despliegue reciente
3. Haz clic en **"Functions"** (Funciones)
4. Busca logs que mencionen "Google Directions" o "fallback local"

### Método 2: Probar el Endpoint en Producción

```bash
# Reemplaza 'tu-dominio.vercel.app' con tu dominio real
curl -X POST https://tu-dominio.vercel.app/api/integrations/google/directions \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": -27.1671, "lng": -65.4995},
    "destination": {"lat": -27.1856, "lng": -65.4923},
    "waypoints": [{"lat": -27.1758, "lng": -65.4959}],
    "optimize": true
  }'
```

Si funciona, deberías recibir una respuesta con `"success": true` y datos de la ruta optimizada.

## 🔒 Seguridad en Vercel

### Buenas Prácticas

1. **No expongas la API Key en el código**
   - ✅ Usa variables de entorno (como estás haciendo)
   - ❌ No la pongas directamente en el código fuente

2. **Configura restricciones en Google Cloud Console**
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Edita tu API Key
   - En "Restricciones de aplicación", agrega:
     - Tu dominio de Vercel: `*.vercel.app`
     - Tu dominio personalizado (si lo tienes)

3. **Monitorea el uso**
   - Revisa regularmente en Google Cloud Console
   - Configura alertas de facturación

## 📝 Variables de Entorno Completas para Vercel

Asegúrate de tener configuradas todas estas variables en Vercel:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tvijhnglmryjmrstfvbv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Twilio
TWILIO_ACCOUNT_SID=ACd27123ff100aaa78a7bcadb10eac2f0a
TWILIO_AUTH_TOKEN=daa2272544d8e082fc16776d9356744d
TWILIO_WHATSAPP_NUMBER=+14155238886

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaSyAfsPP-qnCmulna4zNbLEQkDk_88MB-n3o
GOOGLE_MAPS_FLEET_ROUTING_API_KEY=tu-fleet-routing-api-key

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
GOOGLE_CLOUD_REGION=southamerica-east1
GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64=tu-service-account-base64

# Google Cloud APIs
GOOGLE_OPTIMIZATION_API_ENABLED=true
GOOGLE_SPEECH_TO_TEXT_ENABLED=true
GOOGLE_VERTEX_AI_ENABLED=true
GOOGLE_AUTOML_ENABLED=true

# Dialogflow
GOOGLE_DIALOGFLOW_PROJECT_ID=tu-project-id
GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id
GOOGLE_DIALOGFLOW_LANGUAGE_CODE=es-AR

# Speech-to-Text
GOOGLE_SPEECH_TO_TEXT_LANGUAGE_CODE=es-AR

# Document AI
GOOGLE_DOCUMENT_AI_PROJECT_ID=tu-project-id
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=tu-processor-id-facturas
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=tu-processor-id-remitos

# Vertex AI
GOOGLE_VERTEX_AI_LOCATION=us-central1

# AutoML
GOOGLE_AUTOML_LOCATION=us-central1

# Gemini API
GOOGLE_GEMINI_API_KEY=tu-gemini-api-key
GOOGLE_GEMINI_MODEL=gemini-3-pro-preview
GOOGLE_GEMINI_LOCATION=us-central1

# App
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

## 🆘 Solución de Problemas

### La API Key no funciona en producción

**Posibles causas:**
1. No se redesplegó después de agregar la variable
2. La variable está en el ambiente incorrecto (solo Development, no Production)
3. Las restricciones de Google están bloqueando el dominio de Vercel

**Solución:**
1. Verifica que la variable esté en todos los ambientes (Production, Preview, Development)
2. Redespliega la aplicación
3. Revisa las restricciones en Google Cloud Console

### Error: "API key not valid"

**Solución:**
- Verifica que copiaste la API Key correctamente (sin espacios)
- Revisa que esté habilitada "Directions API" en Google Cloud Console
- Espera unos minutos después de habilitar (puede tardar en propagarse)

## 📚 Recursos

- [Documentación de Vercel sobre Variables de Entorno](https://vercel.com/docs/concepts/projects/environment-variables)
- [Guía de Despliegue en Vercel](https://vercel.com/docs)

