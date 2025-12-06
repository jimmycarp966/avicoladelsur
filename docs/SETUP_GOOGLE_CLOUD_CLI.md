# 🚀 Configuración Automática con Google Cloud CLI

Esta guía te ayudará a configurar todos los servicios de Google Cloud usando la línea de comandos (CLI), automatizando el proceso completo.

## 📋 Prerrequisitos

1. **Instalar Google Cloud CLI (gcloud)**
   - **Windows**: Descarga desde [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
   - **macOS**: `brew install google-cloud-sdk`
   - **Linux**: Sigue [instrucciones oficiales](https://cloud.google.com/sdk/docs/install)

2. **Autenticarse con Google Cloud**
   ```bash
   gcloud auth login
   ```

3. **Verificar instalación**
   ```bash
   gcloud --version
   ```

## 🚀 Opción 1: Script Automático (Recomendado)

### Windows (PowerShell)

```powershell
# Ejecutar el script
.\scripts\setup-google-cloud.ps1
```

### Linux/macOS (Bash)

```bash
# Dar permisos de ejecución
chmod +x scripts/setup-google-cloud.sh

# Ejecutar el script
./scripts/setup-google-cloud.sh
```

El script automáticamente:
- ✅ Configura el proyecto
- ✅ Habilita todas las APIs necesarias
- ✅ Crea el Service Account
- ✅ Asigna los roles necesarios
- ✅ Genera el archivo JSON de credenciales
- ✅ Convierte a base64 para usar en `.env.local`

## 🔧 Opción 2: Comandos Manuales

Si prefieres ejecutar los comandos manualmente:

### 1. Configurar Proyecto

```bash
# Establecer proyecto
gcloud config set project TU_PROJECT_ID

# Verificar configuración
gcloud config list
```

### 2. Habilitar APIs

```bash
# Habilitar todas las APIs necesarias
gcloud services enable fleetrouting.googleapis.com
gcloud services enable cloudoptimization.googleapis.com
gcloud services enable dialogflow.googleapis.com
gcloud services enable speech.googleapis.com
gcloud services enable documentai.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable automl.googleapis.com
gcloud services enable generativelanguage.googleapis.com
gcloud services enable maps-platform-backend.googleapis.com

# Verificar APIs habilitadas
gcloud services list --enabled
```

### 3. Crear Service Account

```bash
PROJECT_ID="tu-project-id"
SERVICE_ACCOUNT_NAME="avicola-del-sur-service"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Crear Service Account
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Service Account para ERP Avícola del Sur" \
    --description="Service account para integración con Google Cloud AI Services" \
    --project=$PROJECT_ID
```

### 4. Asignar Roles

```bash
# Asignar roles necesarios
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/dialogflow.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/documentai.apiUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/storage.objectViewer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/ml.developer"
```

### 5. Generar Key JSON

```bash
# Crear y descargar key JSON
gcloud iam service-accounts keys create google-cloud-service-account.json \
    --iam-account=$SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID
```

### 6. Convertir a Base64

**Windows (PowerShell):**
```powershell
$jsonContent = Get-Content google-cloud-service-account.json -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonContent)
$base64 = [Convert]::ToBase64String($bytes)
Write-Host $base64
```

**Linux/macOS:**
```bash
cat google-cloud-service-account.json | base64 -w 0
```

## 📝 Configurar Variables de Entorno

Después de ejecutar el script o comandos manuales, agrega estas variables a tu `.env.local`:

```env
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
GOOGLE_CLOUD_REGION=southamerica-east1
GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64=tu-base64-key-aqui
```

## 🔐 Seguridad

**IMPORTANTE**: Después de generar el archivo JSON:

1. **Agregar a .gitignore**:
   ```bash
   echo "google-cloud-service-account.json" >> .gitignore
   ```

2. **No subir el archivo JSON al repositorio**
3. **Usar base64 en producción** (como se muestra en el script)
4. **Rotar las keys periódicamente**

## 🎯 Configuración Adicional

### Dialogflow Agent

Después de ejecutar el script, configura el agente Dialogflow:

```bash
# El script no puede crear el agente automáticamente
# Debes hacerlo manualmente desde la consola web:
# https://dialogflow.cloud.google.com/
```

Sigue la guía en [`docs/DIALOGFLOW_SETUP.md`](./DIALOGFLOW_SETUP.md)

### Document AI Processors

```bash
# Listar processors disponibles
gcloud documentai processors list --location=us

# Crear processor (requiere configuración manual en consola)
# Ve a: https://console.cloud.google.com/ai/document-ai
```

### Gemini API Key

```bash
# La API key de Gemini se obtiene desde:
# https://makersuite.google.com/app/apikey
# No se puede generar con gcloud CLI
```

## ✅ Verificación

Verifica que todo esté configurado correctamente:

```bash
# Verificar proyecto
gcloud config get-value project

# Verificar Service Account
gcloud iam service-accounts list --project=$PROJECT_ID

# Verificar APIs habilitadas
gcloud services list --enabled --project=$PROJECT_ID | grep -E "(fleetrouting|optimization|dialogflow|speech|documentai|aiplatform|automl|generativelanguage)"
```

## 🆘 Solución de Problemas

### Error: "Permission denied"
```bash
# Verificar autenticación
gcloud auth list

# Re-autenticarse si es necesario
gcloud auth login
```

### Error: "API not enabled"
```bash
# Habilitar API manualmente
gcloud services enable NOMBRE_API --project=$PROJECT_ID
```

### Error: "Service account already exists"
```bash
# Usar el existente o eliminar y recrear
gcloud iam service-accounts delete SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID
```

## 📚 Recursos Adicionales

- [Google Cloud CLI Documentation](https://cloud.google.com/sdk/docs)
- [gcloud Reference](https://cloud.google.com/sdk/gcloud/reference)
- [Service Accounts Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)

---

**¿Necesitas ayuda?** Ejecuta el script automático o sigue los comandos manuales paso a paso.

