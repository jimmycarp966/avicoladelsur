#!/bin/bash

# ===========================================
# Script de Configuración Automática - Google Cloud
# Configura todas las APIs y servicios necesarios usando gcloud CLI
# ===========================================

set -e  # Salir si hay errores

echo "🚀 Configuración Automática de Google Cloud para Avícola del Sur ERP"
echo "=================================================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que gcloud esté instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI no está instalado${NC}"
    echo "Instala gcloud desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "${GREEN}✅ gcloud CLI encontrado${NC}"
echo ""

# Solicitar información básica
read -p "Ingresa tu Project ID de Google Cloud: " PROJECT_ID
read -p "Ingresa la región (default: southamerica-east1): " REGION
REGION=${REGION:-southamerica-east1}

echo ""
echo "📋 Configurando proyecto: $PROJECT_ID"
echo "📍 Región: $REGION"
echo ""

# Configurar proyecto
echo -e "${YELLOW}1. Configurando proyecto...${NC}"
gcloud config set project $PROJECT_ID

# Habilitar APIs necesarias
echo -e "${YELLOW}2. Habilitando APIs...${NC}"
APIS=(
    "fleetrouting.googleapis.com"
    "cloudoptimization.googleapis.com"
    "dialogflow.googleapis.com"
    "speech.googleapis.com"
    "documentai.googleapis.com"
    "aiplatform.googleapis.com"
    "automl.googleapis.com"
    "generativelanguage.googleapis.com"
    "maps-platform-backend.googleapis.com"
)

for api in "${APIS[@]}"; do
    echo "  Habilitando $api..."
    gcloud services enable $api --project=$PROJECT_ID || echo "  ⚠️  Ya estaba habilitada o error"
done

echo ""
echo -e "${GREEN}✅ APIs habilitadas${NC}"
echo ""

# Crear Service Account
echo -e "${YELLOW}3. Creando Service Account...${NC}"
SERVICE_ACCOUNT_NAME="avicola-del-sur-service"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Verificar si ya existe
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID &> /dev/null; then
    echo "  ⚠️  Service Account ya existe, usando el existente"
else
    echo "  Creando Service Account: $SERVICE_ACCOUNT_NAME"
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Service Account para ERP Avícola del Sur" \
        --description="Service account para integración con Google Cloud AI Services" \
        --project=$PROJECT_ID
fi

# Asignar roles necesarios
echo -e "${YELLOW}4. Asignando roles al Service Account...${NC}"
ROLES=(
    "roles/aiplatform.user"
    "roles/dialogflow.admin"
    "roles/documentai.apiUser"
    "roles/storage.objectViewer"
    "roles/ml.developer"
)

for role in "${ROLES[@]}"; do
    echo "  Asignando $role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="$role" \
        --condition=None || echo "  ⚠️  Error o ya asignado"
done

echo ""
echo -e "${GREEN}✅ Roles asignados${NC}"
echo ""

# Crear y descargar key JSON
echo -e "${YELLOW}5. Generando key JSON...${NC}"
KEY_FILE="google-cloud-service-account.json"
gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID

echo ""
echo -e "${GREEN}✅ Key JSON creado: $KEY_FILE${NC}"
echo ""

# Convertir a base64
echo -e "${YELLOW}6. Convirtiendo a base64...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    BASE64_KEY=$(cat $KEY_FILE | base64 -w 0)
else
    # Linux
    BASE64_KEY=$(cat $KEY_FILE | base64 -w 0)
fi

echo ""
echo "=================================================================="
echo -e "${GREEN}✅ Configuración completada${NC}"
echo ""
echo "📝 Variables de entorno para tu .env.local:"
echo "=================================================================="
echo ""
echo "GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID"
echo "GOOGLE_CLOUD_REGION=$REGION"
echo "GOOGLE_CLOUD_SERVICE_ACCOUNT_BASE64=$BASE64_KEY"
echo ""
echo "=================================================================="
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "1. Guarda el archivo $KEY_FILE de forma segura"
echo "2. Agrega $KEY_FILE a tu .gitignore"
echo "3. Copia las variables de entorno a tu .env.local"
echo "4. Para configurar Dialogflow, sigue: docs/DIALOGFLOW_SETUP.md"
echo "5. Para configurar Document AI, sigue: docs/GOOGLE_CLOUD_SETUP.md"
echo ""

