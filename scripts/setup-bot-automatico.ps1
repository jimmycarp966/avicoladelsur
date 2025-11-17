# Script de configuración automática del Bot Vendedor (PowerShell)
# Usa Twilio CLI para configurar todo automáticamente

Write-Host "🤖 Configuración Automática del Bot Vendedor" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Verificar Twilio CLI
Write-Host "📱 PASO 1: Verificando Twilio CLI..." -ForegroundColor Blue
Write-Host ""

$twilioVersion = twilio --version 2>$null
if (-not $twilioVersion) {
    Write-Host "❌ Twilio CLI no está instalado" -ForegroundColor Red
    Write-Host "Instálalo desde: https://www.twilio.com/docs/twilio-cli/quickstart" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Twilio CLI detectado: $twilioVersion" -ForegroundColor Green
Write-Host ""

# Paso 2: Verificar autenticación
Write-Host "🔐 PASO 2: Verificando autenticación..." -ForegroundColor Blue
Write-Host ""

$profiles = twilio profiles:list 2>&1
if ($profiles -match "No profiles") {
    Write-Host "No hay perfiles configurados." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Vamos a autenticar Twilio CLI..." -ForegroundColor Cyan
    Write-Host "Necesitarás tu Account SID y Auth Token de:" -ForegroundColor Yellow
    Write-Host "https://console.twilio.com" -ForegroundColor Yellow
    Write-Host ""
    
    $continuar = Read-Host "¿Ya tienes una cuenta de Twilio? (s/n)"
    if ($continuar -ne "s") {
        Write-Host ""
        Write-Host "⚠️  Primero crea tu cuenta en: https://www.twilio.com/try-twilio" -ForegroundColor Yellow
        Write-Host "Luego vuelve a ejecutar este script." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host ""
    Write-Host "Ejecutando: twilio login" -ForegroundColor Cyan
    twilio login
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error al autenticar. Intenta de nuevo." -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Twilio CLI autenticado correctamente" -ForegroundColor Green
Write-Host ""

# Paso 3: Obtener información de la cuenta
Write-Host "📊 PASO 3: Obteniendo información de tu cuenta..." -ForegroundColor Blue
Write-Host ""

# Obtener Account SID
$accountInfo = twilio api:core:accounts:list --limit 1 2>&1
Write-Host "Account SID obtenido" -ForegroundColor Green

# Paso 4: Configurar WhatsApp Sandbox
Write-Host ""
Write-Host "📱 PASO 4: Configurar WhatsApp Sandbox" -ForegroundColor Blue
Write-Host ""
Write-Host "El Sandbox de WhatsApp te permite probar sin aprobación de Meta." -ForegroundColor Cyan
Write-Host ""
Write-Host "Para activar el Sandbox:" -ForegroundColor Yellow
Write-Host "1. Ve a: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn" -ForegroundColor White
Write-Host "2. Verás un número (ej: +1 415 523 8886) y un código único" -ForegroundColor White
Write-Host "3. Desde tu WhatsApp personal, envía ese código al número" -ForegroundColor White
Write-Host "4. Recibirás un mensaje de confirmación" -ForegroundColor White
Write-Host ""

$sandboxActivo = Read-Host "¿Ya activaste el Sandbox desde tu WhatsApp? (s/n)"
if ($sandboxActivo -ne "s") {
    Write-Host ""
    Write-Host "⚠️  Activa el Sandbox primero y vuelve a ejecutar el script." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ WhatsApp Sandbox activado" -ForegroundColor Green
Write-Host ""

# Paso 5: Configurar webhook
Write-Host "🔗 PASO 5: Configurar Webhook" -ForegroundColor Blue
Write-Host ""
Write-Host "Necesitamos la URL pública de tu servidor Next.js." -ForegroundColor Cyan
Write-Host ""
Write-Host "Opciones:" -ForegroundColor Yellow
Write-Host "  1. Usar ngrok: ngrok http 3000" -ForegroundColor White
Write-Host "  2. Usar un dominio de producción (ej: tu-proyecto.vercel.app)" -ForegroundColor White
Write-Host ""

$webhookUrl = Read-Host "Ingresa la URL de tu servidor (sin http/https)"
if ([string]::IsNullOrWhiteSpace($webhookUrl)) {
    Write-Host "❌ URL requerida" -ForegroundColor Red
    exit 1
}

# Asegurar que tenga https://
if (-not $webhookUrl.StartsWith("http")) {
    $webhookUrl = "https://$webhookUrl"
}

Write-Host ""
Write-Host "URL del webhook configurada: $webhookUrl/api/bot" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Ahora configura manualmente el webhook en:" -ForegroundColor Yellow
Write-Host "https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox" -ForegroundColor White
Write-Host ""
Write-Host "  • URL del webhook: $webhookUrl/api/bot" -ForegroundColor White
Write-Host "  • Método: POST" -ForegroundColor White
Write-Host ""
Read-Host "Presiona ENTER cuando hayas configurado el webhook"

Write-Host "✅ Webhook configurado" -ForegroundColor Green
Write-Host ""

# Paso 6: Variables de entorno
Write-Host "⚙️  PASO 6: Configurar Variables de Entorno" -ForegroundColor Blue
Write-Host ""

# Generar token aleatorio para Botpress
$bytes = New-Object Byte[] 16
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$botpressToken = [Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9]', ''

Write-Host "Agregando variables de entorno a .env.local..." -ForegroundColor Cyan

# Leer Account SID del perfil activo
$accountSid = (twilio profiles:list | Select-String "Account SID" | ForEach-Object { $_ -replace '.*Account SID\s+', '' }).Trim()

# Crear o actualizar .env.local
$envContent = @"

# Twilio (Bot de WhatsApp) - Configurado automáticamente
TWILIO_ACCOUNT_SID=$accountSid
TWILIO_AUTH_TOKEN=tu-auth-token-aqui
TWILIO_WHATSAPP_NUMBER=+14155238886
BOTPRESS_WEBHOOK_TOKEN=$botpressToken
"@

Add-Content -Path ".env.local" -Value $envContent

Write-Host "✅ Variables de entorno configuradas" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Debes agregar manualmente TWILIO_AUTH_TOKEN a .env.local" -ForegroundColor Yellow
Write-Host "Encuéntralo en: https://console.twilio.com" -ForegroundColor White
Write-Host ""

# Paso 7: Resumen
Write-Host "🎉 ¡Configuración completada!" -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📋 RESUMEN" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Twilio CLI configurado" -ForegroundColor Green
Write-Host "✅ WhatsApp Sandbox activado" -ForegroundColor Green
Write-Host "✅ Webhook configurado en: $webhookUrl/api/bot" -ForegroundColor Green
Write-Host "✅ Variables de entorno creadas" -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📝 PRÓXIMOS PASOS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Completa TWILIO_AUTH_TOKEN en .env.local" -ForegroundColor Yellow
Write-Host "2. Si usas ngrok, ejecútalo: ngrok http 3000" -ForegroundColor Yellow
Write-Host "3. Inicia tu servidor: npm run dev" -ForegroundColor Yellow
Write-Host "4. Configura Botpress (opcional): https://app.botpress.cloud" -ForegroundColor Yellow
Write-Host "5. Prueba desde WhatsApp enviando: 'Hola'" -ForegroundColor Yellow
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🧪 DATOS DE PRUEBA" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Clientes disponibles:" -ForegroundColor White
Write-Host "  • +5491123456789 (Juan Pérez)" -ForegroundColor Gray
Write-Host "  • +5491198765432 (María García)" -ForegroundColor Gray
Write-Host ""
Write-Host "Productos disponibles:" -ForegroundColor White
Write-Host "  • POLLO001 - Pollo Entero ($850/kg)" -ForegroundColor Gray
Write-Host "  • POLLO002 - Pechuga ($1,200/kg)" -ForegroundColor Gray
Write-Host "  • HUEVO001 - Huevos ($180/docena)" -ForegroundColor Gray
Write-Host ""
Write-Host "Ejemplo de mensaje:" -ForegroundColor White
Write-Host "  'Quiero hacer un pedido de POLLO001'" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "¿Necesitas ayuda? Lee: GUIA-CONFIGURACION-BOT.md" -ForegroundColor Cyan
Write-Host ""

