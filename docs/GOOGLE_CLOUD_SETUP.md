# 🚀 Guía de Configuración - Google Cloud AI Services

Esta guía te ayudará a configurar todos los servicios de Google Cloud necesarios para el sistema ERP de Avícola del Sur.

## 📋 Prerrequisitos

- Cuenta de Google Cloud activa
- Proyecto de Google Cloud creado
- Facturación habilitada (necesaria para algunas APIs)

## 🚀 Opción Rápida: Configuración Automática con CLI

**¿Quieres automatizar todo?** Usa el script de configuración automática:

- **Windows**: `.\scripts\setup-google-cloud.ps1`
- **Linux/macOS**: `./scripts/setup-google-cloud.sh`

Ver la guía completa en: [`docs/SETUP_GOOGLE_CLOUD_CLI.md`](./SETUP_GOOGLE_CLOUD_CLI.md)

---

## 📝 Opción Manual: Configuración Paso a Paso

## 🔧 Paso 1: Crear Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **Project ID** (lo necesitarás para las variables de entorno)

## 🔑 Paso 2: Crear Service Account

1. En Google Cloud Console, ve a **IAM & Admin** → **Service Accounts**
2. Haz clic en **Create Service Account**
3. Completa:
   - **Name**: `avicola-del-sur-service`
   - **Description**: `Service account para ERP Avícola del Sur`
4. Haz clic en **Create and Continue**
5. Asigna roles necesarios:
   - `Cloud AI Platform User`
   - `Dialogflow API Admin`
   - `Document AI API User`
   - `Storage Object Viewer` (si usas Document AI Warehouse)
6. Haz clic en **Done**

### Generar Key JSON

1. Haz clic en el Service Account creado
2. Ve a la pestaña **Keys**
3. Haz clic en **Add Key** → **Create new key**
4. Selecciona **JSON**
5. Descarga el archivo JSON

### Configurar en el Proyecto

**Opción A: Base64 (Recomendado para producción)**

```bash
# En Linux/Mac
cat google-cloud-service-account.json | base64 -w 0

# En Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-cloud-service-account.json"))
```

Copia el resultado y pégalo en `GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64` en tu `.env.local`

**Opción B: Archivo local (Solo desarrollo)**

1. Coloca el archivo JSON en la raíz del proyecto
2. Agrega a `.gitignore`: `google-cloud-service-account.json`
3. Configura `GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH=./google-cloud-service-account.json`

## 🗺️ Paso 3: Habilitar APIs Necesarias

Ve a **APIs & Services** → **Library** y habilita las siguientes APIs:

### APIs Obligatorias

1. **Google Maps Fleet Routing API**
   - Busca "Fleet Routing API"
   - Haz clic en **Enable**

2. **Cloud Optimization API**
   - Busca "Cloud Optimization API"
   - Haz clic en **Enable**

3. **Dialogflow API**
   - Busca "Dialogflow API"
   - Haz clic en **Enable**

4. **Cloud Speech-to-Text API**
   - Busca "Cloud Speech-to-Text API"
   - Haz clic en **Enable**

5. **Document AI API**
   - Busca "Document AI API"
   - Haz clic en **Enable**

6. **Vertex AI API**
   - Busca "Vertex AI API"
   - Haz clic en **Enable**

7. **Gemini API**
   - Busca "Generative Language API" o "Gemini API"
   - Haz clic en **Enable**

### APIs Opcionales (ya habilitadas)

- **Google Maps JavaScript API** (ya configurada)
- **Google Directions API** (ya configurada)

## 🤖 Paso 4: Configurar Dialogflow Agent

