# ===========================================
# Script de Configuración Automática - Google Cloud (PowerShell)
# Configura todas las APIs y servicios necesarios usando gcloud CLI
# ===========================================

Write-Host "🚀 Configuración Automática de Google Cloud para Avícola del Sur ERP" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que gcloud esté instalado
try {
    $gcloudVersion = gcloud --version 2>&1
    Write-Host "✅ gcloud CLI encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: gcloud CLI no está instalado" -ForegroundColor Red
    Write-Host "Instala gcloud desde: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Solicitar información básica
$PROJECT_ID = Read-Host "Ingresa tu Project ID de Google Cloud"
$REGION = Read-Host "Ingresa la región (default: southamerica-east1)"
if ([string]::IsNullOrWhiteSpace($REGION)) {
    $REGION = "southamerica-east1"
}

Write-Host ""
Write-Host "📋 Configurando proyecto: $PROJECT_ID" -ForegroundColor Yellow
Write-Host "📍 Región: $REGION" -ForegroundColor Yellow
Write-Host ""

# Configurar proyecto
Write-Host "1. Configurando proyecto..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Habilitar APIs necesarias
Write-Host "2. Habilitando APIs..." -ForegroundColor Yellow
$APIS = @(
    "fleetrouting.googleapis.com",
    "cloudoptimization.googleapis.com",
    "dialogflow.googleapis.com",
    "speech.googleapis.com",
    "documentai.googleapis.com",
    "aiplatform.googleapis.com",
    "automl.googleapis.com",
    "generativelanguage.googleapis.com",
    "maps-platform-backend.googleapis.com"
)

foreach ($api in $APIS) {
    Write-Host "  Habilitando $api..." -ForegroundColor Gray
    gcloud services enable $api --project=$PROJECT_ID 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ $api habilitada" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $api ya estaba habilitada o error" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ APIs habilitadas" -ForegroundColor Green
Write-Host ""

# Crear Service Account
Write-Host "3. Creando Service Account..." -ForegroundColor Yellow
$SERVICE_ACCOUNT_NAME = "avicola-del-sur-service"
$SERVICE_ACCOUNT_EMAIL = "$SERVICE_ACCOUNT_NAME@${PROJECT_ID}.iam.gserviceaccount.com"

# Verificar si ya existe
try {
    gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID 2>&1 | Out-Null
    Write-Host "  ⚠️  Service Account ya existe, usando el existente" -ForegroundColor Yellow
} catch {
    Write-Host "  Creando Service Account: $SERVICE_ACCOUNT_NAME" -ForegroundColor Gray
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME `
        --display-name="Service Account para ERP Avícola del Sur" `
        --description="Service account para integración con Google Cloud AI Services" `
        --project=$PROJECT_ID
    Write-Host "  ✅ Service Account creado" -ForegroundColor Green
}

# Asignar roles necesarios
Write-Host "4. Asignando roles al Service Account..." -ForegroundColor Yellow
$ROLES = @(
    "roles/aiplatform.user",
    "roles/dialogflow.admin",
    "roles/documentai.apiUser",
    "roles/storage.objectViewer",
    "roles/ml.developer"
)

foreach ($role in $ROLES) {
    Write-Host "  Asignando $role..." -ForegroundColor Gray
    gcloud projects add-iam-policy-binding $PROJECT_ID `
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" `
        --role="$role" `
        --condition=None 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ $role asignado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error o ya asignado" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Roles asignados" -ForegroundColor Green
Write-Host ""

# Crear y descargar key JSON
Write-Host "5. Generando key JSON..." -ForegroundColor Yellow
$KEY_FILE = "google-cloud-service-account.json"
gcloud iam service-accounts keys create $KEY_FILE `
    --iam-account=$SERVICE_ACCOUNT_EMAIL `
    --project=$PROJECT_ID

Write-Host ""
Write-Host "✅ Key JSON creado: $KEY_FILE" -ForegroundColor Green
Write-Host ""

# Convertir a base64
Write-Host "6. Convirtiendo a base64..." -ForegroundColor Yellow
$jsonContent = Get-Content $KEY_FILE -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonContent)
$BASE64_KEY = [Convert]::ToBase64String($bytes)

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "✅ Configuración completada" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Variables de entorno para tu .env.local:" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID"
Write-Host "GOOGLE_CLOUD_REGION=$REGION"
Write-Host "GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64=$BASE64_KEY"
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "1. Guarda el archivo $KEY_FILE de forma segura"
Write-Host "2. Agrega $KEY_FILE a tu .gitignore"
Write-Host "3. Copia las variables de entorno a tu .env.local"
Write-Host "4. Para configurar Dialogflow, sigue: docs/DIALOGFLOW_SETUP.md"
Write-Host "5. Para configurar Document AI, sigue: docs/GOOGLE_CLOUD_SETUP.md"
Write-Host ""

