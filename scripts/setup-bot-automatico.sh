#!/bin/bash
# Script de configuración automática del Bot Vendedor
# Usa Twilio CLI para configurar todo automáticamente

echo "🤖 Configuración Automática del Bot Vendedor"
echo "=============================================="
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Paso 1: Autenticación de Twilio
echo -e "${BLUE}📱 PASO 1: Autenticación de Twilio${NC}"
echo "Necesitamos tus credenciales de Twilio para continuar."
echo ""
echo "Si no tienes cuenta, créala aquí: https://www.twilio.com/try-twilio"
echo ""
read -p "¿Ya tienes una cuenta de Twilio? (s/n): " tiene_cuenta

if [ "$tiene_cuenta" != "s" ]; then
    echo -e "${YELLOW}⚠️  Primero crea tu cuenta en: https://www.twilio.com/try-twilio${NC}"
    echo "Luego vuelve a ejecutar este script."
    exit 1
fi

echo ""
echo "Vamos a autenticar Twilio CLI..."
echo "Te pedirá tu Account SID y Auth Token (los encuentras en: https://console.twilio.com)"
echo ""
twilio login

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error al autenticar. Intenta de nuevo.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Twilio CLI autenticado correctamente${NC}"
echo ""

# Paso 2: Activar WhatsApp Sandbox
echo -e "${BLUE}📱 PASO 2: Configurar WhatsApp Sandbox${NC}"
echo ""
echo "El Sandbox de WhatsApp te permite probar sin necesidad de aprobación de Meta."
echo ""

# Obtener el número del sandbox
echo "Obteniendo información del WhatsApp Sandbox..."
twilio api:messaging:v1:services:list --limit 1

echo ""
echo -e "${YELLOW}Para activar el Sandbox:${NC}"
echo "1. Ve a: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
echo "2. Verás un número (ej: +1 415 523 8886) y un código (ej: 'join abc-def')"
echo "3. Desde tu WhatsApp, envía ese código al número"
echo ""
read -p "¿Ya activaste el Sandbox desde tu WhatsApp? (s/n): " sandbox_activo

if [ "$sandbox_activo" != "s" ]; then
    echo -e "${YELLOW}⚠️  Activa el Sandbox primero y vuelve a ejecutar el script.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ WhatsApp Sandbox activado${NC}"
echo ""

# Paso 3: Configurar webhook
echo -e "${BLUE}🔗 PASO 3: Configurar Webhook${NC}"
echo ""
echo "Necesitamos la URL pública de tu servidor Next.js."
echo ""
echo "Opciones:"
echo "1. Usar ngrok: ngrok http 3000"
echo "2. Usar un dominio de producción"
echo ""
read -p "Ingresa la URL de tu servidor (ej: https://abc123.ngrok.io): " webhook_url

if [ -z "$webhook_url" ]; then
    echo -e "${RED}❌ URL requerida${NC}"
    exit 1
fi

# Configurar el webhook en Twilio
echo "Configurando webhook en Twilio..."
# Nota: Esto se hace mejor desde la consola web o con la API REST
echo ""
echo -e "${YELLOW}Configura manualmente el webhook en:${NC}"
echo "https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox"
echo ""
echo "URL del webhook: ${webhook_url}/api/bot"
echo "Método: POST"
echo ""
read -p "Presiona ENTER cuando hayas configurado el webhook..."

echo -e "${GREEN}✅ Webhook configurado${NC}"
echo ""

# Paso 4: Variables de entorno
echo -e "${BLUE}⚙️  PASO 4: Configurar Variables de Entorno${NC}"
echo ""

# Obtener Account SID y Auth Token
ACCOUNT_SID=$(twilio profiles:list | grep "Account SID" | awk '{print $3}')
AUTH_TOKEN=$(twilio profiles:list | grep "Auth Token" | awk '{print $3}')

echo "Agregando variables de entorno a .env.local..."
cat >> .env.local << EOF

# Twilio (Bot de WhatsApp)
TWILIO_ACCOUNT_SID=${ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${AUTH_TOKEN}
TWILIO_WHATSAPP_NUMBER=+14155238886
BOTPRESS_WEBHOOK_TOKEN=$(openssl rand -hex 16)
EOF

echo -e "${GREEN}✅ Variables de entorno configuradas${NC}"
echo ""

# Paso 5: Prueba
echo -e "${BLUE}🧪 PASO 5: Prueba del Sistema${NC}"
echo ""
echo "Todo está listo para probar el bot."
echo ""
echo "1. Asegúrate de que tu servidor esté corriendo: npm run dev"
echo "2. Si usas ngrok, asegúrate de que esté activo: ngrok http 3000"
echo "3. Desde tu WhatsApp, envía un mensaje al número del Sandbox"
echo ""
echo "Ejemplo de mensaje:"
echo "  'Quiero hacer un pedido'"
echo ""
echo -e "${GREEN}🎉 ¡Configuración completada!${NC}"
echo ""
echo "Próximos pasos:"
echo "- Configura Botpress en: https://app.botpress.cloud"
echo "- Sigue la guía en: GUIA-CONFIGURACION-BOT.md"
echo ""