1. Ve a [Dialogflow Console](https://dialogflow.cloud.google.com/)
2. Selecciona tu proyecto de Google Cloud
3. Haz clic en **Create Agent**
4. Completa:
   - **Agent name**: `Avicola del Sur Bot`
   - **Default language**: `Spanish (Argentina)`
   - **Time zone**: `America/Argentina/Buenos_Aires`
5. Haz clic en **Create**

### Obtener Agent ID

1. En Dialogflow Console, ve a **Settings** (⚙️)
2. En la pestaña **General**, copia el **Agent ID**
3. Configura `GOOGLE_DIALOGFLOW_AGENT_ID` en tu `.env.local`

### Crear Intenciones Básicas

El sistema necesita estas intenciones básicas:

1. **pedido** - Cliente quiere hacer un pedido
2. **consulta_stock** - Cliente pregunta por stock
3. **consulta_precio** - Cliente pregunta precios
4. **cancelar_pedido** - Cliente quiere cancelar pedido

Puedes crearlas manualmente o importar desde un archivo de configuración (ver sección avanzada).

## 📄 Paso 5: Configurar Document AI Processors

### Crear Processor para Facturas

1. Ve a [Document AI Console](https://console.cloud.google.com/ai/document-ai)
2. Selecciona tu proyecto
3. Haz clic en **Create Processor**
4. Selecciona **Invoice Parser** (o el tipo que necesites)
5. Completa:
   - **Name**: `Facturas Proveedores`
   - **Region**: `us` (o tu región preferida)
6. Haz clic en **Create**
7. Copia el **Processor ID** y configúralo en `GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS`

### Crear Processor para Remitos

1. Repite el proceso anterior
2. Selecciona **Form Parser** o **Document OCR**
3. **Name**: `Remitos Entrega`
4. Copia el **Processor ID** y configúralo en `GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS`

## 🔮 Paso 6: Configurar Vertex AI y Gemini

### Vertex AI

1. Ve a [Vertex AI Console](https://console.cloud.google.com/vertex-ai)
2. Asegúrate de que Vertex AI API esté habilitada
3. Selecciona tu región preferida (ej: `us-central1`)
4. Configura `GOOGLE_VERTEX_AI_LOCATION` en tu `.env.local`

### Gemini API

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Haz clic en **Create API Key**
3. Selecciona tu proyecto de Google Cloud
4. Copia la API Key y configúrala en `GOOGLE_GEMINI_API_KEY`

## 📝 Paso 7: Configurar Variables de Entorno

Copia el contenido de `env.example` a `.env.local` y completa todas las variables de Google Cloud:

```env
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
GOOGLE_CLOUD_REGION=southamerica-east1
GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64=tu-service-account-base64

# APIs específicas
GOOGLE_MAPS_FLEET_ROUTING_API_KEY=tu-api-key
GOOGLE_DIALOGFLOW_PROJECT_ID=tu-project-id
GOOGLE_DIALOGFLOW_AGENT_ID=tu-agent-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_FACTURAS=tu-processor-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID_REMITOS=tu-processor-id
GOOGLE_GEMINI_API_KEY=tu-gemini-api-key

# Configuraciones
GOOGLE_OPTIMIZATION_API_ENABLED=true
GOOGLE_SPEECH_TO_TEXT_ENABLED=true
GOOGLE_VERTEX_AI_ENABLED=true
GOOGLE_AUTOML_ENABLED=true
```

## ✅ Paso 8: Verificar Configuración

Ejecuta el siguiente comando para verificar que todo esté configurado correctamente:

```bash
npm run dev
```

Revisa los logs de la consola. Deberías ver mensajes indicando que los servicios de Google Cloud están configurados.

## 🔒 Seguridad

### Restricciones de API Keys

1. Ve a **APIs & Services** → **Credentials**
2. Haz clic en tu API Key
3. En **Application restrictions**, selecciona:
   - **HTTP referrers** (para APIs de cliente)
   - Agrega tu dominio: `https://tu-dominio.com/*`
4. En **API restrictions**, selecciona las APIs específicas que necesitas
5. Guarda los cambios

### Service Account Permissions

- Usa el principio de menor privilegio
- Solo asigna los roles necesarios
- Revisa periódicamente los permisos

## 💰 Costos Estimados

### Créditos Gratuitos

Google Cloud ofrece $300 USD de crédito gratuito para nuevos usuarios.

### Costos Mensuales Estimados (volumen medio)

- **Fleet Routing API**: $50-100/mes
- **Optimization API**: $30-60/mes
- **Dialogflow**: $20-40/mes (primeros 180 requests/día gratis)
- **Speech-to-Text**: $10-20/mes (primeros 60 min/mes gratis)
- **Document AI**: $15-30/mes
- **Vertex AI**: $20-40/mes
- **Gemini API**: $5-10/mes

**Total estimado: $150-300/mes**

### Configurar Alertas de Facturación

1. Ve a **Billing** → **Budgets & alerts**
2. Crea un presupuesto mensual
3. Configura alertas al 50%, 90% y 100%

## 🆘 Solución de Problemas

### Error: "Permission denied"

- Verifica que el Service Account tenga los roles correctos
- Asegúrate de que las APIs estén habilitadas

### Error: "API not enabled"

- Ve a **APIs & Services** → **Library**
- Busca la API y haz clic en **Enable**

### Error: "Invalid credentials"

- Verifica que el Service Account JSON esté correctamente codificado en base64
- Asegúrate de que el archivo JSON no esté corrupto

### Error: "Quota exceeded"

- Revisa los límites de cuota en **APIs & Services** → **Quotas**
- Considera solicitar un aumento de cuota si es necesario

## 📚 Recursos Adicionales

- [Google Cloud Documentation](https://cloud.google.com/docs)
- [Dialogflow Documentation](https://cloud.google.com/dialogflow/docs)
- [Document AI Documentation](https://cloud.google.com/document-ai/docs)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)

## 🔄 Actualización de Configuración

Si necesitas actualizar la configuración:

1. Modifica las variables en `.env.local`
2. Reinicia el servidor de desarrollo
3. En producción, actualiza las variables de entorno en tu plataforma (Vercel, etc.)
4. Redespliega la aplicación

---

**¿Necesitas ayuda?** Revisa los logs de la aplicación o consulta la documentación oficial de Google Cloud.

